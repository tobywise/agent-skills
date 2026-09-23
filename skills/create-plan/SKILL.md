---
name: create-plan
description: Create one implementation-ready Markdown plan from a request, or a revised copy of an existing plan. Use when the user asks for a plan, asks to revise a plan, or invokes /create-plan.
---

# Create plan

Load the `planning` skill and follow it to write one plan for the request the
user supplied.

- If the work meets `planning`'s criteria for several plans, recommend
  `/create-multiple-plans` and stop rather than forcing one plan.
- Default a one-off scientific analysis to `SINGLE_USE` plus `ONE_CALL`, not
  reusable infrastructure.
- If the user asks to revise an existing plan, follow `planning`'s revising
  rules and write a sibling file.

Return only the plan path and a short summary.
