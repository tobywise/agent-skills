---
name: planning
description: The shared format and rules for implementation plans. Use when writing, splitting, revising, or interpreting an implementation plan, including when implementing or reviewing work against one.
---

# Planning

A plan is one Markdown file that tells an implementer what to build and tells a
reviewer how to judge it. The main session owns the plan and coordinates the
work: it hands the plan to an implementer, has the result reviewed, and runs
the plan's verification commands itself. Write every plan for that division of
labour.

## Before writing

- Inspect the repository first. Ask one short question only for intent the
  code and conversation cannot answer.
- Choose the review standard. Use `SCIENTIFIC_ANALYSIS` when the project's
  agent instructions (`AGENTS.md` or `CLAUDE.md`) declare it or the user
  selected a scientific workflow; ask when the work looks scientific but
  carries no marker. Otherwise use `GENERAL`. For `SCIENTIFIC_ANALYSIS`, load
  `scientific-analysis` and apply it throughout.
- Decide whether the work is one plan. Split it (see
  [Several plans](#several-plans)) when it combines a scientific or domain
  algorithm with dispatch, aggregation, provenance, receipt, or scheduler
  machinery, unless the user explicitly approves one integrated plan.

Write one new lowercase-kebab-case Markdown file, normally one to three pages.
Never edit, rename, replace, or delete an existing plan; to change one, see
[Revising a plan](#revising-a-plan).

## Required sections

1. **Summary** — the goal, the review standard, and the main risk.
2. **Scope** — allowed and forbidden paths, non-goals, entrypoints, analogous
   paths that must behave the same way, and the supported use and access.
3. **Contracts** — numbered `C-01`, `C-02`, … Each states required behaviour
   precisely and the proof that establishes it: a positive check, plus a
   negative check where a plausible mistake could otherwise pass unnoticed.
4. **Tests and verification** — see below.
5. **Implementation steps** — an ordered outline, not code.
6. **Forbidden patterns** — shortcuts the implementer must not take, such as
   stubs, shims, catch-and-warn, or a second source of truth.
7. **Complexity budget** — see below.
8. **Acceptance checklist** — numbered `AC-01`, `AC-02`, … Each item maps a
   behaviour to its paths, its proof, and the shortcuts it rules out. The
   implementer works through this list and the reviewer checks it item by item,
   so every item must be independently checkable.

## Tests and verification

The implementer writes the tests but never runs them. The main session runs
these commands after review, following the `run-checks` skill.

```text
RUNNER: <how commands run, per run-checks: e.g. `uv run` locally, or cbrun-uv on Crabbox>
REQUIRED_INPUTS: <data, credentials, or services the checks need, or none>
DEFERRED_INPUTS: <inputs deliberately left out of these checks, or none>
IMPLEMENTATION_CHECKS: <one exact command: cheap, targeted checks first>
FINAL_SUITE: <one exact command for the full suite>
RUN_BUDGET: <expected number of check invocations, with a one-line justification>
```

- Every command is exact and complete. Its coverage must be reviewable from the
  plan alone, never left for whoever runs it to choose.
- `IMPLEMENTATION_CHECKS` covers every acceptance item plus relevant
  regressions, in one invocation, cheapest first.
- `FINAL_SUITE` runs once the candidate is stable after review. A scientific
  `ONE_CALL` plan declares `FINAL_SUITE: REUSE_IMPLEMENTATION_CHECK` instead.
- Static checks and source inspection cannot prove executable behaviour.
- Name the project's locked linter and formatter where they apply.
- Older plans may say `REMOTE_BUDGET` and `Remote validation`; they mean
  `RUN_BUDGET` and `Validation`.

## Complexity budget

State expected sizes. The defaults are about 800 production additions, 1,200
test additions, 10 changed files, three feature surfaces, one validation path
per configuration path, and one authority per concept. Scientific `SINGLE_USE`
plans use the smaller figures in `scientific-analysis`.

These are estimates that invite scrutiny, not hard limits. Exceeding one is not
a defect on its own; only a limit the user or an external authority declares
hard is exact.

## Precision rules

- A claim of "all", "every", or "complete" needs an inventory of what it
  covers.
- New configuration maps each field to its consumer, or to an explicit
  rejection.
- A change to a durable format inventories its producers, consumers,
  constructors, fixtures, and existing stored shapes, and says how old data is
  migrated or rejected.
- Name the independent source of truth for each check, the fields compared,
  the differences allowed, and how failure is observed.
- Keep workflow mechanics out of the plan: no preflight steps, retry counts,
  checkpoint timing, or receipt formats.

## Scientific plans

Under `SCIENTIFIC_ANALYSIS`, also:

- declare `Delivery profile` and `Validation` as defined in
  `scientific-analysis`;
- tier every acceptance item `IMPLEMENTATION`, `INTERPRETATION`, or
  `DEFERRED`. Vague adequacy goals are `INTERPRETATION` and stay out of failing
  checks. Never invent adequacy thresholds;
- mark every defensive contract `DIRECT` (it protects correctness, fail-fast,
  or scientific validity) or `CONTINGENT` (it guards against something that
  might happen). `DIRECT` requirements are always full contracts. For
  `SINGLE_USE`, a `CONTINGENT` concern that is not both plausibly reachable in
  supported use and serious goes in an advisory section, not a contract;
- never weaken the scientific fail-fast policy.

## Several plans

When work is too large or mixed for one plan, propose numbered vertical slices,
each independently useful, and get the user's approval before writing any file.
Then write one plan per approved slice, each meeting this whole format, with:

- non-overlapping ownership of paths;
- stated dependencies, and which plan owns any shared file;
- ordered, non-overwriting filenames, e.g. `feature-01-core.md`,
  `feature-02-export.md`;
- a coherent, working state after each plan lands.

If inspection shows the approved split no longer holds, stop and say why.

## Revising a plan

A plan is never edited in place. When the user asks for a revision — usually
after a review finds a plan gap — write a sibling file with the next free
suffix (`feature.md` → `feature-v2.md` → `feature-v3.md`) and leave the
original untouched.

- Open the new plan with `Revises: <original path>` and a short list of what
  changed and why, citing the review finding IDs.
- Change only what the revision needs. Keep unaffected contracts, acceptance
  IDs, and commands verbatim so earlier reviews stay traceable.
- An operational correction — a command, argument, runner, input, or budget —
  can be made as requested. A substantive one — scope, semantics, authority,
  design, scientific policy, or a hard limit — needs the user's explicit
  approval first.
- Removing a contract also removes proof and machinery needed only for it.
  Never remove scientific correctness, validity, fail-fast, or required proof.

## After writing

Return the plan path, or paths, and a one-paragraph summary.
