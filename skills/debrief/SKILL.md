---
name: debrief
description: Produce an evidence-based LangSmith debrief or incident postmortem for a Paseo agent, thread, or repository. Use when asked to debrief a run, diagnose what happened in an agent session, or write a postmortem.
---

# Debrief

Produce a read-only LangSmith-backed debrief for the target the user supplied.

Load the `langsmith-review` skill before querying anything. Do not edit files,
write a report artifact, mutate LangSmith records, or expose credentials.

Interpret the arguments as follows:

- No arguments: debrief the current Paseo agent with `review.mjs agent --limit 100`.
- `agent <id>` or a bare Paseo agent ID: debrief that agent.
- `subagent <id>`: debrief a task-created OpenCode child session nested in its
  parent trace.
- `thread <id>`: debrief that LangSmith thread.
- `repo <owner/repository>`: debrief the 20 most recent repository traces.
- Optional leading `postmortem`: use the incident-focused format below.
- Optional `limit <N>`: use that bounded limit instead of the default.

For an agent target, use `paseo inspect <id> --json` when available to confirm
its name, status, and working directory. Never print the complete environment.
Pass the supplied full or short Paseo ID to `review.mjs agent`; the helper
resolves a missing `paseo_agent_id` through the agent's local OpenCode session.
If the target is still running, state that the report is partial. Agent mode
excludes pending traces and reports how many were excluded. When this targets
its own current agent, explain that the debrief turn may be absent or pending
until flush and give the latest completed trace cutoff.

Start with metadata-only helper output. Drill into relevant threads and traces
without content first. Use `--include-content` only when metadata, errors, and
run structure cannot support the requested diagnosis. Treat missing agent-level
records as a possible pre-restart metadata gap; do not silently substitute an
unrelated repository or thread.

Task-created child sessions are nested runs, not standalone LangSmith threads.
Use the helper's `subagents` inventory and query each material child with
`review.mjs subagent <child-session-id>`; never query a child session ID with
`thread`. Include implementer, reviewer, planner, and remediation work when it
is material to the outcome. If `subagent` finds no nested root, classify it as
missing or pre-integration telemetry only after confirming the ID and parent
trace; do not infer that result from an empty child-thread query.

Ground every substantive claim in returned metrics, trace IDs, thread IDs, or
Paseo evidence. Distinguish confirmed root causes from contributing factors and
plausible interpretations. Separate user waiting in question runs from model or
tool latency. Do not treat a nonzero diagnostic command as product failure
without checking its context.

Return an inline report with these sections:

## Executive summary

State the objective, outcome, and most important lesson in plain language.

## Scope and evidence

Record target identifiers, repository, UTC time window, trace and run counts,
cutoff, truncation, missing telemetry, and whether the target was still active.

## Outcome versus objective

Explain what was attempted, what completed, and what remained unresolved. Do
not infer completion only from a successful trace status.

## Timeline

Summarize material turns and pivots in chronological order. Reference trace or
thread IDs without reproducing full prompts.

## What worked

Identify effective decisions, tools, safeguards, and validation with evidence.

## Friction and failures

Cover errors, retries, permission blocks, infrastructure failures, unnecessary
work, repeated investigation, and misleading signals. Distinguish symptoms from
causes.

## Efficiency

Report latency, token concentration, model/tool call counts, repeated tools, and
user-wait time. Highlight outliers rather than listing every run.

## Root causes and contributing factors

For each confirmed cause, show the evidence and causal link. Label uncertain
explanations explicitly.

## Actions

Provide a short table with priority, action, evidence/rationale, and a concrete
verification step. Do not invent owners or deadlines.

## Limitations

State sampling limits, unavailable content, pre-restart traces, in-progress
turns, truncation, or evidence that could not be verified.

In `postmortem` mode, additionally include impact, detection, recovery, and
prevention under the relevant sections. Keep a normal debrief proportionate;
the absence of an incident does not require incident language.
