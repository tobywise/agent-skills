---
name: create-scientific-rework-plan
description: Audit an existing scientific codebase and plan a safe single-use rework. Use when asked to simplify, rework, or right-size an existing scientific analysis codebase, or when the user invokes /create-scientific-rework-plan.
---

# Create scientific rework plan

Inspect the existing codebase named by the user and create one
implementation-ready plan that reworks it into a proportionate single-use
scientific workflow. This selects `Review standard: SCIENTIFIC_ANALYSIS`, but do
not assume the requested delivery profile is feasible. Do not modify source,
tests, configuration, or an existing plan.

Before writing, inventory the supported entrypoints, actual and declared
consumers, stable public interfaces, repeated operational execution, data and
control flow, configuration surfaces, scientific computations, outputs,
reproducibility controls, and failure behavior. Verify repository facts with
read-only exploration rather than asking the user questions that the codebase
can answer.

Load `scientific-analysis` before applying this qualification gate. Apply its
current `REUSABLE` criteria and require a named present consumer or external
caller. A workflow with repeated operational execution by a named external
caller may qualify; repeated internal stages do not. If the evidence establishes
a current reusable criterion, create no plan. Return the criterion, consumer or
caller, and concise path-based evidence, then recommend normal `/create-plan`
planning with a `REUSABLE` profile. Ask one short question only when required
consumer or operational intent cannot be established from the repository or
conversation.

When the codebase qualifies, target `Delivery profile: SINGLE_USE`. Default to
`Validation: ONE_CALL`; use `STANDARD` only when one comprehensive
command cannot credibly prove all implementation acceptance items and relevant
regressions.

Load the `planning` skill, meet its full plan format, and add an **Existing
Codebase Audit** section. For each relevant surface, record path-based evidence, `KEEP`,
`SIMPLIFY`, or `REMOVE`, the target owner or flow, and required proof. Prove that
removed abstractions have no required consumers. Prefer one supported entrypoint
and transparent sequential data and control flow.

Preserve data identity and coding, equations, likelihood, transforms, required
estimands, seeds, package and runtime identity, supported outputs,
reproducibility, visible failure, and scientific validity. Never use source
inspection alone as proof of a core scientific result. Never remove a required
validity check, convert a failed required computation into a warning, or treat
poor but valid evidence as an implementation failure without an explicit gate.

Do not create a separate audit artifact, public API, generic configuration
framework, registry, plugin surface, compatibility layer, scheduler abstraction,
task manifest, receipt framework, duplicated provenance validator, or
unsupported-use UX. If a coherent safe rework exceeds the single-use tripwires,
recommend an approved vertical split through `/create-multiple-plans` and stop
instead of forcing one oversized plan.

After writing, return only the created plan path and one concise summary.
