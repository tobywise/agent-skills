---
name: run-checks
description: How to run tests, builds, type checks, installs, and other verification commands on this machine — locally, or on remote Crabbox workers when they are available. Use before running any test suite, build, type check, dependency install, migration, Docker build, or other expensive command.
---

# Run checks

## Choose the runner

Run `command -v cbrun` once per session, before the first check.

- **Found:** this machine is a controller for remote Crabbox workers. Read
  `references/crabbox.md` in this skill's directory
  (`~/.agents/skills/run-checks/references/crabbox.md`) and follow it as well
  as the rules below. Never run the commands above directly on this machine.
- **Not found:** run checks locally, as described below.

## Local runner

- Run checks in the project's own locked environment, through its declared
  entrypoints: `uv run` for a uv project, the project's `make` targets or
  scripts, and so on. Respect `.python-version` and `requires-python`.
- Project-locked setup is allowed, such as `uv sync --locked`. Never add,
  upgrade, or install unlocked dependencies to make a check pass.
- Keep checks bounded. Stop and ask the user to run an intensive scientific
  analysis themselves, giving the exact command and expected artifacts.
- Never run migrations, deployments, or anything that changes external systems
  as a check.

## Always

- Batch related checks into one invocation, cheapest first, rather than
  separate runs per file or tool.
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
