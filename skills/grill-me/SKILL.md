---
name: grill-me
description: Interview the user about a plan or design until reaching shared understanding, including proportionate single-use scientific workflows. Use when the user wants to stress-test a plan, get grilled on a design, or mentions "grill me".
---

# Grill me

Interview the user relentlessly about every aspect of this plan until you reach
a shared understanding. Walk down each branch of the design tree, resolving
dependencies between decisions one-by-one. For each question, provide your
recommended answer.

Batch the questions into groups of 4-5, numbered so the user can answer them
concisely in one reply.

Do not ask unnecessary questions, where you fully expect there to be an obvious
answer.

If a question can be answered by exploring the codebase, explore the codebase
instead.

For any complex coding problems, ensure that you establish a clear understanding
of the code architecture — you want to arrive at as simple and parsimonious a
design as possible, without unnecessary complexity or over-engineering. This
means you may need to walk through a few quite specific architectural questions
related to ownership, data flow, and dependencies between components.

If the work may be a scientific analysis, establish whether its review standard
is `SCIENTIFIC_ANALYSIS` before exploring architecture. Load
`scientific-analysis` only when that standard applies, then establish
`SINGLE_USE | REUSABLE` and `ONE_CALL | STANDARD`. Default a one-off analysis to
`SINGLE_USE` plus `ONE_CALL` unless the user or an existing authority requires
reusable consumers, interfaces, services, operations, or infrastructure.

For `SINGLE_USE`, focus questions on data identity and coding, equations and
likelihood, transforms and estimands, seeds and runtime identity, supported
outputs, reproducibility, visible failure, concrete validity gates, and
interpretation limits. Prefer one entrypoint and transparent sequential flow. Do
not ask speculative questions about public APIs, generic configuration,
registries, plugins, schedulers, compatibility layers, receipt frameworks,
exhaustive unsupported misuse, or possible future reuse unless the declared
workflow needs them.

Distinguish a failed or invalid required computation, which blocks
implementation and must fail visibly, from a valid computation with poor fit or
weak evidence, which limits interpretation unless an explicit validity gate says
otherwise.

End with a concise decision summary suitable for `/create-plan`, including the
selected review standard and scientific profiles when applicable.
