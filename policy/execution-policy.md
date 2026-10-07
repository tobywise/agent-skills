# Global execution policy

## Running checks

- Before running any test suite, build, type check, dependency install, migration, Docker build, or other expensive command, load the `run-checks` skill and follow it. It decides whether checks run locally or on remote workers.
- If `cbrun` is on `PATH`, this machine is a controller for remote workers: never run those commands directly on it, unless the project's agent instructions say its checks run locally.
- Do not install or synchronize dependencies during an implementation pass, except the project-locked setup that `run-checks` allows.

## Reviews

- Use `review-implementation` to assess code or pull requests, including when
  the user also asks to post the review on GitHub. Use `github-pr-review` only
  to format and publish the completed assessment when posting is requested.
- During a review, do not run tests unless the user explicitly approves test
  execution for that review. Asking to review, verify, or post findings does
  not grant that approval. Read existing tests and recorded results instead.
- Approval remains valid for its stated scope; do not ask again for an already
  approved test run. Follow `run-checks` for authorized runs. Do not delegate
  unapproved tests to another agent or trigger them through CI or another tool.
- Report tests not run and any resulting limits on the review. Do not stop an
  otherwise useful review merely because tests were not authorized.

## Keep tests small and useful

- Add a test only when it protects a meaningful scientific result, required behavior, or a plausible failure that existing tests do not cover.
- Before adding a test, inspect nearby coverage. Prefer extending or replacing an existing test over adding overlapping tests.
- Do not add tests merely to exercise each new function, mirror the implementation, or check trivial details.
- For each new test, state the failure it would catch and why existing tests would miss it. If that justification is weak, omit the test.
- Use the smallest dataset and fewest repetitions that still expose the failure. Preserve the scientific properties needed to make the check meaningful.
- Keep computationally demanding tests out of the routine suite unless their cost is justified by the failures they detect. Give them a separate command and state when they must run.
- When changing tested behavior, remove obsolete coverage and consolidate overlapping tests.
- Scientific validity checks and fail-fast behavior remain mandatory in the analysis itself; tests do not replace them.

## Pull requests

- Before drafting or updating a pull request description — including a first `gh pr create`, a later `gh pr edit`, or any other point where PR body text gets written — apply the `pr-description` skill's drafting standard.
- Load that skill and apply it directly in the current session. Do not delegate it to a subagent or treat it as a separate command a user has to invoke.
- This applies whenever a PR is being opened or its description written, in any project, not only when the user explicitly asks for a PR description.

## Plain language

- Readers are scientists, not software engineers. Write everything a person reads in plain English (ISO 24495-1): docs, comments, docstrings, messages, and the names of functions, variables, and files.
- Scientific terms are fine; software-engineering jargon is not. Say what the code does, and name things after what they mean in the analysis, not after software patterns (for example, "participant data", not "data manager"). Follow the project's existing naming style.
- Apply this to new or changed text; do not rename existing public names unless asked.

## Didactic inline comments

- Use a teaching style: help a scientist follow the analysis even if they are unfamiliar with the code or method. At important steps, explain what the step does, why it is needed, and how it affects the result or its interpretation.
- Introduce the relevant scientific idea before a non-obvious calculation. Explain assumptions, units, thresholds, numerical choices, and constraints where they matter, including the reason for a validity check and what its failure means.
- Connect the explanation to the quantities in the code. Use a small concrete example when it helps; for example, "Subtract the mean so zero represents the average observed value."
- Put short explanations just above the relevant step or beside a short expression. For a calculation with several conceptual steps, use a few ordered comments to guide the reader through the reasoning.
- Keep explanations concise and focused on understanding. Avoid narrating every line, repeating syntax, or copying whole docstrings; explain familiar operations when their scientific purpose or consequences need clarification.
- Keep comments accurate when changing the code; update or remove explanations that no longer apply.

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

- In supported scientific workflows, a failed or invalid computation is an `IMPLEMENTATION` failure, even when diagnostics or model comparison are otherwise `INTERPRETATION`. This includes fit errors, invalid or missing required estimates, failed required diagnostics, explicit validity-gate failures, and incomplete required candidate sets.
- Fail at first detection with an exception or nonzero exit. Identify the failed stage or candidate, preserve the cause, and do not treat partial outputs as successful.
- Never catch-and-warn, skip the failed unit, substitute another model or settings, continue with an incomplete candidate set, or ask whether to proceed. Exhausted method-defined retries must fail.
- A computation that completes validly but produces poor fit or unfavorable evidence remains a scientific result unless an explicit validity gate says otherwise.
- Non-convergence is not fatal by default. It is useful evidence for model selection and development, for example that a model is poorly identified. Record it for each fit and report it visibly with that fit's results; never hide it, silently drop the fit, or silently change settings to make it converge. It fails only when an explicit validity gate requires convergence.
- Plans, implementations, reviews, and orchestration must enforce this rule. Never downgrade a scientific validity failure to `INTERPRETATION`, `UNVERIFIED`, deferred work, a warning, or residual risk.

## Scientific prototype workflow

- A run of the `prototype` skill that declares `WORKFLOW: RAPID_SCIENTIFIC_PROTOTYPE` may relax this policy's rules on plans, unit tests, the full suite, Python docstrings, and dependency declarations, exactly as that skill specifies. Follow the skill for everything else about prototypes.
- Scientific fail-fast rules, the dependency rule above, and the `run-checks` rules remain fully in force.

## Completion criteria

These apply to the session that coordinates the work, normally the main session. An implementer never reports work complete: it may run the plan's targeted checks, then hands over with their results and anything still unverified, and the coordinating session runs the final verification.

For review-only tasks, the review rules above govern test execution. Inspect
existing evidence and report checks not run; the completion criteria below do
not authorize running tests during a review.

Before reporting implementation work complete:

1. Run a targeted selection of tests while iterating, following `run-checks`.
2. Once the code is stable, run the full suite once, following `run-checks`. A passing run on unchanged code can be reused; work with no executable behavior, such as documentation only, is exempt. Also run broader or expensive checks, such as demanding tests kept out of the routine suite, when the affected scientific computation or shared behavior warrants them.
3. Report the exact command, result, and any relevant checks not run.
4. Distinguish test failure from environment, infrastructure, timeout, or cancellation failure.
