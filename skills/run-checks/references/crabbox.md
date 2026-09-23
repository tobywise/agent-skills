# Crabbox runner

Read by `run-checks` when `cbrun` is on `PATH`. The general rules in
`run-checks` still apply; these add the Crabbox specifics.

## Controller and workers

- This machine is the always-on controller.
- Use it for editing, Git operations, planning, and orchestration.
- Do not run test suites, builds, type checks, dependency installs, migrations, Docker builds, or other expensive validation locally.
- Lightweight project-declared linters and formatters may run locally on changed files before remote verification.
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

## Crabbox failures and retries

- Preserve and report the exact remote command exit code.
- `INFRA_BUSY` with exit `75` means the machine-wide provisioning lock was not acquired within its finite wait. It is infrastructure contention, not a test failure or proof that a worker is ready; report the owner diagnostic and do not immediately churn another one-shot probe.
- A healthy worker plus a nonzero exit code normally means a real test failure.
- Infrastructure retry is appropriate only for idempotent tests, linting, and builds.

## Concurrency

`cbrun` uses two distinct locks. The repository lock serializes complete commands for the same canonical checkout and has no timeout; `cbrun: waiting for repository lock` means another command is using that checkout. The machine-wide GCP provisioning lock serializes only lease creation across all checkouts and has a finite wait. Do not bypass either lock or delete their files.

Reusable mode is preferred for multi-phase work because a successful first command warms the lease used by later checks. In one-shot mode, only dedicated lease creation holds the provisioning lock; checkout sync, the user command, and bounded explicit lease deletion run after that lock is released.
