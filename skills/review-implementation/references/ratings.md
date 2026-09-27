# Review severity and likelihood

Use these ratings for every reported finding and possible risk. Rate the
consequence **if it occurs** separately from the chance that its trigger will
occur in supported use. Base both ratings on the plan, code, and observed
behavior. They are ordered judgments, not numerical probabilities; give a
short reason for each rating. Consider existing safeguards when judging
likelihood and the remaining harm.

| Severity | Consequence |
|---|---|
| 4 CRITICAL | A central result can be wrong or scientifically invalid while appearing valid, or harm is irreversible or widespread. |
| 3 MAJOR | A required result or supported workflow fails, or a material error needs substantial recovery. |
| 2 MODERATE | A limited, recoverable result, record, or workflow error matters to a user. |
| 1 MINOR | Cosmetic or small inconvenience with no meaningful effect on the result or supported workflow. |

| Likelihood | Trigger in the declared supported use |
|---|---|
| 4 OBSERVED | Already observed, or inevitable in an ordinary supported run. |
| 3 LIKELY | Reachable in normal operation or through an ordinary mistake. |
| 2 POSSIBLE | Requires an uncommon but plausible supported input or sequence. |
| 1 REMOTE | Requires a contrived sequence, special interference, or unsupported use. |

State the trigger behind the likelihood rating. A deterministic defect on an
uncommon supported path can be 2 POSSIBLE: likelihood describes reaching the
path, not whether the defect occurs after reaching it. If evidence cannot
support a rating, say UNKNOWN and name the missing fact; do not invent a
probability.

Ratings explain priority; they do not override contracts. An observed harmful
failure or an explicit implementation requirement can block even at a lower
rating. A failed or invalid required scientific computation always remains an
IMPLEMENTATION blocker, regardless of its likelihood or visibility.

For possible risks, normally consider blocking only at severity 3 or 4 with
likelihood 3 or 4. A serious risk at likelihood 2 may block only when an
explicit authority requires protection against that situation. Dismiss minor
or remote speculation unless a specific requirement makes it relevant. Do not
fill reviews with low severity, low likelihood possibilities. If there is no
supported issue worth reporting, state that there are no findings.
