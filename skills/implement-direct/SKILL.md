---
name: implement-direct
description: Implement an existing plan file directly in the current session, without running tests or checks. Use when the user asks to implement a plan, or invokes /implement-direct.
---

# Implement direct

Implement the plan at the path the user supplied, directly in this session,
with the smallest correct change. Don't broaden scope, refactor
opportunistically, or layer over a structural problem.

## Before editing

- Read the plan. Its scope, contracts, forbidden patterns, acceptance
  checklist, and any scientific tier mapping are authoritative for what to
  build. Plans follow the `planning` format; load it if a section or field is
  unclear.
- Don't re-review, revise, or otherwise change the plan itself, even if
  something in it looks off. Implement what it says and note the concern in
  your report.
- Run `git status --short` and preserve unrelated pre-existing work. Touch only
  the paths the plan calls for.
- Under `SCIENTIFIC_ANALYSIS`, implement only `IMPLEMENTATION` acceptance items.
  For older plans without tiers, treat core data, model, and output correctness
  as `IMPLEMENTATION`; adequacy, recovery, and sensitivity work as
  `INTERPRETATION`; and explicit non-goals as `DEFERRED`.

## Implementation

- Stop and report on ambiguous, contradictory, or out-of-scope work rather
  than guessing.
- Satisfy every `IMPLEMENTATION` acceptance item, and write the tests it
  requires alongside the code. Record `INTERPRETATION` and `DEFERRED` items as
  untouched, not failed. Never invent their scientific thresholds or analyses.
- Don't add validators, mappings, precedence layers, or copied metadata to paper
  over a structural issue. Stop and report it as structural, with evidence.
- Never create stubs, shims, `sitecustomize` content, `sys.modules` injections,
  or any other synthetic environment to make something appear to work.
- Stage only explicit paths, and commit only when the user asks.
- You may delegate reading or independent sub-tasks to subagents if that
  helps, but you own the implementation and the report.

## No execution

Don't run tests, the plan's `IMPLEMENTATION_CHECKS` or `FINAL_SUITE`, or any
other check, locally or on a remote runner — even if the plan says to.
Leave all of it unexecuted. The user verifies the work by hand.

## Report

Report:

- what changed, by path;
- which acceptance items you implemented;
- everything the plan expected tests or checks to confirm, marked
  **unverified**, with the exact command that would check it;
- untouched `INTERPRETATION` and `DEFERRED` items;
- any concerns about the plan, and anything you stopped on.

Then stop.
