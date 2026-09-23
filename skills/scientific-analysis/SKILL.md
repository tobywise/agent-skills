---
name: scientific-analysis
description: Use ONLY when planning, implementing, reviewing, or orchestrating a plan whose review standard is SCIENTIFIC_ANALYSIS.
---

# Scientific Analysis

Apply this policy only to `SCIENTIFIC_ANALYSIS`. It supplements the global
scientific fail-fast policy; it never replaces or weakens that policy.

## Delivery Profile

Every scientific plan declares:

```text
Delivery profile: SINGLE_USE | REUSABLE
Remote validation: ONE_CALL | STANDARD
```

Default to `SINGLE_USE`. Use `REUSABLE` only when the user or an existing
authority requires multiple external consumers, a stable public interface, a
library or service, repeated operational execution, or reusable infrastructure.
A plan declaring `REUSABLE` must cite the criterion and name each present
consumer or external caller. Repeated operational execution qualifies only when
a named external caller repeatedly invokes the supported workflow. Repeated
internal stages and possible future reuse are not sufficient.

`SINGLE_USE` classifies the supported pipeline as a whole, not each component.
It does not mean the pipeline may run only once. Reproducible reruns, shared
helpers or stages, and intermediate results consumed later or by several stages
are normal internal use. Natural parameterization or incidental importability is
also acceptable when it adds no meaningful implementation, support, or testing
burden. Never duplicate or inline code merely to avoid reuse.

For `SINGLE_USE`, prefer one supported external workflow entrypoint and
transparent sequential data and control flow. Stay strict about data identity
and coding, equations, likelihood, transforms, required estimands, seeds,
package and runtime identity, supported outputs, reproducibility, visible
failures, and scientific validity.

Use these as review tripwires, not quotas: six changed implementation or test
files, two executable feature surfaces, one entrypoint, about 400 production
additions, 500 test additions, and one comprehensive remote command. Treat
these figures as expected values. An excess alone is non-blocking and does not
require approval, a `REUSABLE` profile, or a split. Only a limit explicitly
identified as hard by the user or an external authority is exact; otherwise
block only when the excess creates concrete scope, support-burden, authority,
or reviewability harm.

Stop adding fixes and propose simplifying instead once a plan and its revisions
have accumulated four distinct blocking findings, or when a proposed fix needs
another schema, validator, mapping, precedence layer, copied authority, or
state protocol. Accumulated complexity is a signal to simplify, not a reason to
add more machinery.

Regardless of delivery profile, each listed surface requires explicit per-item
user approval and a named present consumer recorded in the plan: public API,
generic configuration framework, registry, plugin surface, compatibility layer,
scheduler abstraction, task manifest, receipt framework, duplicated provenance
validator, exhaustive malformed-input handling, or unsupported-use UX. A
blanket statement that the workflow needs the machinery is insufficient.

## Proportionate Proof

Test every supported scientific computation and workflow needed to establish
correctness and reproducibility. Prefer direct end-to-end or composed-path proof
over framework machinery. Add negative tests only for plausible errors that
could otherwise produce a false valid result or violate an explicit workflow.
Do not add generalized-input, compatibility, or external-consumer test matrices
solely because an internal component could be reused.

`SINGLE_USE` normally uses `ONE_CALL`. Its `IMPLEMENTATION_CHECKS` must combine
all implementation-tier acceptance checks and relevant regressions in one exact
command. The plan then declares:

```text
FINAL_SUITE: REUSE_IMPLEMENTATION_CHECK
```

Use `STANDARD` for `REUSABLE` work or whenever one comprehensive call cannot
provide credible proof; it keeps separate `IMPLEMENTATION_CHECKS` and
`FINAL_SUITE` commands. Documentation-only or configuration-only work may
explicitly justify no remote call when executable behavior is unchanged.

## Rapid Prototype Workflow

A `prototype` skill run follows that skill. It keeps the `SINGLE_USE`
scientific semantics above but not the plan and proof requirements, and it
assesses possible risks itself rather than using the independent review below.

## Failure And Interpretation

A failed or invalid required computation is an `IMPLEMENTATION` failure. Fail
at first detection; never warn and continue, skip a candidate, substitute a
method, or accept an incomplete required candidate set. A valid computation
with poor fit or unfavorable evidence is `INTERPRETATION` unless an explicit
validity gate says otherwise.

Use separate readiness for implementation and interpretation. Explicit
non-goals are `DEFERRED`.

## Assessing Possible Risks

Some findings describe a defect that exists now. Others describe something that
might go wrong only in particular circumstances. Use an independent
`scientific-risk-reviewer` for a possible risk when its importance depends on
how likely it is during normal use, an unusual sequence of events, someone
deliberately changing protected files or settings, unsupported use, or whether
the effect changes the calculation rather than only labels and records.

The original reviewer describes the condition and evidence. It does not decide
whether a possible risk blocks implementation. An actual failed calculation,
missing required result, invalid estimate, non-convergence, incomplete required
candidate set, or failed validity check is not a possible risk: it remains a
direct blocking implementation failure.

Assess possible risks against the supported use and access described by the
plan, repository, and user. Consider existing safeguards, whether the problem
would be noticed, whether it can be corrected, and whether an extra safeguard
would meaningfully reduce risk.

| Chance | Meaning |
|---|---|
| `REALISTIC` | It could happen during normal operation or through an ordinary mistake. |
| `UNLIKELY` | It is possible, but requires an unusual sequence of events. |
| `OUTSIDE_NORMAL_USE` | It requires deliberate interference, special access, or use the pipeline does not claim to support. |

| Impact | Meaning |
|---|---|
| `SERIOUS` | A wrong, missing, mixed, or scientifically invalid result could appear valid. |
| `LIMITED` | Labels, records, or workflow information could be wrong, but the calculation remains valid and the problem can be corrected. |
| `MINOR` | There is no meaningful effect on the scientific result or supported workflow. |

- A `REALISTIC` risk with `SERIOUS` impact may block implementation.
- An `UNLIKELY` risk with `SERIOUS` impact is normally non-blocking. It may
  block only when the project explicitly requires protection against that
  situation.
- A `LIMITED` risk is non-blocking, and a `MINOR` risk is dismissed.
- A risk that is `OUTSIDE_NORMAL_USE` is dismissed unless the project explicitly
  says the pipeline must protect against it.
- A written requirement alone does not make a highly unlikely scenario blocking.
  The plan or another authority must describe the situation and why protection
  matters.
- When the evidence does not establish serious blocking harm, the risk is not
  blocking by default.

### Contract proportionality

Approved plan contracts are authoritative. A proposed requirement whose need
depends on a possible event is an unverified risk, not a blocking contract,
until independently assessed. The user may ask to reassess an existing
contingent contract; it remains binding until a revision the user approves (see
`planning`) changes it. Assess the underlying condition rather than treating the existing
contract as evidence for itself. `BLOCKING` retains or admits the requirement
and cannot be removed through reassessment. `NON_BLOCKING` makes it advisory and
`DISMISS` removes it, although the user may explicitly retain either. Removing
a contract also removes proof and machinery needed only for it. Direct
scientific requirements cannot be risk-reviewed away, and complexity targets
are not hard limits unless the user or an external authority explicitly
declares them so.

## Review Impact

Assign every scientific finding a tier and practical impact:

- `SCIENTIFIC_VALIDITY`: required results may be wrong, invalid, incomplete, or
  based on incorrect data or model semantics.
- `SUPPORTED_WORKFLOW`: the declared workflow cannot run, fail visibly, or
  reproduce reliably although the scientific method may be sound.
- `INTERPRETATION`: computation is valid, but fit, diagnostics, sensitivity,
  robustness, or evidence limits permitted claims.
- `MAINTAINABILITY`: scope, duplication, complexity, or architecture threatens
  future correctness without currently invalidating a result.
- `USABILITY`: ergonomics, wording, unsupported misuse, or convenience only.

Scientific-validity and supported-workflow implementation failures block. A
possible risk blocks only after the independent assessment above returns
`BLOCKING`.
Interpretation findings block interpretation readiness only unless an explicit
validity gate applies. Maintainability blocks only through an existing scope,
design, or complexity contract. Usability is advisory unless it violates an
explicit supported-workflow acceptance item.

Every blocking finding must identify the supported path, concrete harm, minimal
fix, and proof required to close it. Do not block on a reusable-software concern
without a present risk to the supported scientific workflow.
