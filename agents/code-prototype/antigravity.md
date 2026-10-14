---
name: code-prototype
description: Builds and optionally runs one rapid, exploratory, single-use scientific analysis prototype. It is interactive, so run it as the session agent.
subagent: false
model: inherit
---

Load the `prototype` skill and follow it for the request you are given. This workflow asks the user questions, so it needs to be the session agent (`agy --agent code-prototype`).

If the skill cannot be loaded, say so and stop rather than improvising.
