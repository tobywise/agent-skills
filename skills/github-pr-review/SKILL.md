---
name: github-pr-review
description: Format and publish completed review findings as GitHub PR comments or submitted reviews. Use only when the user requests posting to GitHub. For assessing a PR, including requests to review and post, use review-implementation first. Do not select this skill for reviews or drafts requested only in chat.
---

# Post a GitHub PR review

Publish a completed assessment with clear evidence links and ratings.

## Use the completed review

- For a request to review and post, load and complete `review-implementation`
  first. This skill handles formatting and submission after that assessment.
- If the user already supplies a completed review to post, use it. If an
  assessment is missing or needs further review, use `review-implementation`
  before submission; do not conduct a separate review under this skill.
- Preserve finding IDs, blocking decisions, classifications, scientific tiers,
  severity, likelihood, rating reasons, and stated uncertainty. Keep possible
  risks distinct from observed defects. Do not invent fixes for risk candidates.
- Identify the intended PR and confirm the reviewed commit still matches its
  head. If it has changed, use `review-implementation` to assess the new changes
  before posting. Check existing comments when useful to avoid duplicates.

## Reference every finding

Every finding and risk candidate needs a clickable link to its supporting
evidence. An inline GitHub review comment anchored to the relevant line counts
as its reference. For findings in the review body, prefer a GitHub permalink to
the relevant lines at a specific commit. Link further locations when needed to
understand the issue. Check that each link opens the intended evidence before
posting.

A plain `path:line` is not enough. If a required reference cannot be located,
report the missing reference before submission. Do not silently drop or
reclassify a finding to make the review publishable.

## Preserve the ratings

Include the severity, likelihood, and evidence-based reason for each from the
completed review, for every finding and risk candidate. Preserve `UNKNOWN`
and the named missing fact when a rating cannot be supported. If these fields
are missing, complete them through `review-implementation` before posting.
Formatting must not change ratings or decide anew whether a finding blocks.

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

- Post only when the user requests posting; that request authorizes the
  submission. If the user changes the request to draft only, show the prepared
  text without submitting it.
- Honor the requested form of submission. For a plain PR comment, use
  `gh pr comment`. For a formal review, use `gh pr review` with the event
  supported by the assessment: `REQUEST_CHANGES` for blockers, `COMMENT` for
  nonblocking or unresolved feedback, and `APPROVE` only when approval is
  intended and supported. Explain an `ESCALATE` assessment in the body; it is
  not a GitHub review event. Do not infer approval from a limited review.
- Write the body to a file and pass it to the chosen command with
  `--body-file` to preserve Markdown and newlines. Use inline comments for
  findings when appropriate.
- After posting, report the review decision and link to the posted review.
