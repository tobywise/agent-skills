# Global execution policy

## Running checks

- Before running any test suite, build, type check, dependency install, migration, Docker build, or other expensive command, load the `run-checks` skill and follow it. It decides whether checks run locally or on remote workers.
- If `cbrun` is on `PATH`, this machine is a controller for remote workers: never run those commands directly on it, unless the project's agent instructions say its checks run locally.
- Do not install or synchronize dependencies during an implementation pass, except the project-locked setup that `run-checks` allows.

## Pull requests

- Before drafting or updating a pull request description — including a first `gh pr create`, a later `gh pr edit`, or any other point where PR body text gets written — apply the `pr-description` skill's drafting standard.
- Load that skill and apply it directly in the current session. Do not delegate it to a subagent or treat it as a separate command a user has to invoke.
- This applies whenever a PR is being opened or its description written, in any project, not only when the user explicitly asks for a PR description.

## Plain language

- Readers are scientists, not software engineers. Write everything a person reads in plain English (ISO 24495-1): docs, comments, docstrings, messages, and the names of functions, variables, and files.
- Scientific terms are fine; software-engineering jargon is not. Say what the code does, and name things after what they mean in the analysis, not after software patterns (for example, "participant data", not "data manager"). Follow the project's existing naming style.
- Apply this to new or changed text; do not rename existing public names unless asked.

## Browser automation

- Use Playwright only for web UI development or testing. It must be explicitly enabled by the web project's own agent configuration.

## Python projects

- Respect `.python-version` when present.
- Respect `requires-python` in `pyproject.toml`.
- Do not assume Python 3.12 when the project declares another version.
- Format changed Python files with the installed project-locked Black version before linting.
- If Black is unavailable, do not install it during implementation; report formatting as unverified.
- Give every new or materially changed function, method, and class a clear Google-style docstring that explains its operation.
- Document every input except `self` and `cls` in `Args`, and every returned or yielded value in `Returns` or `Yields`.

## Scientific fail-fast policy

- In supported scientific workflows, a failed or invalid computation is an `IMPLEMENTATION` failure, even when diagnostics or model comparison are otherwise `INTERPRETATION`. This includes fit errors, reported non-convergence, invalid or missing required estimates, failed required diagnostics, explicit validity-gate failures, and incomplete required candidate sets.
- Fail at first detection with an exception or nonzero exit. Identify the failed stage or candidate, preserve the cause, and do not treat partial outputs as successful.
- Never catch-and-warn, skip the failed unit, substitute another model or settings, continue with an incomplete candidate set, or ask whether to proceed. Exhausted method-defined retries must fail.
- A computation that completes validly but produces poor fit or unfavorable evidence remains a scientific result unless an explicit validity gate says otherwise.
- Plans, implementations, reviews, and orchestration must enforce this rule. Never downgrade a scientific validity failure to `INTERPRETATION`, `UNVERIFIED`, deferred work, a warning, or residual risk.

## Scientific prototype workflow

- A run of the `prototype` skill that declares `WORKFLOW: RAPID_SCIENTIFIC_PROTOTYPE` may relax this policy's rules on plans, unit tests, the full suite, Python docstrings, and dependency declarations, exactly as that skill specifies. Follow the skill for everything else about prototypes.
- Scientific fail-fast rules, the dependency rule above, and the `run-checks` rules remain fully in force.

## Completion criteria

These apply to the session that coordinates the work, normally the main session. An implementer told not to run anything never reports work complete: it hands over with its checks marked unverified, and the coordinating session then runs the final verification.

Before reporting work complete:

1. Run targeted checks while iterating.
2. Run one consolidated final verification command.
3. Report the exact command and result.
4. Distinguish test failure from environment, infrastructure, timeout, or cancellation failure.
