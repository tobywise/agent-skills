---
name: run-checks
description: How to run tests, builds, type checks, installs, and other verification commands on this machine — locally, or on remote Crabbox workers when they are available. Use before running any test suite, build, type check, dependency install, migration, Docker build, or other expensive command. Also says which tests to run while iterating and when the full suite must run.
---

# Run checks

## Choose the runner

Decide once per session, before the first check:

1. **The project says.** If the project's agent instructions (`AGENTS.md` or
   `CLAUDE.md`) name a runner — for example "checks in this repository run
   locally" — use it.
2. **Otherwise, detect.** Run `command -v cbrun`.
   - **Found:** this machine is a controller for remote Crabbox workers. Read
     `references/crabbox.md` in this skill's directory
     (`~/.agents/skills/run-checks/references/crabbox.md`) and follow it as
     well as the rules below. Never run tests, builds, type checks, installs,
     or other expensive commands directly on this machine.
   - **Not found:** run checks locally, as described below.

State which runner you chose and why in your first report of a check.

## Choose which tests to run

Run a **targeted selection** while iterating, and the **full suite** once at
the end.

- **Targeted selection:** the tests that exercise the change — tests for the
  changed files, tests that import or call the changed code (search for
  them), and any tests a plan names. Select them with the test runner's own
  options, such as file paths, test IDs, `-k`, or markers for pytest, or
  `test_file()` and `filter` for testthat.
- Make the full suite the selection when the change reaches code many tests
  share — `conftest.py` or shared test helpers, configuration, dependency or
  lock files, build settings, a widely imported module — or when the full
  suite costs about as much as the selection.
- After a failure, rerun just the failing tests, named explicitly, until they
  pass; then rerun the targeted selection. Name them rather than using
  pytest's `--lf`, whose cache is lost on fresh Crabbox workers.
- **Full suite:** once the code is stable, run it once before reporting the
  work complete. Reuse a passing full-suite result only for the same,
  unchanged code, with its exact command and exit status recorded. Work with
  no executable behaviour, such as documentation only, needs no run.
- Report which tests ran: the selection, or the full suite.

## Local runner

- Run checks in the project's own locked environment, through its declared
  entrypoints: `uv run --locked` for a uv project (plain `uv run` can rewrite
  `uv.lock`), the project's `make` targets or scripts, and so on. Respect
  `.python-version` and `requires-python`.
- Project-locked setup is allowed, such as `uv sync --locked`. Never add,
  upgrade, or install unlocked dependencies to make a check pass.
- Keep checks bounded. Stop and ask the user to run an intensive scientific
  analysis themselves, giving the exact command and expected artifacts.
- Never run migrations, deployments, or anything that changes external systems
  as a check.

## Always

- Batch related checks into one invocation, cheapest first, rather than
  separate runs per file or tool.
- Rerun one saved check command rather than retyping it. Use the project's
  check entrypoint (`make check`, `scripts/check.sh`, …) if it has one;
  otherwise write the batched command for the current targeted selection to
  `scripts/check.sh` with the file-writing tool, rerun that script, update it
  when the selection changes, and tell the user it exists so they can keep or
  delete it.
- Give long commands a generous timeout. A timeout or cancellation is not a
  test result.
- Report the exact command and its exit code. Distinguish a real test failure
  from an environment, setup, infrastructure, or timeout failure.
- Never rerun an unchanged failing check; rerun only after a relevant change.
- Retry an infrastructure failure only for idempotent checks: tests, linting,
  builds. Never automatically retry deployments, migrations, publishing, or
  other side-effecting commands.
- Let output stream normally; don't pipe long-running commands through `head`,
  `tail`, or `grep` unless necessary.
