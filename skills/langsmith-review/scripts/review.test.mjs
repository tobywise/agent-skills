import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  resolvePaseoAgentSession,
  runAgent,
} from "./review.mjs"

function paseoFixture() {
  const root = mkdtempSync(join(tmpdir(), "langsmith-review-"))
  const agentsRoot = join(root, "agents")
  const directory = join(agentsRoot, "workspace")
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    join(directory, "923803e2-cfac-4bd4-b14c-7dbc2d1f2a45.json"),
    JSON.stringify({
      id: "923803e2-cfac-4bd4-b14c-7dbc2d1f2a45",
      provider: "opencode",
      runtimeInfo: { sessionId: "ses_example" },
    }),
  )
  return { root, agentsRoot }
}

test("resolves full and short Paseo agent IDs to their OpenCode session", () => {
  const fixture = paseoFixture()
  try {
    const expected = {
      agentId: "923803e2-cfac-4bd4-b14c-7dbc2d1f2a45",
      threadId: "ses_example",
    }
    for (const agentId of ["923803e", expected.agentId]) {
      assert.deepEqual(resolvePaseoAgentSession(agentId, fixture), expected)
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("agent review falls back from missing metadata to the Paseo OpenCode thread", async () => {
  const fixture = paseoFixture()
  const root = {
    id: "trace-1",
    trace_id: "trace-1",
    start_time: "2026-08-24T12:00:00.000Z",
    end_time: "2026-08-24T12:01:00.000Z",
    extra: { metadata: { thread_id: "ses_example" } },
  }
  const filters = []
  const client = {
    async *listRuns(options) {
      if (options.filter) filters.push(options.filter)
      if (options.filter?.includes("paseo_agent_id")) return
      if (options.filter?.includes("thread_id")) {
        yield root
        return
      }
      if (options.traceId === "trace-1") yield root
    },
  }

  try {
    const review = await runAgent(
      client,
      { project: "opencode", apiUrl: "https://api.smith.langchain.com" },
      { id: "923803e", limit: 20 },
      { agentsRoot: fixture.agentsRoot, env: {} },
    )

    assert.equal(review.summary.traces, 1)
    assert.deepEqual(review.scope, {
      paseoAgentId: "923803e2-cfac-4bd4-b14c-7dbc2d1f2a45",
      threadId: "ses_example",
      lookup: "paseo-local-session",
      completedOnly: true,
      excludedPendingTraces: 0,
    })
    assert.equal(filters.length, 2)
    assert.match(filters[0], /paseo_agent_id/)
    assert.match(filters[1], /thread_id/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
