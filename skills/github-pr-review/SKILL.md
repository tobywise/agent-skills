---
name: github-pr-review
description: Draft and, when requested, post GitHub pull request reviews with evidence links, severity, and likelihood. Use for PR review findings and decisions, not PR descriptions.
---

# GitHub PR review

Write reviews that help the author understand what to change, why it matters,
and when the problem can occur.

## Prepare the review

- Identify the PR and inspect its current diff, relevant surrounding code, and
  project review instructions. If the user only wants supplied findings
  formatted, preserve their meaning and identify claims you have not checked.
- Report actionable findings supported by evidence. For each finding, explain
  the trigger, consequence, and practical fix. Check existing review comments
  when useful to avoid repeating them.
- When using a `review-implementation` report, preserve its finding
  classifications, scientific tiers when present, and ratings. Do not turn an
  unverified claim into a verified finding.

## Reference every finding

Every finding and risk candidate needs a clickable link to its supporting
evidence. An inline GitHub review comment anchored to the relevant line counts
as its reference. For findings in the review body, prefer a GitHub permalink to
the relevant lines at a specific commit. Link further locations when needed to
understand the issue. Check that each link opens the intended evidence before
posting.

A plain `path:line` is not enough. If you cannot locate the evidence, leave the
claim out of the findings and describe it as unverified.

## Rate every finding

Report severity and likelihood separately for every finding and risk candidate.
Give a short evidence-based reason for each rating. If the evidence does not
support a rating, use `UNKNOWN` and name the missing fact. Ratings do not, by
themselves, decide whether a finding blocks approval.

| Severity | Consequence if the issue occurs |
| --- | --- |
| `4 CRITICAL` | A central result can be wrong while appearing valid, or harm is irreversible or widespread. |
| `3 MAJOR` | A required result or supported workflow fails, or recovery takes substantial work. |
| `2 MODERATE` | A limited, recoverable error matters to a user. |
| `1 MINOR` | A small inconvenience has no meaningful effect on the result or workflow. |
| `UNKNOWN` | Available evidence does not establish the consequence. |

| Likelihood | Trigger in supported use |
| --- | --- |
| `4 OBSERVED` | The trigger has been observed or is inevitable in ordinary use. |
| `3 LIKELY` | The trigger is reachable in normal use or through an ordinary mistake. |
| `2 POSSIBLE` | The trigger needs an uncommon but plausible input or sequence. |
| `1 REMOTE` | The trigger needs a contrived sequence, special interference, or unsupported use. |
| `UNKNOWN` | Available evidence does not establish how the issue is triggered. |

## Format the review

Keep the summary brief and put the most consequential findings first. Use this
shape when there are findings:

```markdown
### Findings

1. **Blocking: Short description** — [relevant code](GITHUB_PERMALINK)
   - **Severity: 3 MAJOR** — Explain the consequence.
   - **Likelihood: 2 POSSIBLE** — Explain the trigger.
   - **Impact and fix:** Explain what happens and the smallest practical fix.

### Verification

State which checks ran and their results. Say "Not run" if no checks ran.
```

Omit empty sections. If there are no findings, state what was inspected and any
limits on that conclusion. Do not claim the PR is correct solely because no
issue was found. Do not claim a check ran unless it did.

## Post to GitHub

- If the user asks for a draft, show the review without posting it. Post only
  when the user requests posting; that request authorizes the submission.
- Use `REQUEST_CHANGES` for verified blocking findings, `COMMENT` for
  nonblocking or unresolved feedback, and `APPROVE` only when approval is
  intended and supported by the review. Do not infer approval merely from the
  absence of findings in a limited review.
- Write the review body to a file and pass it to `gh pr review` with
  `--body-file` to preserve Markdown and newlines. Use inline comments for
  findings when appropriate.
- After posting, report the review decision and link to the posted review.
