import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_TRACE_RUNS = 1_000
const MAX_OUTPUT_BYTES = 30_000
const CONTENT_BUDGET = 16_000
const CONTENT_ITEM_LIMIT = 2_000
const METADATA_SELECT = [
  "completion_cost",
  "completion_tokens",
  "dotted_order",
  "end_time",
  "error",
  "extra",
  "first_token_time",
  "id",
  "name",
  "parent_run_id",
  "parent_run_ids",
  "prompt_cost",
  "prompt_tokens",
  "run_type",
  "session_id",
  "start_time",
  "status",
  "tags",
  "total_cost",
  "total_tokens",
  "trace_id",
]

const usage = `Usage:
  review.mjs recent [--limit N] [--repository OWNER/REPO | --all-repositories]
  review.mjs agent [paseo-agent-id] [--limit N]
  review.mjs subagent <opencode-session-id> [--limit N] [--include-content]
  review.mjs thread <thread-id> [--limit N] [--include-content]
  review.mjs trace <trace-id-or-url> [--limit N] [--include-content]

Options:
  --limit N             Number of traces or runs to return (1-${MAX_LIMIT})
  --repository NAME     Filter recent traces by repository_name
  --all-repositories    Do not scope recent traces to the current repository
  --include-content     Include bounded, redacted input/output previews
  --help                Show this help`

export function parseArgs(argv) {
  const args = [...argv]
  const command = args[0] && !args[0].startsWith("--") ? args.shift() : "recent"
  const options = {
    command,
    id: undefined,
    limit: ["trace", "agent", "subagent"].includes(command) ? MAX_LIMIT : DEFAULT_LIMIT,
    repository: undefined,
    allRepositories: false,
    includeContent: false,
    help: false,
  }

  const positional = []
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === "--help" || value === "-h") {
      options.help = true
      continue
    }
    if (value === "--include-content") {
      options.includeContent = true
      continue
    }
    if (value === "--all-repositories") {
      options.allRepositories = true
      continue
    }
    if (value === "--limit" || value === "--repository") {
      const next = args[index + 1]
      if (!next || next.startsWith("--")) throw new Error(`${value} requires a value`)
      index += 1
      if (value === "--repository") {
        options.repository = next
      } else {
        const limit = Number(next)
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
          throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}`)
        }
        options.limit = limit
      }
      continue
    }
    if (value.startsWith("--")) throw new Error(`unknown option: ${value}`)
    positional.push(value)
  }

  if (options.help) return options
  if (!["recent", "agent", "subagent", "thread", "trace"].includes(command)) {
    throw new Error(`unknown command: ${command}`)
  }
  if (command === "recent") {
    if (positional.length) throw new Error("recent does not accept a positional argument")
    if (options.includeContent) {
      throw new Error("--include-content requires subagent, thread, or trace")
    }
    if (options.repository && options.allRepositories) {
      throw new Error("--repository and --all-repositories cannot be combined")
    }
  } else if (command === "agent") {
    if (positional.length > 1) throw new Error("agent accepts at most one Paseo agent ID")
    if (options.includeContent) {
      throw new Error("--include-content requires subagent, thread, or trace")
    }
    if (options.repository || options.allRepositories) {
      throw new Error("repository filters are only available for recent")
    }
    options.id = positional[0]
  } else {
    if (positional.length !== 1) throw new Error(`${command} requires exactly one ID`)
    if (options.repository || options.allRepositories) {
      throw new Error("repository filters are only available for recent")
    }
    options.id = positional[0]
  }

  return options
}

function readOptionalJson(file) {
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, "utf8"))
}

export function resolveSettings({ env = process.env, cwd = process.cwd() } = {}) {
  const home = env.HOME ?? homedir()
  const globalConfig = readOptionalJson(join(home, ".config", "opencode", "langsmith.json"))
  const projectConfig = readOptionalJson(join(cwd, ".opencode", "langsmith.json"))
  const config = { ...globalConfig, ...projectConfig }
  const apiKey = env.LANGSMITH_OPENCODE_API_KEY ?? env.LANGSMITH_API_KEY ?? config.api_key

  if (!apiKey) throw new Error("LangSmith API key is not set")

  return {
    apiKey,
    apiUrl:
      env.LANGSMITH_OPENCODE_ENDPOINT ??
      env.LANGSMITH_ENDPOINT ??
      config.api_url ??
      "https://api.smith.langchain.com",
    project:
      env.LANGSMITH_OPENCODE_PROJECT ?? env.LANGSMITH_PROJECT ?? config.project ?? "opencode",
    workspaceId: env.LANGSMITH_WORKSPACE_ID,
  }
}

export function resolvePaseoAgentSession(
  agentId,
  { env = process.env, agentsRoot } = {},
) {
  const home = env.HOME ?? homedir()
  const root = agentsRoot ?? join(home, ".paseo", "agents")
  if (!existsSync(root)) return undefined

  const matches = []
  for (const relativePath of readdirSync(root, { recursive: true })) {
    if (!relativePath.endsWith(".json")) continue
    let record
    try {
      record = readOptionalJson(join(root, relativePath))
    } catch {
      continue
    }
    if (typeof record.id !== "string" || !record.id.startsWith(agentId)) continue
    const threadId =
      record.runtimeInfo?.sessionId ??
      record.persistence?.sessionId ??
      record.persistence?.nativeHandle
    if (record.provider !== "opencode" || typeof threadId !== "string") continue
    matches.push({ agentId: record.id, threadId })
  }

  if (matches.length > 1) {
    throw new Error(`Paseo agent ID ${safeString(agentId)} is ambiguous; use the full ID`)
  }
  return matches[0]
}

async function createClient(settings, env = process.env) {
  const require = createRequire(import.meta.url)
  const cacheRoot = env.XDG_CACHE_HOME ?? join(env.HOME ?? homedir(), ".cache")
  const pluginNodeModules = join(
    cacheRoot,
    "opencode",
    "packages",
    "@langchain",
    "langsmith-opencode",
    "node_modules",
  )
  const searchPaths = [dirname(fileURLToPath(import.meta.url)), pluginNodeModules]

  let sdkPath
  try {
    sdkPath = require.resolve("langsmith", { paths: searchPaths })
  } catch {
    throw new Error(
      "LangSmith SDK was not found; confirm @langchain/langsmith-opencode is installed and restart OpenCode",
    )
  }

  const sdk = await import(pathToFileURL(sdkPath).href)
  const Client = sdk.Client ?? sdk.default?.Client
  if (!Client) throw new Error("Installed LangSmith SDK does not export Client")

  return new Client({
    apiKey: settings.apiKey,
    apiUrl: settings.apiUrl,
    ...(settings.workspaceId ? { workspaceId: settings.workspaceId } : {}),
  })
}

export function parseRepositoryRemote(remote) {
  if (!remote) return undefined
  const ssh = remote.match(/^[^@]+@[^:]+:(.+)$/)
  if (ssh) return ssh[1].replace(/\.git$/, "").replace(/\/+$/, "") || undefined

  try {
    return new URL(remote).pathname.replace(/^\/+/, "").replace(/\.git$/, "").replace(/\/+$/, "") || undefined
  } catch {
    return undefined
  }
}

export function currentRepository(cwd = process.cwd()) {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
    }).trim()
    return parseRepositoryRemote(remote)
  } catch {
    return undefined
  }
}

export function metadataFilter(value) {
  const json = JSON.stringify(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")
  return `has(metadata, '${json}')`
}

export function scrubSecrets(value) {
  return String(value)
    .replace(
      /((?:proxy-)?authorization(?:\\?["']|\s)*[:=](?:\\?["']|\s)*)[\s\S]*?(?=\r?\n|\\n|$)/gi,
      "$1[redacted-secret]",
    )
    .replace(/\b(?:lsv2_(?:pt|sk)_|sntryu_)[A-Za-z0-9_-]+\b/g, "[redacted-secret]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted-secret]")
    .replace(/\b(?:gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]+\b/gi, "[redacted-secret]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted-secret]")
    .replace(
      /((?:api[_-]?key|token|secret|password|x-api-key)["'\s]*[:=]["'\s]*)[^\s,"'}]+/gi,
      "$1[redacted-secret]",
    )
    .replace(/(https?:\/\/)[^/\s:@]+:[^@\s/]+@/gi, "$1[redacted-secret]@")
    .replace(
      /([?&](?:api[_-]?key|token|secret|password|x-api-key|authorization)=)[^&#\s]+/gi,
      "$1[redacted-secret]",
    )
}

export function safeEndpoint(value) {
  try {
    const url = new URL(value)
    return scrubSecrets(`${url.origin}${url.pathname}`).slice(0, 500)
  } catch {
    return "[invalid endpoint]"
  }
}

function toMillis(value) {
  if (value == null) return undefined
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1_000 : value
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function asIso(value) {
  const millis = toMillis(value)
  return millis == null ? undefined : new Date(millis).toISOString()
}

function durationSeconds(run) {
  const start = toMillis(run.start_time)
  const end = toMillis(run.end_time)
  return start == null || end == null ? undefined : Math.max(0, (end - start) / 1_000)
}

function metadata(run) {
  return run.extra?.metadata ?? {}
}

function safeString(value, maxLength = 500) {
  return value == null ? undefined : scrubSecrets(value).slice(0, maxLength)
}

function safeMetadataValue(value) {
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") return safeString(value)
  return safeString(JSON.stringify(value))
}

function tokenUsage(run) {
  const usage = metadata(run).usage_metadata ?? {}
  return {
    input: run.prompt_tokens ?? usage.input_tokens ?? 0,
    output: run.completion_tokens ?? usage.output_tokens ?? 0,
    total: run.total_tokens ?? usage.total_tokens ?? 0,
  }
}

function selectedMetadata(run) {
  const source = metadata(run)
  const keys = [
    "repository_name",
    "cwd",
    "git_branch",
    "git_commit_sha",
    "thread_id",
    "turn_id",
    "turn_number",
    "paseo_agent_id",
    "paseo_agent_cwd",
    "ls_agent_type",
    "ls_subagent_id",
    "ls_subagent_type",
    "ls_model_name",
    "ls_provider",
    "workflow_id",
    "workflow_phase",
    "objective_status",
    "implementation_status",
    "interpretation_status",
    "capsule_id",
    "candidate_fingerprint",
    "capacity_decision",
    "capacity_reason",
    "BLOCKED_BEFORE_DELEGATION",
    "FRESH_IMPLEMENTER_LAUNCHES",
    "CLARIFICATION_CALLS",
    "SEMANTIC_REMEDIATION_ATTEMPTS",
    "CAPSULE_RESUMES",
  ]
  return Object.fromEntries(
    keys
      .filter((key) => source[key] != null)
      .map((key) => [key, safeMetadataValue(source[key])]),
  )
}

async function collect(iterable) {
  const values = []
  for await (const value of iterable) values.push(value)
  return values
}

async function collectBounded(iterable, limit) {
  const values = []
  for await (const value of iterable) {
    if (values.length === limit) return { values, truncated: true }
    values.push(value)
  }
  return { values, truncated: false }
}

function runSelect(includeContent) {
  return includeContent ? [...METADATA_SELECT, "inputs", "outputs"] : METADATA_SELECT
}

async function tracesWithRuns(client, project, roots, includeContent = false) {
  const traces = []
  for (const root of roots) {
    const result = await collectBounded(
      client.listRuns({
        projectName: project,
        traceId: root.trace_id ?? root.id,
        order: "asc",
        select: runSelect(includeContent),
      }),
      MAX_TRACE_RUNS,
    )
    traces.push({ root, runs: result.values, runsTruncated: result.truncated })
  }
  return traces
}

export function summarizeTrace(
  root,
  runs,
  runsTruncated = runs.length === MAX_LIMIT || runs.length === MAX_TRACE_RUNS,
) {
  const llmRuns = runs.filter((run) => run.run_type === "llm")
  const toolRuns = runs.filter((run) => run.run_type === "tool")
  const tokens = llmRuns.reduce(
    (sum, run) => {
      const current = tokenUsage(run)
      sum.input += current.input
      sum.output += current.output
      sum.total += current.total
      return sum
    },
    { input: 0, output: 0, total: 0 },
  )
  const rootMetadata = metadata(root)

  return {
    id: safeString(root.id),
    threadId: safeString(rootMetadata.thread_id),
    startedAt: asIso(root.start_time),
    durationSeconds: durationSeconds(root),
    status: root.error ? "error" : root.end_time ? "success" : "pending",
    runCount: runs.length,
    runsTruncated,
    llmCalls: llmRuns.length,
    toolCalls: toolRuns.length,
    errors: runs.filter((run) => run.error).length,
    toolErrors: toolRuns.filter((run) => run.error).length,
    tokens,
    models: [
      ...new Set(llmRuns.map((run) => safeString(metadata(run).ls_model_name)).filter(Boolean)),
    ],
    providers: [
      ...new Set(llmRuns.map((run) => safeString(metadata(run).ls_provider)).filter(Boolean)),
    ],
    repositoryName: safeString(rootMetadata.repository_name),
    cwd: safeString(rootMetadata.cwd),
    gitBranch: safeString(rootMetadata.git_branch),
    turnNumber: safeMetadataValue(rootMetadata.turn_number),
    paseoAgentId: safeString(rootMetadata.paseo_agent_id),
    parentTraceId: root.trace_id !== root.id ? safeString(root.trace_id) : undefined,
    parentRunId: safeString(root.parent_run_id),
    subagentId: safeString(rootMetadata.ls_subagent_id),
    subagentType: safeString(rootMetadata.ls_subagent_type),
  }
}

function buildReview(settings, scope, entries) {
  const traces = entries.map(({ root, runs, runsTruncated }) =>
    summarizeTrace(root, runs, runsTruncated),
  )
  const allRuns = entries.flatMap(({ runs }) => runs)
  const subagents = allRuns
    .filter((run) => metadata(run).ls_subagent_id)
    .map((run) => ({
      id: safeString(metadata(run).ls_subagent_id),
      type: safeString(metadata(run).ls_subagent_type),
      runId: safeString(run.id),
      parentTraceId: safeString(run.trace_id),
      parentRunId: safeString(run.parent_run_id),
      startedAt: asIso(run.start_time),
      durationSeconds: durationSeconds(run),
      status: run.error ? "error" : run.end_time ? "success" : "pending",
    }))
  const errors = allRuns
    .filter((run) => run.error)
    .map((run) => ({
      traceId: safeString(run.trace_id),
      runType: run.run_type,
      name: safeString(run.name, 200),
      error: scrubSecrets(run.error).slice(0, 500),
    }))
  const orchestrationEvents = allRuns
    .filter((run) => {
      const runMetadata = metadata(run)
      return runMetadata.workflow_id || runMetadata.capsule_id || runMetadata.capacity_decision
    })
    .map((run) => ({
      traceId: safeString(run.trace_id),
      runId: safeString(run.id),
      name: safeString(run.name, 200),
      startedAt: asIso(run.start_time),
      ...selectedMetadata(run),
    }))
  const toolSummary = new Map()
  for (const run of allRuns.filter((item) => item.run_type === "tool")) {
    const name = scrubSecrets(run.name ?? "unknown").slice(0, 200)
    const item = toolSummary.get(name) ?? { name, calls: 0, errors: 0, totalSeconds: 0 }
    item.calls += 1
    item.errors += run.error ? 1 : 0
    item.totalSeconds += durationSeconds(run) ?? 0
    toolSummary.set(name, item)
  }
  const toolUsage = [...toolSummary.values()]
    .map((item) => ({
      name: item.name,
      calls: item.calls,
      errors: item.errors,
      averageSeconds: item.calls ? item.totalSeconds / item.calls : 0,
    }))
    .sort((left, right) => right.calls - left.calls)
  const slowestRuns = allRuns
    .filter((run) => run.parent_run_id && durationSeconds(run) != null)
    .map((run) => ({
      traceId: safeString(run.trace_id),
      runType: run.run_type,
      name: safeString(run.name, 200),
      durationSeconds: durationSeconds(run),
    }))
    .sort((left, right) => right.durationSeconds - left.durationSeconds)
    .slice(0, 10)
  const heaviestLlmRuns = allRuns
    .filter((run) => run.run_type === "llm")
    .map((run) => ({
      traceId: safeString(run.trace_id),
      durationSeconds: durationSeconds(run),
      tokens: tokenUsage(run),
    }))
    .sort((left, right) => right.tokens.total - left.tokens.total)
    .slice(0, 10)
  const tokens = traces.reduce(
    (sum, trace) => {
      sum.input += trace.tokens.input
      sum.output += trace.tokens.output
      sum.total += trace.tokens.total
      return sum
    },
    { input: 0, output: 0, total: 0 },
  )

  return {
    generatedAt: new Date().toISOString(),
    endpoint: safeEndpoint(settings.apiUrl),
    project: scrubSecrets(settings.project).slice(0, 500),
    scope,
    window: traces.length
      ? { newest: traces[0].startedAt, oldest: traces.at(-1).startedAt }
      : undefined,
    summary: {
      traces: traces.length,
      successful: traces.filter((trace) => trace.status === "success").length,
      failed: traces.filter((trace) => trace.status === "error").length,
      pending: traces.filter((trace) => trace.status === "pending").length,
      llmCalls: traces.reduce((sum, trace) => sum + trace.llmCalls, 0),
      toolCalls: traces.reduce((sum, trace) => sum + trace.toolCalls, 0),
      subagentInvocations: subagents.length,
      uniqueSubagents: new Set(subagents.map((subagent) => subagent.id)).size,
      errors: traces.reduce((sum, trace) => sum + trace.errors, 0),
      tokens,
    },
    traces,
    subagents,
    errors,
    orchestrationEvents,
    toolUsage,
    slowestRuns,
    heaviestLlmRuns,
  }
}

async function runSubagent(client, settings, options) {
  const matchingRoots = await collect(
    client.listRuns({
      projectName: settings.project,
      order: "desc",
      limit: MAX_LIMIT,
      filter: metadataFilter({ ls_subagent_id: options.id }),
      select: runSelect(options.includeContent),
    }),
  )
  if (!matchingRoots.length) {
    throw new Error(
      `no nested runs found for OpenCode subagent ${safeString(options.id)}; child sessions share their parent's LangSmith thread, and pre-integration sessions cannot be resolved`,
    )
  }

  const scans = new Map()
  for (const traceId of new Set(matchingRoots.map((root) => root.trace_id ?? root.id))) {
    scans.set(
      traceId,
      await collectBounded(
        client.listRuns({
          projectName: settings.project,
          traceId,
          order: "asc",
          select: runSelect(options.includeContent),
        }),
        MAX_TRACE_RUNS,
      ),
    )
  }

  const entries = matchingRoots.map((matchingRoot) => {
    const scan = scans.get(matchingRoot.trace_id ?? matchingRoot.id)
    const scannedRoot = scan.values.find((run) => run.id === matchingRoot.id)
    const root = scannedRoot ?? matchingRoot
    const subtree = scan.values.filter(
      (run) => run.id === root.id || run.parent_run_ids?.includes(root.id),
    )
    if (!subtree.some((run) => run.id === root.id)) subtree.unshift(root)
    return {
      root,
      runs: subtree.slice(0, options.limit),
      runsTruncated: scan.truncated || subtree.length > options.limit,
    }
  })
  const parentTraceIds = [
    ...new Set(matchingRoots.map((root) => safeString(root.trace_id)).filter(Boolean)),
  ]
  const parentThreadIds = [
    ...new Set(matchingRoots.map((root) => safeString(metadata(root).thread_id)).filter(Boolean)),
  ]
  const review = buildReview(
    settings,
    {
      subagentId: safeString(options.id),
      invocationCount: matchingRoots.length,
      parentTraceIds,
      parentThreadIds,
      truncatedParentTraceScans: [...scans.values()].filter((scan) => scan.truncated).length,
    },
    entries,
  )
  if (!options.includeContent) return review

  const preview = contentPreviewer()
  return {
    ...review,
    traceContent: entries.map(({ root, runs }) => ({
      subagentRunId: root.id,
      parentTraceId: root.trace_id,
      runs: runs.map((run) => renderRun(run, preview)),
    })),
  }
}

function contentPreviewer() {
  let remaining = CONTENT_BUDGET
  return (value) => {
    if (value == null) return undefined
    if (remaining <= 0) return { omitted: true, reason: "content budget exhausted" }
    const serialized = scrubSecrets(JSON.stringify(value))
    const allowed = Math.min(remaining, CONTENT_ITEM_LIMIT)
    const preview = serialized.slice(0, allowed)
    remaining -= preview.length
    return { preview, truncated: preview.length < serialized.length }
  }
}

function renderRun(run, preview) {
  return {
    id: safeString(run.id),
    traceId: safeString(run.trace_id),
    parentRunId: safeString(run.parent_run_id),
    name: scrubSecrets(run.name ?? "unknown").slice(0, 200),
    runType: run.run_type,
    startedAt: asIso(run.start_time),
    durationSeconds: durationSeconds(run),
    status: run.error ? "error" : run.end_time ? "success" : "pending",
    error: run.error ? scrubSecrets(run.error).slice(0, 500) : undefined,
    tokens: run.run_type === "llm" ? tokenUsage(run) : undefined,
    metadata: selectedMetadata(run),
    ...(preview ? { inputs: preview(run.inputs), outputs: preview(run.outputs) } : {}),
  }
}

export function traceIdFrom(value) {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
  const runPath = value.match(new RegExp(`/r/(${uuid.source})`, "i"))
  if (runPath) return runPath[1]
  return [...value.matchAll(uuid)].at(-1)?.[0] ?? value
}

async function runRecent(client, settings, options, cwd) {
  const repository = options.repository ?? (options.allRepositories ? undefined : currentRepository(cwd))
  const scope = options.allRepositories
    ? { allRepositories: true }
    : repository
      ? { repositoryName: safeString(repository) }
      : { cwd: safeString(resolve(cwd)) }
  const filter = options.allRepositories
    ? undefined
    : metadataFilter(repository ? { repository_name: repository } : { cwd: resolve(cwd) })
  const roots = await collect(
    client.listRuns({
      projectName: settings.project,
      isRoot: true,
      order: "desc",
      limit: options.limit,
      select: METADATA_SELECT,
      ...(filter ? { filter } : {}),
    }),
  )
  return buildReview(settings, scope, await tracesWithRuns(client, settings.project, roots))
}

async function runThread(client, settings, options) {
  const roots = await collect(
    client.listRuns({
      projectName: settings.project,
      isRoot: true,
      order: "desc",
      limit: options.limit,
      filter: metadataFilter({ thread_id: options.id }),
      select: runSelect(options.includeContent),
    }),
  )
  const entries = await tracesWithRuns(client, settings.project, roots, options.includeContent)
  const review = buildReview(
    settings,
    { threadId: safeString(options.id) },
    entries,
  )
  if (!options.includeContent) return review

  const preview = contentPreviewer()
  return {
    ...review,
    traceContent: entries.map(({ root, runs }) => ({
      traceId: root.id,
      runs: runs
        .sort((left, right) => String(left.dotted_order).localeCompare(String(right.dotted_order)))
        .map((run) => renderRun(run, preview)),
    })),
  }
}

export async function runAgent(client, settings, options, dependencies = {}) {
  const env = dependencies.env ?? process.env
  const requestedAgentId = options.id ?? env.PASEO_AGENT_ID
  const agentId = requestedAgentId
  if (!agentId) {
    throw new Error("agent requires a Paseo agent ID or PASEO_AGENT_ID in the environment")
  }
  const queryLimit = Math.min(options.limit + 1, MAX_LIMIT)
  let matchingRoots = await collect(
    client.listRuns({
      projectName: settings.project,
      isRoot: true,
      order: "desc",
      limit: queryLimit,
      filter: metadataFilter({ paseo_agent_id: agentId }),
      select: METADATA_SELECT,
    }),
  )
  let resolvedAgentId = agentId
  let threadId
  if (!matchingRoots.length) {
    const resolved = resolvePaseoAgentSession(agentId, {
      env,
      agentsRoot: dependencies.agentsRoot,
    })
    if (!resolved) {
      throw new Error(
        `no traces found for Paseo agent ${safeString(agentId)} and no local OpenCode session mapping is available`,
      )
    }
    resolvedAgentId = resolved.agentId
    threadId = resolved.threadId
    matchingRoots = await collect(
      client.listRuns({
        projectName: settings.project,
        isRoot: true,
        order: "desc",
        limit: queryLimit,
        filter: metadataFilter({ thread_id: threadId }),
        select: METADATA_SELECT,
      }),
    )
    if (!matchingRoots.length) {
      throw new Error(
        `no traces found for Paseo agent ${safeString(resolvedAgentId)} or its OpenCode thread ${safeString(threadId)}`,
      )
    }
  }
  const pendingRoots = matchingRoots.filter((root) => !root.end_time)
  const roots = matchingRoots.filter((root) => root.end_time).slice(0, options.limit)
  if (!roots.length) {
    throw new Error(
      `no completed traces found for Paseo agent ${safeString(agentId)}; ${pendingRoots.length} matching trace(s) are still in progress`,
    )
  }
  return buildReview(
    settings,
    {
      paseoAgentId: safeString(resolvedAgentId),
      ...(threadId ? { threadId: safeString(threadId), lookup: "paseo-local-session" } : {}),
      completedOnly: true,
      excludedPendingTraces: pendingRoots.length,
    },
    await tracesWithRuns(client, settings.project, roots),
  )
}

async function runTrace(client, settings, options) {
  const requestedId = traceIdFrom(options.id)
  const requested = await collect(
    client.listRuns({
      projectName: settings.project,
      id: [requestedId],
      limit: 1,
      select: METADATA_SELECT,
    }),
  )
  if (!requested.length) throw new Error(`run not found: ${requestedId}`)
  const traceId = requested[0].trace_id ?? requested[0].id
  const select = runSelect(options.includeContent)
  const [rootRuns, queried] = await Promise.all([
    collect(
      client.listRuns({ projectName: settings.project, id: [traceId], limit: 1, select }),
    ),
    collect(
      client.listRuns({
        projectName: settings.project,
        traceId,
        order: "asc",
        limit: options.limit,
        select,
      }),
    ),
  ])
  if (!rootRuns.length) throw new Error(`trace root not found: ${traceId}`)
  const byId = new Map([[rootRuns[0].id, rootRuns[0]]])
  for (const run of queried) byId.set(run.id, run)
  const ordered = [...byId.values()].sort((left, right) =>
    String(left.dotted_order).localeCompare(String(right.dotted_order)),
  )
  const root = rootRuns[0]
  const preview = options.includeContent ? contentPreviewer() : undefined

  return {
    generatedAt: new Date().toISOString(),
    endpoint: safeEndpoint(settings.apiUrl),
    project: scrubSecrets(settings.project).slice(0, 500),
    scope: { traceId },
    trace: summarizeTrace(root, ordered),
    runsTruncated: queried.length === options.limit,
    runs: ordered.map((run) => renderRun(run, preview)),
  }
}

export function serializeBounded(value, maxBytes = MAX_OUTPUT_BYTES) {
  const full = JSON.stringify(value, null, 2)
  const originalBytes = Buffer.byteLength(full)
  if (originalBytes <= maxBytes) return full

  const envelope = {
    generatedAt: value.generatedAt,
    endpoint: value.endpoint,
    project: value.project,
    scope: value.scope,
    summary: value.summary,
    outputTruncated: true,
    originalBytes,
    preview: "",
  }
  let previewLength = Math.min(full.length, Math.floor(maxBytes / 2))
  while (previewLength > 0) {
    envelope.preview = full.slice(0, previewLength)
    const serialized = JSON.stringify(envelope, null, 2)
    if (Buffer.byteLength(serialized) <= maxBytes) return serialized
    previewLength = Math.floor(previewLength * 0.8)
  }

  return JSON.stringify({ outputTruncated: true, originalBytes })
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv)
  if (options.help) {
    console.log(usage)
    return
  }

  const cwd = dependencies.cwd ?? process.cwd()
  const settings = dependencies.settings ?? resolveSettings({ cwd })
  const client = dependencies.client ?? (await createClient(settings))
  let result
  if (options.command === "recent") {
    result = await runRecent(client, settings, options, cwd)
  } else if (options.command === "agent") {
    result = await runAgent(client, settings, options, dependencies)
  } else if (options.command === "subagent") {
    result = await runSubagent(client, settings, options)
  } else if (options.command === "thread") {
    result = await runThread(client, settings, options)
  } else {
    result = await runTrace(client, settings, options)
  }
  console.log(serializeBounded(result))
}

const selfPath = pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href
const entry = process.argv[1]
  ? pathToFileURL(realpathSync(resolve(process.argv[1]))).href
  : undefined
if (entry === selfPath) {
  main().catch((error) => {
    console.error(
      serializeBounded({
        generatedAt: new Date().toISOString(),
        error: `langsmith-review: ${scrubSecrets(error?.message ?? error)}`,
      }),
    )
    process.exitCode = 1
  })
}
