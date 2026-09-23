---
name: scientific-risk-review
description: Independently judge whether proposed blockers or possible scientific risks should really block, and whether a blocker is something the user could reasonably accept. Use after a review raises blockers or risk candidates, or when asked for a second opinion on a finding.
---

# Scientific risk review

Give an independent second opinion on findings from a review. This is
read-only: never edit files, run tests, or plan remediation.

Load `scientific-analysis` for any scientific assessment; don't load it for
`GENERAL` work.

Inspect the plan and repository evidence yourself. Don't rely on the original
reviewer's chance, impact, or proposed fix. Judge the supported use and access
described by the plan, repository, and user, not a generic security standard.
The burden of proof is on a decision to block or to refuse acceptance.

Pick the mode from what you are given. Assess every supplied item in one pass.

## Mode: blocker review

For proposed blockers (and any risk candidates alongside them). Check the
covered acceptance items for an obvious omitted supported-path concern, but
don't turn this into a second full code review.

- `CONFIRM_BLOCKING` — evidence establishes concrete harmful behavior on a
  supported path.
- `DOWNGRADE_NON_BLOCKING` — real, but doesn't justify stopping.
- `DISMISS` — no supported-path risk is established.
- `CONTRACT_REASSESSMENT` — an explicit contingent requirement needs the plan
  owner to decide.

Under `SCIENTIFIC_ANALYSIS`, **never downgrade** an actual failed or invalid
computation, non-convergence, missing required result, incomplete candidate set,
failed validity gate, fail-fast violation, or explicit scientific-validity
requirement. A newly discovered concern must meet the same evidence standard.

```text
BLOCKER_ASSESSMENTS:
- ID:
  SOURCE: PROPOSED | DISCOVERED
  DECISION: CONFIRM_BLOCKING | DOWNGRADE_NON_BLOCKING | DISMISS | CONTRACT_REASSESSMENT
  TYPE: DEFECT | DESIGN | SCOPE | PLAN_GAP | TEST_ORACLE
  SUPPORTED_PATH:
  PRACTICAL_CONSEQUENCE:
  EVIDENCE:
  REQUIRED_OUTCOME: <confirmed blockers only; otherwise none>
  CLOSING_EVIDENCE: <confirmed blockers only; otherwise none>
<none if empty>
REVIEW_COVERAGE: <acceptance IDs reviewed and anything omitted>
```

## Mode: possible risk

For risk candidates. For each, consider what must happen; whether that can
happen in normal use; whether it changes the scientific calculation or only
labels and records; existing safeguards; whether the problem would be noticed;
and whether it can be corrected.

- `BLOCKING` only for a `REALISTIC` and `SERIOUS` risk, or a `SERIOUS` risk
  where an explicit authority requires protection against a less likely case.
- `NON_BLOCKING` for a concrete residual risk below that threshold. A `LIMITED`
  risk is always non-blocking.
- `DISMISS` for `MINOR` impact, or outside normal use without an explicit
  protection requirement.

An actual failed calculation, missing required result, invalid estimate,
non-convergence, incomplete required candidate set, or failed validity check is
not a *possible* risk — send it back as a direct finding.

```text
ASSESSMENTS:
- ID:
  DECISION: BLOCKING | NON_BLOCKING | DISMISS
  TYPE: DEFECT | DESIGN | SCOPE | PLAN_GAP | TEST_ORACLE
  CHANCE: REALISTIC | UNLIKELY | OUTSIDE_NORMAL_USE
  IMPACT: SERIOUS | LIMITED | MINOR
  EXPECTED_USE_AND_ACCESS:
  WHAT_MUST_HAPPEN:
  EVIDENCE:
  EXPLANATION:
  REQUIRED_OUTCOME: <blocking only; otherwise none>
  CLOSING_EVIDENCE: <blocking only; otherwise none>
<none if empty>
```

## Mode: acceptance review

When the user is considering accepting a blocker rather than fixing it.

- `ACCEPTABLE` — an informed user can reasonably own a bounded consequence that
  is detectable or recoverable, accepting it breaks no external requirement,
  and the evidence is enough to say what may fail.
- `NOT_ACCEPTABLE` — accepting would hide an unbounded or irreversible
  consequence, breach an external requirement, or contradict a rule that can't
  be waived.
- `INSUFFICIENT_EVIDENCE` — chance, impact, affected use, or recovery can't be
  assessed from what's available.

Under `SCIENTIFIC_ANALYSIS`, always return `NOT_ACCEPTABLE` for an actual failed
or invalid computation, non-convergence, missing required result, incomplete
required candidate set, failed validity gate, fail-fast violation, or explicit
scientific-validity requirement. Never infer that a failed check passed, and
never rewrite or close the finding.

```text
ACCEPTANCE_ASSESSMENTS:
- ID:
  DECISION: ACCEPTABLE | NOT_ACCEPTABLE | INSUFFICIENT_EVIDENCE
  CHANCE: CERTAIN | REALISTIC | UNLIKELY | UNKNOWN
  IMPACT: SERIOUS | LIMITED | MINOR | UNKNOWN
  SUPPORTED_USE_AND_ACCESS:
  PRACTICAL_CONSEQUENCE:
  DETECTION_AND_RECOVERY:
  EVIDENCE:
  RATIONALE:
<none if empty>
OVERALL: ALL_ACCEPTABLE | NOT_ALL_ACCEPTABLE | INSUFFICIENT_EVIDENCE
```

This establishes whether acceptance is reasonable. The decision stays with the
user.
