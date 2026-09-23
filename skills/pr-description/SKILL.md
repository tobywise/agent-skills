---
name: pr-description
description: Draft a reviewer-focused pull request description from the current branch changes. Explain what changed and why in clear prose, identify risks and validation, and include a compact source-verified ASCII call dependency diagram for affected executable code. Use when asked to write, improve, update, or review a PR description or explain a branch diff.
metadata:
  compatibility: claude-code, codex, opencode, agent-skills
  summary: Draft a reviewer-focused pull request description from the current branch changes, including a prose explanation and a source-verified ASCII call dependency diagram for newly added or modified code.
  audience: software-engineers
  workflow: pull-request
---

# PR Description

Create an accurate, reviewer-focused pull request description from the repository's current changes.

The final result must explain the change in prose, focus attention on meaningful behavior and design decisions, and include a compact ASCII call dependency diagram for newly added or modified executable code when one is useful.

## When to use

Use this skill when the user asks to:

- write or improve a pull request description;
- summarize the current branch or diff;
- explain what changed for reviewers;
- document newly added or modified execution paths;
- prepare text for `gh pr create` or `gh pr edit`.

Do not use it as a substitute for a full correctness or security review. Report important issues noticed during analysis, but keep the primary output focused on describing the change.

## Operating principles

1. Inspect the repository before drafting.
2. Treat source code and repository history as the source of truth.
3. Do not claim behavior, test coverage, or validation that was not verified.
4. Explain intent and behavior rather than paraphrasing every changed line.
5. Separate confirmed facts from reasonable inferences.
6. Optimize for a reviewer who understands the codebase but has not followed the implementation work.
7. Keep the result proportional to the change. Small diffs need small descriptions, and no section is mandatory.
8. Never invent issue numbers, benchmarks, rollout plans, screenshots, or test results.
9. Do not modify repository files unless the user explicitly asks.
10. Do not create or update a remote pull request unless the user explicitly asks.

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

Typical Git commands include:

```bash
git status --short
git branch --show-current
git remote show origin
git log --oneline --decorate --no-merges <base>..HEAD
git diff --stat <base>...HEAD
git diff --name-status <base>...HEAD
git diff <base>...HEAD
```

Adapt these commands to the repository and environment. Do not assume that `main` is the base branch.

## Analysis workflow

### 1. Establish the change boundary

Record:

- current branch;
- comparison base;
- commits included;
- changed files;
- whether uncommitted changes are included.

### 2. Build a semantic change inventory

Group changes by purpose rather than file order. Useful categories include:

- user-visible behavior;
- API or contract changes;
- domain or business logic;
- data model, persistence, or migrations;
- background jobs and asynchronous processing;
- configuration and deployment;
- observability and error handling;
- tests and fixtures;
- documentation and developer experience;
- refactoring with no intended behavior change.

For each group, determine:

- what changed;
- why it appears necessary;
- how the implementation works;
- what existing components it reuses;
- what compatibility or operational consequences it has.

### 3. Trace changed execution paths

For executable code that is new or modified:

1. Identify changed entry points, handlers, commands, jobs, constructors, exported functions, or public methods.
2. Read the complete changed symbols, not only the diff hunks.
3. Trace direct calls made by those symbols.
4. Continue through newly added or modified callees while the path remains relevant to the change.
5. Include unchanged dependencies only when they are needed to understand the new behavior.
6. Verify each edge from source code. Do not infer a call solely from names, imports, types, or directory structure.
7. Note important conditions, retries, asynchronous boundaries, persistence calls, external services, and error paths.
8. Avoid exhaustive whole-repository call graphs.

Label symbols as:

- `[NEW]` for symbols introduced by the change;
- `[MODIFIED]` for existing symbols whose executable behavior changed;
- `[EXISTING]` for unchanged dependencies included for context.

When status is ambiguous, omit the status rather than guessing.

### 4. Assess impact and risk

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

## ASCII call dependency diagram

Include an ASCII call dependency diagram when the change adds or modifies a meaningful execution path.

### Diagram rules

- Use a fenced `text` block.
- Use ASCII characters only.
- Show caller-to-callee direction from top to bottom or left to right.
- Prefer function, method, handler, job, or component names over filenames.
- Add short condition labels only where they clarify control flow.
- Mark asynchronous boundaries when important.
- Keep the diagram compact enough to scan in a PR description.
- Show the affected path, not the application's complete architecture.
- Omit test helpers, generated code, framework internals, trivial accessors, and unrelated utilities.
- Verify every call edge against the source.
- If there is no meaningful call relationship, write `No meaningful call dependency change.` instead of inventing one.

### Basic example

```text
[MODIFIED] handleRequest()
    |
    +--> [NEW] validatePolicy()
    |        |
    |        +--> [NEW] resolveRules()
    |                  |
    |                  +--> [EXISTING] PolicyStore.get()
    |
    +--> [EXISTING] loadConfig()
```

### Conditional example

```text
[MODIFIED] processOrder()
    |
    +--> [NEW] validateOrder()
    |
    +--> order valid?
           |
           +-- yes --> [MODIFIED] reserveInventory()
           |               |
           |               +--> [EXISTING] InventoryClient.reserve()
           |
           +-- no  --> [NEW] rejectOrder()
```

### Asynchronous example

```text
[MODIFIED] POST /imports
    |
    +--> [NEW] createImport()
             |
             +--> [EXISTING] ImportRepository.insert()
             |
             +-- async --> [NEW] processImportJob()
                                |
                                +--> [EXISTING] ObjectStore.read()
                                +--> [MODIFIED] importRows()
```

Immediately after the diagram, explain briefly:

- where execution begins;
- what new or modified path was introduced;
- which existing components are reused;
- any important branch, asynchronous boundary, persistence operation, external call, or error path.

## TL;DR plain-language standard

Write the TL;DR for an undergraduate researcher with introductory statistics and research-methods knowledge. Use a psychology undergraduate as the reading-level benchmark, but do not assume that the project uses any particular research method. The reader may recognize common method names, but does not know the codebase, software-engineering terminology, or advanced details of the project's methods.

The TL;DR must preserve enough research context to explain the change accurately. Do not make it so short or generic that the reader cannot tell what was wrong, what was corrected, or why the correction matters.

Use these content requirements:

- `Problem` states where the issue occurred in the research or analysis process, what was wrong, and why it could affect results or interpretation.
- `Resolution` describes the conceptual correction and any important safeguard in terms of the model, analysis, data, or reported output rather than internal code architecture.
- `Impact` explains what researchers can now interpret, trust, detect, or do differently and identifies the incorrect outcome being prevented.
- Use one or two short sentences for each field. A substantive change usually needs 60 to 110 words in total, and rarely more than 130; a small change needs far fewer. Never pad to reach a length.

Use these language requirements:

- Prefer concrete descriptions of what happens to the analysis, data, saved results, or researcher.
- Common research terms such as `model`, `parameter`, `variable`, `condition`, `simulation`, and `uncertainty interval` may be used without definition.
- A relevant method, such as reinforcement learning, regression, or simulation, may be named without explaining the entire method.
- Briefly explain specialized variants, advanced statistical concepts, project-specific terms, and uncommon acronyms when they are necessary.
- Remove software-engineering language from the TL;DR. Do not use code symbols, internal component names, or architecture labels unless they are also names that researchers see and need to recognize.
- Use active voice and everyday words. Write the sentence the way you would say it out loud to a colleague from another lab.
- Avoid compressed noun phrases that make the reader unpack several technical ideas at once. Break them into separate short sentences.
- If a sentence needs a comma-separated clause to define a term, ask whether the term is needed at all.
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

> **Problem:** The baseline model of repeated choices was still estimating a learning rate, even though learning was switched off for that model. Those numbers meant nothing. Separately, some older recovery checks labelled their uncertainty ranges wrongly.
>
> **Resolution:** The baseline model no longer reports learning parameters. Saved model fits now record the code version that produced them, and fits from an incompatible older version are rejected instead of reused. The uncertainty ranges now carry the labels that match how they were calculated.
>
> **Impact:** Results now show only the parameters the model can actually estimate, with correctly labelled uncertainty ranges, and out-of-date fits can no longer reach a published figure unnoticed.

## Output format

Produce copy-pasteable Markdown using the following structure. Omit sections that would be empty or meaningless.

## TL;DR

**Problem:** <In one to three plain-language sentences, describe where the issue occurs, what is wrong, and why it matters.>

**Resolution:** <In one to three plain-language sentences, describe the conceptual correction and any important safeguard without software-engineering terminology.>

**Impact:** <In one to three plain-language sentences, describe what researchers can now trust, interpret, detect, or do differently. Omit only when it would duplicate the resolution.>

## What changed

### <Semantic area>

<Explain the behavior and implementation in prose. Use bullets only where they improve scanning.>

### <Another semantic area>

<Explain related changes.>

## Affected call path

```text
<Source-verified ASCII call dependency diagram, or:
No meaningful call dependency change.>
```

<Brief interpretation of the diagram.>

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

- Aim for the shortest text that lets a reviewer open the diff with the right expectations. Most PRs need 150-400 words outside the diagram; a one-line fix needs two sentences.
- Drop any section with nothing real to say. No "Design decisions" section is better than one that restates the diff.
- Say each thing once. Do not repeat the TL;DR in "What changed", or the risks again in "Reviewer notes".
- Cut sentences that only announce the next sentence, such as "This PR makes several changes to the parser. First, ...".
- Do not list every file, test, or renamed symbol. Reviewers can read the file list.

### Sound like a person

- Use plain verbs: `use` rather than `utilize` or `leverage`, `let` rather than `enable`, `add` rather than `introduce support for`, `so that` rather than `in order to`.
- Prefer short declarative sentences, and vary their length. Do not write every paragraph as three balanced clauses.
- Name the thing that broke and the thing that fixed it. "The retry loop reused a closed socket" is better than "an issue with connection handling was addressed".
- Write "this PR" or "I" where that is natural instead of using the passive voice to avoid naming an actor.
- Explain unavoidable domain or codebase terms in passing. Do not stack several of them into one noun phrase.

### Keep the whole description in plain English

The TL;DR has its own stricter standard, but the rest of the description follows the same instinct: scientific and statistical vocabulary is fine, software-engineering jargon is not.

- Assume the reader knows the science and the project, not software-engineering vocabulary. Terms such as `model`, `parameter`, `posterior`, `regression`, `simulation`, and `convergence` need no explanation.
- Replace software-engineering abstractions with what actually happens. The translation table in the TL;DR standard above applies here too, not only in the TL;DR.
- Say what the code does, not what category of thing it is: "the fitting step now retries once before giving up", not "retry semantics were added to the estimation layer".
- Some terms are unavoidable in a code review, and function names, file paths, and commands belong here in backticks. Name them plainly and move on.
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
- Call a refactor behavior-preserving only when the code supports that claim.
- Do not write "improves robustness" or similar without saying which failure stops happening.
- Use backticks for symbols, paths, commands, configuration keys, and values.
- Expand uncommon acronyms on first use.
- Apply the TL;DR plain-language standard only to the TL;DR. Later sections keep the technical precision reviewers need, but still follow the rules above.

### Example

Avoid:

> This PR introduces a comprehensive refactor of the session reservation lifecycle. Additionally, it significantly hardens the validation layer by ensuring that stale reservations are properly detected. Overall, these changes improve the robustness and maintainability of the orchestration subsystem.

Write instead:

> Reservations were never released when a worker exited during provisioning, so the next run blocked on a lock held by a dead session. The lease now records the owning process, and `reapReservations()` clears entries whose owner is gone. Two callers that assumed a reservation always outlived its worker were updated.

## Existing PR templates

If the repository contains a pull request template:

1. Preserve its required headings and checklists.
2. Map this skill's content into that structure.
3. Do not mark checklist items complete without evidence.
4. Add the ASCII call path under the most appropriate technical-details heading, or add `## Affected call path` if the template permits it.

## Updating an existing PR description

When an existing PR body is available:

1. Preserve accurate user-written context, links, issue references, and required template sections.
2. Correct statements that conflict with the current diff.
3. Remove stale implementation details.
4. Avoid duplicating equivalent sections.
5. Present the proposed replacement body before making any remote change, unless the user explicitly requested immediate updating and the environment permits it.

## Final checks

Before returning the description, confirm that:

- the base and change scope are understood;
- major behavior changes are covered;
- statements are traceable to code, history, tests, or user-provided context;
- the call diagram contains only verified edges;
- new, modified, and existing symbols are labelled accurately;
- validation claims distinguish observed, run, passed, failed, and not-run checks;
- risks and compatibility notes are concrete;
- the TL;DR includes enough research or practical context to explain why the change matters;
- software-engineering language in the TL;DR has been replaced with concrete descriptions;
- necessary advanced or project-specific terms in the TL;DR are briefly explained;
- the TL;DR passes the undergraduate-researcher read-alone test and stays within its length;
- software-engineering jargon is plain English everywhere, while scientific terms are left intact;
- the output follows any repository PR template;
- every section earns its place, and none repeats another;
- no sentence uses the words and constructions listed under "Avoid these tells";
- the description could plausibly have been written by the author of the change;
- the result is copy-pasteable Markdown without additional conversational filler.
