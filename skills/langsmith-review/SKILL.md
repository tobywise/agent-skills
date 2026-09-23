---
name: langsmith-review
description: Review LangSmith traces, runs, threads, and OpenCode or Paseo sessions through the read-only helper. Use when asked to inspect, diagnose, summarize, compare, or query LangSmith activity, latency, token usage, tool calls, or errors.
metadata:
  compatibility: claude-code, codex, opencode, agent-skills
  summary: Safely review OpenCode and Paseo activity recorded in LangSmith.
  audience: software-engineers
  workflow: observability
---

# LangSmith Review

Use the bundled helper for read-only LangSmith reviews. Do not invent ad hoc API
calls when the helper covers the request.

## Data model

Interpret the integration as follows:

| OpenCode and Paseo | LangSmith |
| --- | --- |
| OpenCode integration | Project, normally `opencode` |
| Repository | Root-run metadata `repository_name` and `cwd` |
| Paseo agent or OpenCode session | Thread |
| One user turn | Trace |
| Task-created child session | Nested `opencode.session` run in the parent trace |
| Model response or tool call | Run |

Useful root metadata includes `repository_name`, `cwd`, `git_branch`,
`thread_id`, `turn_number`, `paseo_agent_id`, and `paseo_agent_cwd`.
Nested child roots are identified by `ls_subagent_id` and
`ls_subagent_type`. A child session shares its root session's `thread_id`; its
OpenCode session ID is not a standalone LangSmith thread ID.

## Safety

- Use read-only queries. Never create, update, delete, share, or add feedback to
  LangSmith records unless the user explicitly requests that separate action.
- Never print API keys, authorization headers, or complete process environments.
- Do not place credentials in command arguments or temporary files.
- Inputs and outputs are neither requested nor returned by default. Use
  `--include-content` only when content is needed for the requested diagnosis;
  previews remain bounded and redacted.
- Every helper response is capped at 30,000 serialized bytes, and parent-trace
  scans are capped at 1,000 runs. A larger response returns
  `outputTruncated: true` with a bounded preview; a capped scan reports
  `runsTruncated` or `truncatedParentTraceScans`.
- Treat trace content as potentially sensitive even after automatic redaction.
- A turn currently in progress may be absent or appear as pending until the
  tracer flushes. Agent debriefs exclude pending traces and report the count;
  do not diagnose that expected delay as missing telemetry.

## Helper

The helper is located at:

```text
~/.agents/skills/langsmith-review/scripts/review.mjs
```

It reads endpoint and project settings from the global and project-local
`langsmith.json` files, with the same environment-variable precedence used by
the plugin. It reads the API key from the environment without displaying it and
reuses the LangSmith SDK installed with `@langchain/langsmith-opencode`.

### Review recent traces for the current repository

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs recent --limit 20
```

The helper derives `repository_name` from the current Git remote. If no remote
is available, it filters on the current working directory.

Use an explicit repository or review all repositories when needed:

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs recent --repository owner/repository --limit 20
node ~/.agents/skills/langsmith-review/scripts/review.mjs recent --all-repositories --limit 20
```

### Review a Paseo agent

With no explicit ID, the helper uses `PASEO_AGENT_ID` from the current process:

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs agent --limit 100
node ~/.agents/skills/langsmith-review/scripts/review.mjs agent <paseo-agent-id> --limit 100
```

Agent lookup first uses trace metadata, then falls back to the OpenCode session
recorded in local Paseo state. Full Paseo IDs and unambiguous ID prefixes are
accepted. The fallback queries that OpenCode session's LangSmith thread, so it
also supports traces created without `paseo_agent_id` metadata.

### Review a thread

Use the `threadId` returned by `recent`:

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs thread <thread-id> --limit 20
```

### Review a task-created subagent

Use the OpenCode child session ID returned by `task`. The helper locates its
nested root through `ls_subagent_id` and returns only that child subtree, not
the rest of the parent trace:

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs subagent <opencode-session-id>
node ~/.agents/skills/langsmith-review/scripts/review.mjs subagent <opencode-session-id> --include-content
```

Do not pass a task-created child session ID to `thread`; nested subagents share
the parent session's thread. Recent, agent, and thread reviews expose a
`subagents` inventory that supplies IDs for focused child review.

### Review one trace

Use the trace UUID or a LangSmith URL containing it:

```bash
node ~/.agents/skills/langsmith-review/scripts/review.mjs trace <trace-id>
node ~/.agents/skills/langsmith-review/scripts/review.mjs trace <trace-id> --include-content
```

## Review workflow

1. Start with `recent`, normally scoped to the current repository.
2. Record the returned project, scope, UTC time window, and trace count.
3. Identify failures, pending traces, unusually slow traces, concentrated token
   usage, repeated tools, and tool errors.
4. Distinguish model or tool latency from `question` runs that waited for a user.
5. Use `thread` to inspect a multi-turn root session, `subagent` for a
   task-created child session, and `trace` for the complete parent run tree.
6. Request bounded content only when metadata and errors cannot explain the
   behavior.
7. Report confirmed findings separately from interpretation and note sampling
   limits or truncated traces.

## Debriefs and postmortems

Use the global `/debrief` command for a structured, read-only report. The
default target is the current Paseo agent's completed turns. A command invoked
inside that agent excludes its own in-progress turn if visible and may not see
it before flush, so label the latest completed cutoff.
For a complete postmortem, run `/debrief postmortem agent <id>` from a fresh
agent after the target becomes idle.

When an orchestration trace contains implementer, reviewer, planner, or other
child work, use the returned `subagents` inventory and run `subagent <id>` for
each material child. Do not report a child as missing merely because `thread
<child-session-id>` returns no roots.

If the helper cannot resolve the SDK, confirm that the LangSmith OpenCode plugin
is installed and restart OpenCode. Do not install or upgrade dependencies during
a review pass.
