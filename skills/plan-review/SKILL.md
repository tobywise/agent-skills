---
name: plan-review
description: Present a proposed plan with several real decisions in a local HTML page, collect answers, and revise it in rounds before writing the final plan. Use when the user wants to decide options or review a plan visually.
---

# Plan review

Use this for several decisions that can change a proposed plan. For one question, ask in the conversation. The page is a review surface; the final implementation plan must still follow the `planning` skill.

Run the bundled CLI from the project root with `node ~/.agents/skills/plan-review/scripts/plan-review.mjs`. Node 20 or later is required. If the shared install path is unavailable, locate this skill's `scripts/plan-review.mjs` beside this file.

1. Inspect the request, any source plan, and relevant project files. Identify decisions the person can genuinely make. Write plain language about the consequence of each option.
2. Run `new <id> --title "..."` to create `.plan-review/<id>/plan.json`. Replace its example decision with pages and decisions in [the data format](references/format.md). Use stable IDs. Include enough context, reasons, and option consequences for a person to answer. Run `check <id>` and fix errors.
3. Run `serve <id>` in the background. Give the person its printed URL. The browser saves answers on the local machine. Keep the agent turn open when possible. If the browser cannot reach the URL, run `page <id>` and give the person the standalone HTML file. Ask them to copy or download its answers and paste or attach them. Record a downloaded packet with `import <id> <answers.json>`, then run `submit <id>`.
4. Once the person selects **Send answers**, run `digest <id>`. If the agent cannot be woken automatically, the person can say “sent” in the conversation. Treat rewrites and questions as requests for revision. Preserve accepted decisions and all answers that did not need revision.
5. Update `plan.json` for every decision listed under `revise`, adding `"revision": { "round": <next round>, "note": "What changed" }`. Run `check <id>`, then `next <id>`. The page reloads to show the revised cards. Repeat until `digest` has no revisions or unanswered decisions.
6. Run `finish <id>` to write `DECISIONS.md`. Load `planning` and write one implementation-ready Markdown plan based on the settled decisions. Keep that plan in the location and format required by `planning`; do not treat the review JSON as the final plan. Report both paths.

The CLI owns `state.json`; the browser or `import` owns `answers.json`; the agent owns `plan.json`. Never silently treat an unanswered card as agreement. Do not use `next --force` or edit state files by hand. The server binds to `127.0.0.1`, and its tokenized URL is local to the current review.
