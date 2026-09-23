# Global execution policy

This policy has two parts. Part 1 applies on any machine. Part 2 describes this
machine's controller and Crabbox worker setup; drop it on a machine without
Crabbox.

# Part 1: General and scientific rules

## Pull requests

- Before drafting or updating a pull request description — including a first `gh pr create`, a later `gh pr edit`, or any other point where PR body text gets written — apply the `pr-description` skill's drafting standard.
- Load that skill and apply it directly in the current session. Do not delegate it to a subagent or treat it as a separate command a user has to invoke.
- This applies whenever a PR is being opened or its description written, in any project, not only when the user explicitly asks for a PR description.

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
- Scientific fail-fast rules, the controller's no-install rule, and the Crabbox limits in Part 2 remain fully in force.

## Completion criteria

These apply to the session that coordinates the work, normally the main session. An implementer told not to run anything never reports work complete: it hands over with its checks marked unverified, and the coordinating session then runs the final verification.

Before reporting work complete:

1. Run targeted checks while iterating.
2. Run one consolidated final verification command.
3. Report the exact command and result.
4. Distinguish test failure from provisioning, sync, timeout, or cancellation failure.

# Part 2: This machine — controller and Crabbox workers

## Controller and workers

- This machine is the always-on controller.
- Use it for editing, Git operations, planning, and orchestration.
- Do not run test suites, builds, type checks, dependency installs, migrations, Docker builds, or other expensive validation locally.
- Lightweight project-declared linters and formatters may run locally on changed files before remote verification.
- Use the project-locked version when installed; do not install or synchronize dependencies during an implementation pass.
- Run bounded versions of those commands on Crabbox workers under the limits below.
- The checkout on the controller is the source of truth. Crabbox workers are disposable; do not leave important source changes only on a worker.

## Crabbox limits

- Use Crabbox only for bounded development checks that fit within the configured 30-minute lease, including provisioning, sync, setup, execution, and artifact export.
- Never override Crabbox provisioning settings or invoke raw `crabbox run` or `crabbox warmup`.
- Do not run intensive scientific analyses on Crabbox. Stop and ask the user to run them on HPC, providing the exact command and expected artifacts.
- Treat every worker and retry as clean and disposable. Do not rely on installed tools, caches, or worker-only outputs.
- If a check cannot fit or a required capability is unavailable, stop and ask rather than requesting a larger or longer-lived worker.

## Required wrappers

Use `cbrun [--once] COMMAND ...` for general remote commands.

For Python projects with both `pyproject.toml` and `uv.lock`, prefer `cbrun-uv [--once] COMMAND ...` and run Python tools through `uv run`.

Do not invoke raw `crabbox run` or `crabbox warmup`. Read-only raw Crabbox diagnostics are allowed only when explicitly debugging infrastructure. Do not nest wrappers.

Correct:

```bash
cbrun make test
cbrun-uv uv run pytest
```

Incorrect:

```bash
cbrun bash -lc 'cbrun-uv uv run pytest'
cbrun cbrun-uv uv run pytest
```

`cbrun-uv` already invokes `cbrun`.

## Reusable versus one-shot runs

Use the default reusable mode when another edit/test cycle is likely:

```bash
cbrun make test
cbrun-uv uv run pytest
```

Use `--once` for one isolated validation command:

```bash
cbrun --once make test
cbrun-uv --once uv run pytest
```

Do not use several separate one-shot commands for related checks. Batch them into one invocation.

## Python on workers

- Prefer `cbrun-uv` when its project requirements are present.
- Do not rely on the controller's `.venv`; it is not synced to workers.

## R quick checks

- Use the digest-pinned image in `images/r-quick/image.lock` for bounded R tests that declare compatibility with the standard package set.
- Run the cached image with `sudo docker run --pull=never`; do not build images or run source-heavy `renv::restore()` on Crabbox.
- Mount the synced checkout at `/work` rather than copying project source into the image.
- A missing package or incompatible R version requires a newly published image or an HPC handoff, not package compilation during the Crabbox lease.
- The quick-check image is not authoritative for scientific results; exact locked production environments and intensive analyses run on HPC.

## Timeouts

- Cold GCP provisioning may take 60-120 seconds before repository sync begins.
- Give any Crabbox shell command at least a 600 second timeout; prefer 900 seconds for cold Python runs or full test suites. Where the shell tool takes an explicit timeout, set it; where it does not, do not treat a slow command as hung.
- Do not cancel a command merely because provisioning or SSH bootstrap appears slow.
- A timeout or cancellation is not a test result.

## Invocation discipline

Minimize remote invocations.

Preferred:

```bash
cbrun-uv bash -lc 'set -Eeuo pipefail; uv run ruff check .; uv run pytest'
```

Avoid separate cold starts for each test file or check. Let command output stream normally; do not pipe long-running commands through `head`, `tail`, or `grep` unless necessary.

## Failures and retries

- Preserve and report the exact remote command exit code.
- `INFRA_BUSY` with exit `75` means the machine-wide provisioning lock was not acquired within its finite wait. It is infrastructure contention, not a test failure or proof that a worker is ready; report the owner diagnostic and do not immediately churn another one-shot probe.
- A healthy worker plus a nonzero exit code normally means a real test failure.
- Do not rerun unchanged failing tests repeatedly.
- Infrastructure retry is appropriate only for idempotent tests, linting, and builds.
- Do not automatically retry deployments, migrations, publishing, or other side-effecting commands.

## Concurrency

`cbrun` uses two distinct locks. The repository lock serializes complete commands for the same canonical checkout and has no timeout; `cbrun: waiting for repository lock` means another command is using that checkout. The machine-wide GCP provisioning lock serializes only lease creation across all checkouts and has a finite wait. Do not bypass either lock or delete their files.

Reusable mode is preferred for multi-phase work because a successful first command warms the lease used by later checks. In one-shot mode, only dedicated lease creation holds the provisioning lock; checkout sync, the user command, and bounded explicit lease deletion run after that lock is released.
