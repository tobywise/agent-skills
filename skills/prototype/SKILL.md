---
name: prototype
description: Build and optionally run one rapid, exploratory, single-use scientific analysis prototype, without production engineering ceremony. Use when the user wants a quick exploratory analysis, a throwaway scientific prototype, or invokes /prototype.
---

# Prototype

`WORKFLOW: RAPID_SCIENTIFIC_PROTOTYPE`

Build one exploratory scientific analysis prototype in the current repository,
for the request the user supplied. Plan inline, implement directly, self-review,
and report. Work in one session: don't delegate, create a plan file, commit, or
open a PR.

This workflow asks the user questions, so run it in the main session, not as a
delegated background task.

## Scope and brief

Load `scientific-analysis`. Accept one coherent, single-use analysis whose
result is explicitly exploratory. Route reusable infrastructure, production or
scheduled pipelines, migrations, public interfaces, security-sensitive
behavior, and clinical, regulatory, publication-ready or other decision-critical
outputs to `/create-plan` instead.

If the request names or attaches a plan or specification, read it fully before
writing the brief, treat it as context only, and never modify it. Stop if it
can't be read. Don't reject the prototype solely because the source describes
production or reusable work.

Inspect the repository, input data that can be read safely, and
`git status --short`. Preserve unrelated work. Resolve the objective, input
identity and coding, transformations, analyses or estimands, material
assumptions, validity conditions, outputs, artifact paths, runtime, and
dependencies. Ask one concise scientific question rather than guessing when a
choice would change the meaning of the result.

Before editing, state a compact inline brief with `OBJECTIVE`, `INPUTS`,
`TRANSFORMATIONS`, `ANALYSES`, `VALIDITY`, `OUTPUTS`, and `ALLOWED_PATHS`. Then
**always ask the user to choose execution for this run**: bounded Crabbox now,
an exact user/HPC handoff, or implementation without execution. Recommend one
from the runtime and artifact needs you inspected.

## Implementation and execution

Prefer one transparent sequential entrypoint and the smallest useful edit. A
durable plan, unit tests, a full suite, reusable APIs, packaging, generalized
validation, broad documentation, Python docstrings, compatibility behavior,
production hardening, and unrelated cleanup are not required unless the user
asks for them or the analysis needs them to run correctly. Normal
application paths and dependency declarations are allowed when needed, but
disclose them. Never install or synchronize dependencies on the controller or
perform ad hoc or unlocked setup; project-locked setup performed by `cbrun-uv`
on a disposable worker is allowed. Never migrate data or schemas, deploy, or
mutate external systems.

Stay strict about data identity and coding, equations, likelihoods and
transforms, required candidates and estimands, seeds, package and runtime
identity, supported outputs, reproducibility, and visible failure. A required
fit error, non-convergence, invalid or missing estimate, failed validity gate,
or incomplete candidate set must raise or exit nonzero. Never catch-and-warn,
skip, substitute a method, or present partial output as success.

Inspect the completed diff and self-audit the scientific path before execution.
For bounded execution, use the project runner and at most two top-level `cbrun`
or `cbrun-uv` calls. The first runs the actual end-to-end analysis, not a
unit-test suite; that run is the verification, and must exercise the supported
input, transformations, computation, validity checks, and outputs, and report
its runtime identity. Source inspection or a static check cannot establish
computation success. A second is allowed only after a code edit that fixes one clear
implementation defect without changing scientific semantics. Never rerun
unchanged work, or retry an infrastructure failure as though it were a
computation failure.

The run must emit a bounded result and diagnostic summary and export required
artifacts before exiting. Treat worker-only files as lost. For user/HPC
execution, return the exact command, runtime assumptions, and expected
artifacts, and don't claim computation success until the user makes the results
available. Implementation-only work is explicitly `NOT_RUN`.

## Review and report

Review the code, run output, and available artifacts yourself. Check data
coding, transformations, model specification, completeness of required results,
validity diagnostics, and agreement between outputs and claims. Ignore
software-quality concerns unless they could change the scientific result or
prevent the supported run.

Assess possible risks yourself rather than delegating. If a potentially
serious, result-changing risk can't be resolved directly, stop and route the
work to `/create-plan`.

Use the one correction allowance only for a local implementation defect. Never
change an estimand, model family, transformation, exclusion, threshold,
candidate set, or diagnostic rule after seeing results in this run — that needs
a fresh `/prototype` run with a new brief and execution choice. A valid but poor
or unfavorable result is an interpretation limitation, not an implementation
failure.

Finish with:

```text
PROTOTYPE_STATUS: COMPLETE | BLOCKED | AWAITING_HPC | NOT_RUN
EXECUTION_MODE:
COMPUTATION_STATUS: VALID | FAILED | NOT_RUN
RESULTS:
ARTIFACTS:
INTERPRETATION_LIMITATIONS:
CHANGED_PATHS:
DEPENDENCIES:
SHORTCUTS_AND_DEBT:
RERUN_COMMAND:
PRODUCTION_READY: NO
```

Report exact commands and exit status, distinguish infrastructure failure from
computation failure, and never call an unexecuted or invalid analysis complete.
