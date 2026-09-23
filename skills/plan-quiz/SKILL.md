---
name: plan-quiz
description: Create an interactive HTML questionnaire for a plan and bring the user's answers back to the agent. Use when the user wants to review, challenge, or make decisions about a plan through a visual quiz.
---

# Plan quiz

Create a standalone HTML page that helps the user express their preferences and decisions about a specific plan. Use the plan in the conversation or read the named plan file; inspect related code only when needed to frame a real choice. If no plan is available, ask for one.

Choose questions whose answers could change the plan: scope, priorities, tradeoffs, sequencing, architecture, user experience, validation, risks, or unresolved assumptions, as applicable. Do not quiz the user on facts the agent can determine or on decisions the plan has already settled. Give each question enough context to answer, show the practical consequences of options, and offer a way to answer “unsure” or supply a different answer. Use diagrams, DAGs, graphics, or interactive comparisons when they make a choice easier to understand; keep an equivalent text explanation and answer control.

Build the page so it works when opened as a local HTML file, without a server, network access, or external assets. Make it readable on small screens and usable with a keyboard. Let the user review and revise answers before finishing. The finish view must show a readable response summary and a **Copy for agent** control. Also provide a selectable text fallback and a downloadable response file, since clipboard access can fail for local pages.

The response must identify the plan and each question, record the selected answer and any explanation in the user's own words, and retain skipped or uncertain answers as such. Do not silently turn an unanswered question into agreement. Make the page tell the user to paste the copied response into the agent conversation or attach the downloaded file. A standalone HTML file cannot submit to the agent by itself; only claim automatic delivery when an actual return channel has been implemented and verified.

Give the user a link to the page and a brief instruction for returning the response. When the response arrives, report the findings in the conversation: decisions and stated reasons, unresolved questions, and the concrete implications for the plan. Separate the user's answers from your interpretations or recommendations. If a choice conflicts with another answer or with the plan, identify the conflict instead of resolving it silently. Revise the plan only if the user asks for that as part of the task.
