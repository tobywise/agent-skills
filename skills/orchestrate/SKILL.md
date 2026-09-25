---
name: orchestrate
description: A flexible guide for carrying out a plan from the main session by delegating implementation and review to agents and running verification yourself. Use when asked to implement and review a plan, carry a plan through to completion, or when the user invokes /orchestrate.
---

# Orchestrate

You, the main session, own the plan and coordinate the work. This is a guide,
not a script: skip, reorder, repeat, or do a step yourself when that serves
the plan better, and say briefly why when you depart from it.

The plan follows the `planning` format; load it if a section or field is
unclear.

## A typical run

1. **Read the plan** and `git status --short`. Confirm the plan exists, is
   readable, and doesn't conflict with unrelated uncommitted work.
2. **Implement.** Delegate to the `code-implementer` agent with the plan path,
   or implement a small plan yourself. The implementer edits code and writes
   tests but runs nothing; the main session owns verification.
3. **Review.** Delegate to the `code-reviewer` agent with the plan path. It is
   read-only and returns `APPROVE`, `REQUEST_CHANGES`, or `ESCALATE`.
4. **Settle disputed findings.** If the review raises blockers or risk
   candidates you or the user doubt, ask the `scientific-risk-reviewer` agent
   for a second opinion before acting on them.
5. **Verify.** Run the plan's `IMPLEMENTATION_CHECKS` yourself, following the
   `run-checks` skill.
6. **Fix and re-review.** For `REQUEST_CHANGES` or a failing check, send the
   specific findings or failure back to the implementer, then re-review with
   the previous review supplied, so the reviewer checks only what changed.
7. **Finish.** Once review approves and checks pass, run `FINAL_SUITE` once
   (or skip it when the plan says `REUSE_IMPLEMENTATION_CHECK`) and report.

If an agent isn't available on this platform, do implementation yourself or
load `review-implementation` or `scientific-risk-review` for those steps.

## When to stop and ask the user

- The review returns `ESCALATE`, or a finding is a plan gap: the plan needs
  revising, which `/create-plan` does as a new sibling file with the user's
  approval.
- The user would have to accept a blocker rather than fix it. Get a
  `scientific-risk-reviewer` acceptance review first, then let the user decide.
- A check can't run within `run-checks`' limits, such as an intensive
  scientific analysis that has to be handed to the user.
- The same finding survives two fix rounds, or three rounds pass without
  approval. Summarise what keeps failing rather than looping further.
- A scientific plan and its revisions reach four distinct blocking findings,
  or a fix would need yet another validator, mapping, or precedence layer.
  Propose simplifying instead, as `scientific-analysis` describes.

## Verification runs

- Batch related targeted checks into one invocation when they can run
  sequentially.
- Defer the full suite until the code is stable after review.
- Run the full suite successfully at most once for the same code; don't rerun
  a suite that already passed.
- Never rerun an unchanged failure; rerun only after a relevant code change.
- Reuse an earlier result only when it recorded the exact command, exit
  status, and runner outcome for the same, unchanged code.

## Ground rules

- Pass agents paths and findings, not your own reinterpretation of the plan.
- Never downgrade a scientific validity failure to get past a review.
- Commit or open a PR only when the user asks.

## Report

Summarise what was built, the final review decision, the exact verification
commands and their results, anything unverified or accepted, and open
questions.
