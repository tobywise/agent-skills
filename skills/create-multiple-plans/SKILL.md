---
name: create-multiple-plans
description: Create approved, ordered implementation plans for independently useful vertical slices. Use when work is too large for one plan, when a split has been recommended, or when the user invokes /create-multiple-plans.
---

# Create multiple plans

Load the `planning` skill and follow its rules for several plans, for the
request the user supplied.

Inspect the relevant code before deciding boundaries. Unless the user has
already given an explicit, coherent split, propose numbered vertical slices and
get approval before writing any file. Every plan must meet the full `planning`
format on its own.

Return only the plan paths, in order, and a short summary.
