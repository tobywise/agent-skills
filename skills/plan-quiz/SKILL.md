---
name: plan-quiz
description: Create an interactive HTML questionnaire for a plan and return the user's answers to the agent. Use when the user wants to review, challenge, or make decisions about a plan through a visual quiz.
---

# Plan quiz

Create an HTML page that helps the user express preferences and decisions about a specific plan. Use the plan in the conversation or read the named plan file; inspect related code only when needed to frame a real choice. If no plan is available, ask for one.

Choose questions whose answers could change the plan: scope, priorities, tradeoffs, sequencing, architecture, user experience, validation, risks, or unresolved assumptions, as applicable. Do not quiz the user on facts the agent can determine or on decisions the plan has already settled. Give each question enough context to answer, show the practical consequences of options, and offer a way to answer “unsure” or supply a different answer. Use diagrams, DAGs, graphics, or interactive comparisons when they make a choice easier to understand; keep an equivalent text explanation and answer control.

Keep the page self-contained, with no external assets. Make it readable on small screens and usable with a keyboard. Let the user review and revise answers before finishing. Its response packet must be JSON with a `plan` string and an `answers` array. Each answer must have `id`, `question`, `status` (`answered`, `unsure`, or `skipped`), `answer`, and `explanation` fields. Record the user's choice and explanation in their own words. Do not silently turn an unanswered question into agreement.

## Return answers automatically

When the user's browser can reach the agent's machine at `127.0.0.1` and Python 3 is available, use [scripts/quiz_bridge.py](scripts/quiz_bridge.py). It serves the generated page on a one-time local URL and saves one submitted response packet. Have the page POST its JSON packet to the same-origin path obtained by changing `/quiz/` in `location.pathname` to `/submit/`:

```js
const endpoint = location.pathname.replace(/^\/quiz\//, "/submit/");
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(packet),
});
if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
```

Show “Sent to agent” only after a successful HTTP response; on failure, keep the answers and offer retry, copy, and download controls.

Start the bridge with `--html <page> --result <temporary-response.json> --ready <temporary-ready.json>`. Both output paths must be new. Read the URL from the ready file and give it to the user in an intermediate message. **Keep this agent turn open** while waiting for the result file, using bounded waits and progress updates. When it appears, read it, stop or let the one-shot bridge exit, and report the findings. The bridge stops after one accepted submission or its timeout (30 minutes by default). Clean up temporary files after reading them.

Keep a selectable response summary and **Copy for agent** and download controls in the page. If the local bridge cannot be reached or this agent interface cannot wait for a submission in the same turn, explain that automatic return is unavailable here and ask the user to paste or attach the response. Do not claim delivery merely because the page attempted a POST or saved a file.

## Report findings

Report decisions and stated reasons, unresolved questions, and concrete implications for the plan. Separate the user's answers from your interpretations or recommendations. If a choice conflicts with another answer or with the plan, identify the conflict instead of resolving it silently. Revise the plan only if the user asks for that as part of the task.
