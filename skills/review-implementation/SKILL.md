---
name: review-implementation
description: Review pull requests, local implementation changes, or fixes against the applicable requirements. Use for code reviews and PR reviews, including requests to review and post to GitHub. Report findings with severity, likelihood, and scientific tiers when applicable; use github-pr-review only for the subsequent GitHub submission.
---

# Review implementation

Review the requested PR or local changes. Keep the assessment read-only: do not
edit source files or write review artifacts. Inspect existing test code and
recorded results; run tests only when the user explicitly authorizes test
execution for this review. A request to review, verify, or post findings is not
that authorization. For authorized tests, follow `run-checks` and any tool
restrictions; a coordinator can run checks a read-only reviewer cannot run.

Use this skill for the assessment even when the user also asks to post it on
GitHub. Complete the review first, then use `github-pr-review` to publish it.
The read-only assessment ends before that separately authorized posting step.
For a review or draft requested only in chat, report here without loading the
posting skill.

When a plan exists, its review standard, scope, contracts, required proof,
forbidden patterns, and acceptance checklist are authoritative. Default a
missing review standard to `GENERAL`. For `SCIENTIFIC_ANALYSIS`, load
`scientific-analysis`; do not load it for `GENERAL`. Plans follow the `planning` format; load it if a
section or field is unclear.

## Inputs

- **PR** — use the supplied URL or number, or an unambiguous PR identified by
  the request. Record its base and head commits.
- **Plan path** — use the supplied plan or one linked from the PR. For a PR
  without a plan, use its stated requirements and repository instructions;
  report `PLAN: none` and do not invent acceptance IDs. If the user explicitly
  asks for comparison against a particular plan that cannot be found, ask for
  its location.
- **Base or range** — honor an explicitly requested comparison and any file
  scope. Otherwise choose the comparison below.
- **Previous review** — optional. If supplied, this is a re-review (see below).

## Choose the diff

Resolve commit refs to commit IDs and state the comparison before inspecting
findings. Use the request and any earlier review to choose the scope:

| Requested review | Comparison |
| --- | --- |
| PR | Merge base of the PR base and head, through the PR head. Exclude unrelated local edits. |
| Branch | Merge base with the requested target branch, or the repository's default branch, through the branch head. |
| Uncommitted changes | `git diff HEAD --` for staged and unstaged tracked changes; also inspect relevant files from `git ls-files --others --exclude-standard`. |
| Staged changes only | `git diff --cached --`; inspect surrounding source from the index, not a newer working copy. |
| Unstaged changes only | `git diff --`; inspect relevant untracked files if the requested scope includes them. |
| Explicit commits or range | Honor the requested comparison, including two-dot or three-dot meaning; do not substitute the default branch. |
| Re-review after fixes | Compare the previously reviewed head with the current head, and revisit unresolved findings (see below). |

For PR and branch reviews, use `git diff <merge-base> <head> --` when the refs
are available locally, or obtain the equivalent PR diff through GitHub. Inspect
surrounding source from the reviewed head. Record both the target branch's
commit and the merge base used for comparison.

For an unspecified local review, infer scope from the request and `git status`:
prefer uncommitted changes when present, otherwise the branch diff. State that
choice. If multiple targets remain equally plausible or the necessary refs
cannot be identified, ask for the missing target instead of guessing a range.

Start with the changed files and lines. Follow callers, related code, tests,
and requirements when needed to understand their effects. Report defects the
changes introduce or expose, and failures of explicit requirements. Do not
expand into an audit of unrelated existing problems. An unchanged file can
still supply evidence for a required change that is missing.

## Inspecting

Batch independent reads and git inspections; don't reread an unchanged file.
Prefer symbol-aware search tools, when available, over paging whole files.

Inspect the diff, scope, contracts, required proof, forbidden patterns,
visible failure behavior, and agreement between analogous paths. Do not reward
partial work because tests pass.

Read or glob every plan-named implementation and test path directly. A file
missing from `git status` or the diff is not missing from the worktree — an
unchanged tracked file is real and present. A test that an implementation
acceptance item explicitly requires is a blocking defect only when it is
genuinely absent from the worktree or fails to establish the required behavior.

Inspect every acceptance ID and relevant contract even after finding a
blocker. `REVIEW_COVERAGE` must name each one you inspected.

Use [review ratings](references/ratings.md) for every finding and risk
candidate. State severity, likelihood, and a short evidence-based reason for
each. The ratings describe impact and exposure; they do not replace the
blocking rules below.

## Test quality

Inspect new and changed tests alongside nearby coverage and the behavior they
claim to verify. Assess this from the code and recorded results; these checks
do not authorize test execution.

- **Useful coverage:** Identify the meaningful result, required behavior, or
  plausible failure each test protects, and why existing tests would miss it.
  Flag overlapping cases, obsolete assertions, and tests of trivial details
  that add upkeep without distinct protection. Prefer extending or
  consolidating existing coverage over adding more tests.
- **Independent expectations:** Look for tautological tests: comparing a value
  with itself, deriving the expected answer through the same calculation being
  tested, or replacing the behavior under test with a mock and asserting its
  configured answer. Expected results should have an independent basis, such
  as a hand-calculated example, a trusted reference, or a scientific property.
  Sharing setup helpers is not itself a defect; trace whether the same mistake
  could affect both the actual and expected results and leave the test passing.
- **Effective assertions:** Name a concrete wrong behavior and trace whether
  the test would fail for it. Check for assertions that are never reached,
  swallowed failures, overly broad exception checks, tolerances that admit
  materially wrong answers, and checks of only shape or existence when values
  matter. Judge mocks and assertions against the test's stated purpose; a
  shape check is useful when shape is the required behavior.
- **Proportionate cost:** Question unnecessary data volume, repetitions,
  setup, dependencies, and helper layers. Prefer the smallest case that still
  exposes the failure and preserves the relevant scientific properties.
  Expensive tests need a distinct benefit; keep them outside the routine suite
  unless their cost is justified, with a separate command and a stated reason
  to run them.

For a test-quality finding, cite the missed failure or redundant coverage and
recommend the smallest useful correction, replacement, consolidation, or
removal. Apply the blocking rules below; test count, line count, and stylistic
preferences alone do not justify a blocker. Include test quality and any limits
of that assessment in `REVIEW_COVERAGE`.

## What blocks

Block only for an observed or deterministic harmful failure on a supported
path, or failure of an explicit implementation requirement. That includes data
identity and coding, equations, likelihoods, parameter transforms, primary
estimands, supported outputs, reproducibility, reliable verification, and
scope.

Every blocking finding needs its supported path, concrete harm, evidence,
minimal fix, and closing proof. A missing dedicated test is not a defect unless
an acceptance item requires that exact proof and nothing else can establish the
behavior.

For `SINGLE_USE` work, judge reuse at the pipeline boundary. Don't raise a
finding solely because helpers or stages are shared, results feed several
stages, or a component is incidentally reusable.

Treat complexity-budget figures as estimates unless the user or an external
authority has declared a limit hard. A plan label such as `hard` or `at most`
doesn't establish that on its own. Numeric variance alone is non-blocking; it
blocks only with concrete scope, duplication, support-burden, or reviewability
harm. Other design-invalidating evidence includes a second source of truth,
partial support presented as compatibility, self-referential proof of a core
result, or a contradiction between the plan's stated risk and the code.

## Scientific tiers

For scientific plans, give every finding a tier:

- `IMPLEMENTATION` — core correctness. Only these may block.
- `INTERPRETATION` — adequacy, recovery, sensitivity, robustness, diagnostics,
  model comparison. Report under `UNVERIFIED`; never block.
- `DEFERRED` — explicit non-goals. Don't review beyond scope.

Vague "plausible", "adequate", or "robust" goals without quantitative truth are
non-blocking `INTERPRETATION`, not a missing test oracle.

**Never downgrade** an actual failed or invalid computation, non-convergence,
missing required estimate, incomplete required candidate set, failed validity
gate, or fail-fast violation. These are always `IMPLEMENTATION` blockers.

## Possible risks

Don't enumerate merely conceivable risks. Record a `RISK_CANDIDATE` only when
repository or user evidence shows a concrete future trigger reachable in normal
supported use or through an ordinary operator mistake, with a consequence
capable of serious harm. Record the condition, evidence, requirement, paths,
and provisional severity and likelihood, but do not propose a fix. Actual
failed computations and deterministic defects are findings, not risk
candidates.

If a `scientific-risk-reviewer` agent is available, recommend running it on the
risk candidates and any proposed blockers. Otherwise present them to the user
for judgment.

## Re-review

When a previous review is supplied, inspect the changes since its recorded
head, the previous findings, and new evidence. Compare the old and new trees
directly even after a rebase or force push; a merge base can omit changes made
since the previous review. Use the current PR diff to distinguish target-branch
updates brought in by a rebase from changes to the PR. If the previous head is
unavailable, state that limit and use the full current PR or branch diff. Revisit unresolved findings
even when their lines have not changed. Keep a finding's ID while its root cause is
unresolved; give a genuinely distinct defect a new ID. Account for every prior
finding as closed, retained, or changed.

## Classification

Classify each finding `BLOCKING` or `NON_BLOCKING`, and as one of:

- `DEFECT` — violates specified semantics or required proof.
- `DESIGN` — the approach itself is wrong.
- `SCOPE` — work outside, or missing from, the plan's scope.
- `PLAN_GAP` — the plan doesn't specify what's needed.
- `TEST_ORACLE` — no independent truth to verify core behavior.

A blocking `DESIGN`, `SCOPE`, `PLAN_GAP`, or `TEST_ORACLE` finding means the plan
needs revising, not just the code: use `ESCALATE`.

## Report

Write each `HARM` in one to three sentences of at most 25 words, in active
voice and common words. Explain the consequence; don't just repeat the evidence.

```text
DECISION: APPROVE | REQUEST_CHANGES | ESCALATE
PLAN: <path, or none>
PR: <URL, or local changes>
BASE:
HEAD: <reviewed commit; identify local changes when included>
DIFF: <exact comparison or command, merge base when used, file scope, and untracked files included>
SUMMARY:
PASSED: <acceptance IDs, or none>
REVIEW_COVERAGE: <IDs and contracts inspected; anything omitted and why>
FINDINGS:
- ID:
  TIER: IMPLEMENTATION | INTERPRETATION | DEFERRED
  CLASSIFICATION: BLOCKING | NON_BLOCKING  <type>
  SEVERITY: 1 MINOR | 2 MODERATE | 3 MAJOR | 4 CRITICAL | UNKNOWN
  LIKELIHOOD: 1 REMOTE | 2 POSSIBLE | 3 LIKELY | 4 OBSERVED | UNKNOWN
  RATING_REASON: <consequence and trigger; missing fact if UNKNOWN>
  SUPPORTED_PATH:
  HARM:
  EVIDENCE: <file:line, contract, or command output>
  MINIMAL_FIX:
  PROOF: <test or direct check that would close it; none if n/a>
<none if empty>
RISK_CANDIDATES:
- ID:
  SEVERITY: 1 MINOR | 2 MODERATE | 3 MAJOR | 4 CRITICAL | UNKNOWN
  LIKELIHOOD: 1 REMOTE | 2 POSSIBLE | 3 LIKELY | 4 OBSERVED | UNKNOWN
  RATING_REASON: <consequence and trigger; missing fact if UNKNOWN>
  CONDITION:
  EVIDENCE:
  RELEVANT_REQUIREMENT:
  RELEVANT_PATHS:
<none if empty>
UNVERIFIED: <interpretation issues with severity, likelihood, and reason;
             anything you could not check, with reason>
SCOPE: PASS | FAIL
NEXT_STEP:
```

`APPROVE` requires no open blocking findings. If there are none, say so without
repeating detailed pass evidence.
