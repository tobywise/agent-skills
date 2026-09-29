---
name: pr-description
description: Draft a reviewer-focused pull request description from the current branch changes. Explain what changed and why in short, scannable prose, state whether scientific conclusions could change, identify risks and validation, and choose a compact call diagram, diff-style comparison, pseudocode explanation, or DAG when useful. Use when asked to write, improve, update, or review a PR description or explain a branch diff.
metadata:
  compatibility: claude-code, codex, opencode, agent-skills
  summary: Draft a reviewer-focused pull request description from the current branch changes, including an explicit scientific impact assessment, scannable explanations, and a source-verified explanation of changed logic in the format best suited to the PR.
  audience: scientists
  workflow: pull-request
---

# PR Description

Create an accurate, reviewer-focused pull request description from the repository's current changes.

The final result must explain the change in short paragraphs and focused bullets, state whether it could change scientific conclusions, and focus attention on meaningful behavior and design decisions. When useful, choose a compact call diagram, diff-style comparison, pseudocode explanation, or directed acyclic graph (DAG) to make the change easier to understand.

## When to use

Use this skill when the user asks to:

- write or improve a pull request description;
- summarize the current branch or diff;
- explain what changed for reviewers;
- document newly added or modified execution paths;
- prepare text for `gh pr create` or `gh pr edit`.

Do not use it as a substitute for a full correctness or security review. Report important issues noticed during analysis, but keep the primary output focused on describing the change.

## Operating principles

1. Ground claims in source code, history, recorded validation, or supplied context. Distinguish inference from verified facts; never invent evidence or references.
2. Explain intent and behavior for a reviewer who has not followed the implementation work.
3. Use the analysis below to decide what matters; do not report every inspection step or finding in the PR description.
4. Keep the result proportional to the change. Headings are optional, but the scientific impact statement is required.
5. Do not modify repository files unless the user explicitly asks.
6. Do not create or update a remote pull request unless the user explicitly asks.

## Inputs and scope

Determine the review range in this order:

1. Use a range explicitly supplied by the user.
2. If a pull request already exists for the branch, use its base branch and metadata when available.
3. Otherwise identify the repository's default branch and compare its merge base with `HEAD`.
4. If no base can be determined safely, explain the limitation and use the visible working-tree and staged changes.

Include, as applicable:

- committed changes on the current branch;
- staged changes;
- unstaged changes, when the user asks about the working tree;
- relevant added, modified, renamed, or deleted files;
- tests and documentation changed as part of the same work.

Exclude unrelated generated files, vendored dependencies, lockfile churn, and formatting-only changes from detailed explanation unless they materially affect the PR.

## Repository inspection

Use the repository's available tools to inspect:

- repository status and current branch;
- default or target branch;
- commit list and commit messages;
- diff summary and full diff;
- changed files and relevant surrounding source;
- project guidance such as `AGENTS.md`, `CONTRIBUTING.md`, and PR templates;
- tests, configuration, migrations, API definitions, and documentation affected by the change.

Do not assume that `main` is the base branch.

## Analysis workflow

### 1. Establish the change boundary

Establish the branch, comparison base, included commits and files, and whether uncommitted changes are in scope.

### 2. Build a semantic change inventory

Group changes by purpose rather than file order. For each group, identify what changed, why it was needed, how it works, and any compatibility or operational consequences. Include reused components only when they help explain the change.

### 3. Understand changed logic and relationships

For executable code that is new or modified:

1. Read the complete changed functions and relevant surrounding code, not only the diff hunks.
2. Compare previous and current logic, including conditions, calculations, dependencies, and failure behavior.
3. Follow calls and data dependencies only as far as needed to explain the change. Include unchanged code only for necessary context.
4. Verify relationships from source code; names, imports, and directory structure alone are not evidence.

When symbol status helps explain a diagram, label symbols as:

- `[NEW]` for symbols introduced by the change;
- `[MODIFIED]` for existing symbols whose executable behavior changed;
- `[EXISTING]` for unchanged dependencies included for context.

When status is ambiguous, omit the status rather than guessing.

### 4. Assess impact and risk

Start with scientific impact. Include a labelled `Scientific impact` statement near the top, using one assessment and a brief reason. Usually one or two sentences suffice; expand only to explain a material effect or uncertainty:

- **Could change scientific conclusions:** Identify the affected result or interpretation and how it could change. Use this for changes to data selection, preprocessing, models, estimation, uncertainty, comparisons, or reported results that could affect conclusions.
- **No change to scientific conclusions expected:** Explain why. This can cover editorial documentation, formatting, tooling unrelated to the analysis, or code reorganization that preserves the analysis. A PR labelled "docs" or "refactoring" is not enough evidence on its own.
- **Uncertain:** Name the unresolved scientific effect and the evidence needed to assess it. Use this when the available code or context does not support either assessment above.

Assess the whole PR: a scientific change remains relevant even if most files are documentation or cleanup. Documentation that changes analysis instructions or scientific interpretation can also affect conclusions.

Distinguish potential impact from demonstrated impact. Say conclusions actually changed only when a comparison of results supports that claim; report the observed change and the comparison's scope. Passing tests alone does not establish that conclusions are unchanged. For code reorganization, distinguish an intention to preserve results from evidence that results are preserved.

Keep this separate from operational risk: a reliable implementation can intentionally change scientific conclusions. A known failed or invalid scientific computation is an implementation failure, not merely an uncertain scientific impact; state the failure and do not present partial outputs as successful.

Check for:

- public API, schema, protocol, or configuration compatibility;
- migrations and rollback implications;
- authentication, authorization, privacy, and security effects;
- concurrency, retries, idempotency, and transaction boundaries;
- performance-sensitive loops, queries, allocations, or network calls;
- changed defaults, feature flags, or deployment ordering;
- new failure modes and error handling;
- test gaps or unverifiable assumptions.

Mention only risks that are grounded in the diff or surrounding code.

### 5. Verify validation evidence

Inspect relevant test changes and, when permitted, run the narrowest useful verification commands first.

Distinguish clearly between:

- tests observed in the diff;
- tests actually run during this session;
- checks not run;
- manual validation described by the user but not independently verified.

Never convert the existence of a test file into a claim that the test passed.

## Choose the clearest explanation of the change

Choose whichever format best answers the reviewer's main question about this PR. A call diagram is one option, not the default requirement. Usually use one format; add another only if it explains a distinct, important point. Omit this section when the short prose or bullets already explain the change.

| Format | Best suited to | What to show |
| --- | --- | --- |
| Call diagram | The change is about which functions call which others. | The affected caller-to-callee path, including relevant branches or asynchronous calls. |
| Diff-style comparison | A small before-and-after contrast explains the change most clearly. | Removed behavior with `-` and added behavior with `+`, with only enough context to understand the difference. |
| Pseudocode | The change is about a calculation, decision rule, loop, or sequence of checks. | Plain-language steps that explain the changed logic, including important conditions and failure behavior. |
| Directed acyclic graph (DAG) | The change is about how data or analysis steps depend on one another, especially where paths split or join. | Relevant inputs, steps, and outputs, with arrows showing a stated dependency or flow. |

### Shared rules

- Keep the explanation compact and focused on the affected behavior. Omit unrelated helpers, framework internals, and the full application structure.
- Verify every relationship and logic step against the source. For before-and-after comparisons, inspect both versions in the chosen review range.
- Label conceptual diffs and pseudocode as simplified explanations; do not present them as literal patches or executable code. Preserve conditions, ordering, and failure behavior that matter to the change.
- Make clear what changed and what remains only for context. Use status labels where helpful rather than adding them to every node or step.
- Use fenced `diff` for comparisons and fenced `text` for pseudocode or ASCII diagrams. A DAG may use fenced `mermaid` when the PR destination supports it; otherwise use ASCII.
- After the block, add at most a short explanation of anything important that is not already clear. Do not repeat every node or step in prose.

### Call diagram

Show caller-to-callee direction from top to bottom or left to right. Prefer function or method names over filenames, and label important branches or asynchronous boundaries.

```text
[MODIFIED] fit_participants()
    |
    +--> [NEW] check_trial_data()
    |
    +--> [EXISTING] fit_model()
```

### Diff-style comparison

Use a small literal excerpt when the code is easy to read, or a conceptual comparison when implementation details would obscure the change.

Simplified behavior comparison:

```diff
- Fit the model using all recorded trials.
+ Exclude practice trials before fitting the model.
```

### Pseudocode

Identify the changed step in the new logic, or show brief before-and-after versions if the contrast is essential. Avoid reproducing the implementation line by line.

Simplified new logic; the data check is new:

```text
For each participant:
    Check that all required trial values are present. [NEW]
    If a required value is missing, stop with an error naming the participant. [NEW]
    Fit the model to that participant's trials.
```

### DAG

State what arrows mean, such as "data used by" or "must finish before". Use plain names for analysis steps and outputs. A data-processing arrow does not establish scientific causation; use causal arrows only when they represent an explicit scientific model supported by the source or supplied context.

A DAG must have no cycles. Represent an iterative calculation as one labelled step with its iteration explained briefly, or choose pseudocode when the loop itself is the point of the change.

Arrows mean "supplies data to"; excluding practice trials is new:

```text
Recorded trials --> [NEW] Exclude practice trials --> Analysis trials
                                                        |        |
                                                        v        v
                                                    Model fit   Trial counts
                                                        |        |
                                                        v        v
                                                     Results report
```

## TL;DR plain-language standard

Write the TL;DR for an undergraduate researcher with introductory statistics and research-methods knowledge. Use a psychology undergraduate as the reading-level benchmark, but do not assume that the project uses any particular research method. The reader may recognize common method names, but does not know the codebase, software-engineering terminology, or advanced details of the project's methods.

The TL;DR must preserve enough research context to explain the change accurately. Do not make it so short or generic that the reader cannot tell what was wrong, what was corrected, or why the correction matters.

Use these content requirements:

- `Problem` states where the issue occurred in the research or analysis process, what was wrong, and why it could affect results or interpretation.
- `Resolution` describes the conceptual correction and any important safeguard in terms of the model, analysis, data, or reported output rather than internal code architecture.
- `Scientific impact` uses the assessment above and explains whether results or conclusions could change, with a concrete reason. Include it even for documentation or code reorganization.
- Default to one short sentence per field; use a second sentence or brief `Resolution` bullets only when needed. Keep the TL;DR under 130 words. This is a ceiling, not a target; small changes need far less.

Use these language requirements:

- Prefer concrete descriptions of what happens to the analysis, data, saved results, or researcher.
- Common research terms and relevant methods may be named without definition; do not add a methods tutorial.
- Briefly explain specialized variants, advanced statistical concepts, project-specific terms, and uncommon acronyms when they are necessary.
- Remove software-engineering language from the TL;DR. Do not use code symbols, internal component names, or architecture labels unless they are also names that researchers see and need to recognize.
- Avoid compressed noun phrases. Remove unnecessary terms instead of adding definitions for them.
- Apply a read-alone test: an undergraduate researcher should be able to explain the scientific or practical problem, the correction, and its consequence without reading the diff or the rest of the PR description.

Translate software-oriented terms according to their meaning in context. For example:

| Instead of | Describe it as |
| --- | --- |
| artifact | a saved result, model fit, report, or other specific output |
| stale artifact | a saved result created by an older, incompatible version |
| schema | the names and structure expected in the saved information |
| producer or consumer | the calculation or analysis step that creates or uses the value |
| interval endpoint | the lower or upper limit of the interval |
| validation contract | checks that the saved information is complete and compatible |
| unidentified estimand | a quantity or parameter the analysis cannot reliably estimate |

These translations are examples, not required wording. Choose the concrete description that is accurate for the current project.

For example, avoid a compressed TL;DR such as:

> **Problem:** The perseveration baseline sampled alpha and sensitivity even though learned values are disabled, and legacy recovery outputs used interval names that did not match their calculated endpoints.
>
> **Resolution:** Remove unidentified perseveration sites, version and validate RL fit artifacts, and align highest-density and 2.5%/97.5% interval schemas with their authoritative producers.
>
> **Impact:** Perseveration outputs now expose only identified estimands, stale artifacts fail before publication, and recovery coverage consumes accurately named interval endpoints.

Write it for the intended reader instead:

> **Problem:** The baseline model of repeated choices reported a learning rate even though learning was switched off. Some recovery checks also mislabelled uncertainty ranges.
>
> **Resolution:**
>
> - Remove learning parameters from the baseline model.
> - Reject saved fits from incompatible code versions.
> - Label uncertainty ranges to match their calculation.
>
> **Scientific impact:** Could change scientific conclusions. Removing meaningless estimates and correcting uncertainty labels could change how researchers interpret model results; no comparison of conclusions has been run.

## Output format

Produce copy-pasteable Markdown using the structure below. Omit optional sections that add no needed information beyond earlier sections; do not fill them to make the description look complete. Always retain scientific impact near the top and relevant validation. Follow required repository templates.

## TL;DR

**Problem:** <State the issue or need and why it matters.>

**Resolution:** <State the conceptual correction; use brief bullets for distinct corrections.>

**Scientific impact:** <One assessment from the impact guidance, with a brief reason.>

## What changed

<Add only details needed beyond the TL;DR. Use focused bullets for distinct changes or a short paragraph for one connected change.>

## How the logic changed

<Use the format-selection guidance above. Rename this heading to fit the content, or omit the section if prose already explains the change.>

## Design decisions

<Explain notable choices, alternatives, constraints, or intentional non-goals. Include only decisions supported by the code or supplied context.>

## Risk and compatibility

<Describe concrete risks, compatibility considerations, migration/deployment ordering, feature flags, or rollback concerns. Write "Low risk" only when supported and explain why.>

## Validation

- "<command or check>" - passed
- "<command or check>" - failed: <brief reason>
- Not run: "<check>" - <reason>

## Reviewer notes

<Call out the files, behavior, assumptions, or questions that deserve particular reviewer attention.>

## Writing style

Write like an experienced colleague leaving notes on their own work for someone who will read the diff next. A reviewer should not be able to tell whether a person or a tool drafted the description.

### Be short

- There is no minimum length. Keep ordinary PR descriptions under 300 words outside diagrams or logic examples; use more only when the change needs it for accurate review. Simple PRs should be much shorter.
- Say each thing once, in the most useful section. The TL;DR is the overview; later sections should add only necessary detail.
- Treat lists of topics to inspect as reasoning aids, not requests for a paragraph on each topic. Do not invent risks, alternatives, or non-goals to populate the template.
- Cut sentences that only announce the next sentence, such as "This PR makes several changes to the parser. First, ...".
- Do not list every file, test, or renamed symbol. Reviewers can read the file list.

### Make it easy to scan

- Keep each paragraph to one idea and usually one or two short sentences. Split it when the topic changes; do not compress a long paragraph into one long sentence.
- Use bullets for distinct changes, risks, or validation results. Keep each bullet focused on one point and its consequence rather than turning it into a paragraph.
- Lead with the consequence reviewers need to understand, then give only the details needed to explain it. Describe the final behavior, not a running account of the implementation work.
- Use a small table when comparing several before-and-after behaviors is clearer than prose. Avoid nested lists and headings for every minor detail.

### Sound like a person

- Use plain verbs: `use` rather than `utilize` or `leverage`, `let` rather than `enable`, `add` rather than `introduce support for`, `so that` rather than `in order to`.
- Name the thing that broke and the thing that fixed it. "The retry loop reused a closed socket" is better than "an issue with connection handling was addressed".
- Write "this PR" or "I" where that is natural instead of using the passive voice to avoid naming an actor.

### Keep the whole description in plain English

Apply the TL;DR translation table throughout. Later sections may include code details needed for review.

- Assume the reader knows the science and the project, not software-engineering vocabulary. Terms such as `model`, `parameter`, `posterior`, `regression`, `simulation`, and `convergence` need no explanation.
- Say what the code does, not what category of thing it is: "the fitting step now retries once before giving up", not "retry semantics were added to the estimation layer".
- Use backticks for symbols, paths, commands, configuration keys, and values. Explain unfamiliar codebase terms only when needed, and expand uncommon acronyms on first use.
- Do not use these unless the repository itself does: `orchestration`, `abstraction`, `layer`, `surface`, `contract`, `lifecycle`, `idiomatic`, `first-class`, `single source of truth`, `separation of concerns`, `refactor` used as a noun for the whole PR.

### Avoid these tells

Do not use:

- inflated adjectives and adverbs: `comprehensive`, `robust`, `seamless`, `powerful`, `extensive`, `thorough`, `carefully`, `significantly`, or `critical` unless it states an actual severity;
- filler openers: `It is worth noting that`, `It should be mentioned that`, `Importantly`, `Notably`, `Essentially`, `Fundamentally`;
- formulaic connectives: `Additionally`, `Furthermore`, `Moreover`, `In summary`, `Overall`;
- the `not just X, but Y` and `X isn't A - it's B` constructions;
- three-item lists in which the third item is padding, and parallel triples used for rhythm;
- closing sentences that summarize without adding information, such as "Together, these changes improve reliability.";
- decorative headings and bold text for mid-sentence emphasis (a few emoji are fine if the repository's other PRs use them, but do not put one on every heading or bullet);
- self-praise about the work: `clean`, `elegant`, `properly`, `correctly`, `as expected`, `production-ready`.

### Say only what you know

- State uncertainty directly: `The diff suggests ...`, `I could not verify ...`, `This appears to ...`.
- Do not write "improves robustness" or similar without saying which failure stops happening.

### Example

Avoid:

> This PR introduces a comprehensive refactor of the session reservation lifecycle. Additionally, it significantly hardens the validation layer by ensuring that stale reservations are properly detected. Overall, these changes improve the robustness and maintainability of the orchestration subsystem.

Write instead:

> Reservations were never released when a worker exited during setup, blocking the next run.
>
> - Record the owning process so `reapReservations()` can release reservations whose owner is gone.
> - Update two callers to handle reservations ending when a worker exits.
>
> **Scientific impact:** No change to scientific conclusions expected. This changes worker cleanup; analysis inputs and calculations are unchanged.

## Existing PR templates

If the repository contains a pull request template:

1. Preserve its required headings and checklists.
2. Map this skill's content into that structure, keeping the labelled scientific impact statement near the top under an appropriate existing heading.
3. Do not mark checklist items complete without evidence.
4. Place the chosen diagram or logic explanation under the most appropriate technical-details heading, or add `## How the logic changed` if the template permits it. Omit it when it adds nothing.

## Updating an existing PR description

When an existing PR body is available:

1. Preserve accurate user-written context, links, issue references, and required template sections.
2. Correct statements that conflict with the current diff.
3. Remove stale implementation details.
4. Avoid duplicating equivalent sections.
5. Present the proposed replacement body before making any remote change, unless the user explicitly requested immediate updating and the environment permits it.

## Final checks

Before returning the description, confirm that:

- the comparison range is clear and the main changes are covered;
- claims and any diagram or logic explanation match the available evidence;
- scientific impact is explicit and distinguishes potential effects from observed changes;
- validation accurately distinguishes checks run, results, and relevant checks not run;
- the TL;DR meets its reading-level and length requirements;
- the description follows the required template, is easy to scan, and contains no repetition or filler.
