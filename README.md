# agent-skills

Shared [Agent Skills](https://agentskills.io), agents and an execution policy for
three platforms: Claude Code, Codex and OpenCode. One copy of each, symlinked so
every platform reads the same files.

A **skill** is a directory containing a `SKILL.md` — YAML frontmatter plus
markdown instructions. The format is an open standard, so the same directory
works unmodified on every platform. A platform loads only each skill's `name` and
`description` at startup, and reads the full instructions when a task matches.

An **agent** is a named persona — its own prompt, model and tool permissions —
that you can launch a session as, or delegate a task to. Agents are not covered
by the skills standard, so they need a little per-platform wiring (see
[Agents](#agents)).

## Layout

```
skills/<name>/SKILL.md          one directory per skill, plus any bundled scripts/
agents/<name>/claude.md         one directory per agent, with a thin file
agents/<name>/opencode.md         for each platform (model + permissions)
agents/<name>/codex.toml
commands/opencode/<name>.md     OpenCode slash commands, each a one-line skill launcher
policy/execution-policy.md      optional always-on instructions (--with-policy)
scripts/install.sh              links everything into place
```

## Requirements

- `bash` and `git`
- `node` — only for `langsmith-review`, which bundles a helper script
- At least one of Claude Code, Codex, or OpenCode

Linux and macOS. The installer uses GNU `find -printf` and `mapfile`, so on macOS
you will need `findutils` and a `bash` newer than the system 3.2.

## Quick start

```sh
git clone https://github.com/tobywise/agent-skills.git
cd agent-skills
bash scripts/install.sh
```

Clone it wherever you like — the installer resolves paths relative to itself, so
there is no fixed location. Restart each platform afterwards.

To also install the shared execution policy as every platform's always-on
instructions, add `--with-policy` (see [Policy](#policy)).

Re-run the installer after `git pull`, or after adding or removing a skill or
agent.

The installer finds each platform in its default location. Override with
`AGENTS_HOME`, `CLAUDE_HOME`, `CODEX_HOME` or `OPENCODE_HOME` (defaults
`~/.agents`, `~/.claude`, `~/.codex`, `~/.config/opencode`).

## How it works

Every platform supports the standard; they just scan different directories:

| Platform | Scans | How it is wired |
|---|---|---|
| Codex | `~/.agents/skills` | native — one directory symlink |
| OpenCode | `~/.agents/skills` | native — the same symlink |
| Claude Code | `~/.claude/skills` | one symlink per skill |

So the installer makes two kinds of skill link:

```
~/.agents/skills        -> <repo>/skills          # Codex + OpenCode
~/.claude/skills/<name> -> <repo>/skills/<name>   # Claude Code
```

Agents are handled separately; see [Agents](#agents).

Because these are symlinks into the working tree, an edit here is live in the
next session of every platform, and `git status` shows what they are running.
The trade-off is the usual one: **switching branches switches your live skills,
agents and policy** on every platform at once.

The installer creates `~/.agents/skills` unconditionally, since both Codex and
OpenCode read it whether or not they are installed yet. It skips Claude Code if
`~/.claude` is absent. It refuses to overwrite a real file or directory at any
target path, and prunes links to skills, agents or commands that no longer exist here.

## Verify it worked

Linking isn't loading, so check with each platform itself.

For skills:

| Platform | Check |
|---|---|
| Claude Code | skills are listed at session start; `ls -lL ~/.claude/skills/*/SKILL.md` |
| Codex | `codex debug prompt-input` — the skill names appear in what the model sees |
| OpenCode | `opencode debug skill` — lists every skill and the file it was loaded from |

`codex doctor` does **not** report skills, so it cannot confirm this.

For agents:

| Platform | Check |
|---|---|
| Claude Code | `claude --agent no-such-agent -p hi` — the error lists every available agent |
| OpenCode | `opencode debug config` — agents appear under `agent`; `opencode debug skill` lists skills and the file each was loaded from |
| Codex | ask it which agent types its `spawn_agent` tool accepts |

`claude agents --json` lists running *sessions*, not agent definitions.

For the policy: `codex debug prompt-input` shows it for Codex. Claude Code and
OpenCode have no equivalent, so ask each to quote a line of its global
instructions (e.g. `claude -p "…"`, `opencode run "…"`).

## Skills

| Skill | Purpose | Needs |
|---|---|---|
| `pr-description` | Reviewer-focused PR description with a call dependency diagram | `git`, `gh` |
| `scientific-analysis` | The `SCIENTIFIC_ANALYSIS` review-standard rigor policy | a global fail-fast policy (see below) |
| `grill-me` | Interview the user about a design until shared understanding | — |
| `slide-deck` | Navigable HTML slide deck | — |
| `planning` | The shared plan format: sections, verification fields, budgets, splitting, revisions | — |
| `create-plan` | Write one plan (or a revised copy) in the `planning` format | — |
| `create-multiple-plans` | Ordered plans for independently useful vertical slices | — |
| `create-scientific-rework-plan` | Audit a scientific codebase, plan a single-use rework | — |
| `implement-direct` | Implement a plan in-session without running tests or checks | — |
| `orchestrate` | Guide for the main session to carry a plan through implement → review → verify | — |
| `langsmith-review` | Read-only LangSmith trace review through the bundled helper | LangSmith, Paseo |
| `debrief` | Evidence-based LangSmith debrief or postmortem | LangSmith, Paseo |
| `review-implementation` | Read-only review of an implementation against its plan, with scientific tiers | — |
| `scientific-risk-review` | Second opinion on whether a finding should block, or could be accepted | — |
| `prototype` | One rapid, exploratory, single-use scientific analysis prototype | — |
| `run-checks` | How tests, builds and other checks run on this machine: locally, or on Crabbox workers if present | — |

**Not everything here is generic.** Two skills assume infrastructure you
probably do not have:

- `langsmith-review` and `debrief` query [LangSmith](https://smith.langchain.com)
  for traces emitted by OpenCode and Paseo sessions. They need `LANGSMITH_API_KEY`
  in the environment and are useless without that stack. Delete them if you do
  not use it.

Remote workers are handled differently: see [Running checks](#running-checks).

`scientific-analysis` has a different kind of dependency. It opens by saying it
"supplements the global scientific fail-fast policy". That policy isn't a skill:
it's always-on instructions, because it must apply to all scientific work, not
only when a skill happens to load. It ships in `policy/execution-policy.md`
and is installed with `--with-policy`. Without it you get the proportionality
half of the style (`SINGLE_USE`, `ONE_CALL`, proportionate proof) but not the
strictness half: fail at first detection, never catch-and-warn, never substitute
a model to get past a failure.

The rest are environment-independent.

The plan skills share one format, defined in `planning`: numbered contracts
(`C-01`) and acceptance items (`AC-01`), plus verification fields such as
`IMPLEMENTATION_CHECKS` and `FINAL_SUITE`. `implement-direct`,
`review-implementation` and `orchestrate` all read plans in that format, so
they work together; the terms are defined in `planning` itself.

## Policy

`policy/execution-policy.md` is one set of always-on instructions shared by all
three platforms. It's written without platform-specific tool names, so the same
text works everywhere. It covers PR descriptions, Python conventions, the
scientific fail-fast rule, the prototype exception, what "complete" means, and
one pointer: load `run-checks` before running anything expensive. Nothing in it
is machine-specific.

It's opt-in, because it is one person's working rules rather than a generic
default:

```sh
bash scripts/install.sh --with-policy
```

| Platform | How it's wired |
|---|---|
| Codex | `~/.codex/AGENTS.md` → symlink to the policy |
| OpenCode | `~/.config/opencode/AGENTS.md` → symlink to the policy |
| Claude Code | `~/.claude/CLAUDE.md` gets one `@<path>` import line; anything else in that file is left alone |

Codex and OpenCode have no import syntax for their global `AGENTS.md`, so for
them the file itself must be the link. If either already has a real `AGENTS.md`,
the installer stops rather than overwrite it — move it aside first. It also
warns if `CLAUDE.md` imports some *other* `execution-policy.md`, which would load
the policy twice.

When editing the policy, keep it platform-neutral: say "the shell tool", "load
the skill", "the project's own agent configuration" — never a specific tool name
like `Bash` or a path like `.codex/config.toml`.

## Running checks

Where tests and builds should run differs between machines. On the author's
machines, the machine you work on is a *controller* that edits code and sends
checks to disposable cloud workers through **Crabbox** (`cbrun`/`cbrun-uv`), a
private wrapper. Most people just run checks locally.

The `run-checks` skill handles both, so nothing needs configuring:

```
skills/run-checks/SKILL.md               detect the runner; local rules; rules for both
skills/run-checks/references/crabbox.md  the Crabbox rules, read only if cbrun exists
```

The first time a session needs to run a check, it first looks at the project's
own agent instructions (`AGENTS.md` or `CLAUDE.md`). If they name a runner,
that wins. To make one repository run its checks locally even on a Crabbox
machine, add a line like this to that file:

```md
Checks in this repository run locally, even where Crabbox is available.
```

Otherwise it runs `command -v cbrun`:

- **Not found:** checks run locally in the project's locked environment
  (`uv run --locked`, `make`, …). Locked setup is allowed; adding or upgrading
  dependencies to make a check pass is not. Intensive scientific analyses are
  handed to you with the exact command.
- **Found:** the session reads `references/crabbox.md` and runs checks only on
  workers, never on the controller itself.

The policy carries two always-on lines for this: *load `run-checks` before
running anything expensive*, and a backstop, *if `cbrun` is on `PATH`, never
run those commands directly on this machine*, unless the project says its checks
run locally. The backstop does nothing on machines without Crabbox. The Crabbox detail (~100 lines) is only in context
when it's actually used.

Plans and skills refer to the runner generically. A plan's `RUNNER` field names
whatever `run-checks` chose, and `prototype` asks whether to run now with this
machine's runner, hand the run to you, or not run it.

To support another remote system, add `references/<system>.md` and a detection
branch to `run-checks`.

## Agents

Agents are **not** part of the Agent Skills standard: each platform defines them
in its own format and directory. So each agent here is a directory with one
thin file per platform, and the installer links each into place:

```
agents/<name>/claude.md    -> ~/.claude/agents/<name>.md
agents/<name>/opencode.md  -> ~/.config/opencode/agents/<name>.md
agents/<name>/codex.toml   -> ~/.codex/agents/<name>.toml
```

Those files hold only what genuinely differs between platforms — the model
name and the permissions, each in that platform's own syntax. Their
instructions are one line: *load skill X and follow it*. The actual behaviour
lives in the shared skill, so it exists once.

| Agent | Loads skill | Permissions |
|---|---|---|
| `code-reviewer` | `review-implementation` | Read-only |
| `scientific-risk-reviewer` | `scientific-risk-review` | Read-only, no shell |
| `code-implementer` | `implement-direct` | Unrestricted |
| `code-prototype` | `prototype` | Unrestricted |

"Read-only" is enforced by each platform itself rather than by the prompt, with
one gap on Claude Code:

| Platform | How read-only is expressed |
|---|---|
| Claude Code | `tools:` list with no `Edit`/`Write` |
| OpenCode | `permission: edit: deny`, shell limited to read-only `git` commands |
| Codex | `sandbox_mode = "read-only"` |

Claude's reviewer keeps `Bash` so it can run `git diff`, which means read-only
there relies partly on instructions; OpenCode and Codex enforce it fully.

`code-prototype` asks the user questions as it works, so run it as the session
agent (`claude --agent code-prototype`, or `/prototype` in OpenCode) rather
than delegating to it. Codex subagents can't be launched as the session, so
`code-prototype` has no Codex file; in Codex, invoke the `prototype` skill
directly.

To add an agent: write its instructions as a skill, create
`agents/<name>/` with any of the three platform files, and re-run the installer.
A platform file you omit simply isn't installed for that platform.

**Frontmatter gotcha:** Claude and OpenCode parse agent frontmatter as YAML, so a
`description` containing `: ` (colon then space) makes the agent fail to load.
Reword it, or quote the value.

## OpenCode commands

Claude Code and Codex let you invoke a skill by name. OpenCode's slash commands
are separate files, so `commands/opencode/` holds one thin launcher per
user-facing skill — *load skill X and follow it for this request* — linked into
`~/.config/opencode/commands/`. Launchers for skills that have an agent name
that agent (`/review-implementation` runs as `code-reviewer`), so they get its
model and permissions; the rest set no model and use whatever model the session
has selected.

When you add a user-facing skill, add a launcher here too. `planning` and
`scientific-analysis` have none: they're reference skills that other skills
load.

## Adding a skill

Create `skills/<name>/SKILL.md` with at least `name` and `description`
frontmatter, then re-run the installer. Bundled `scripts/`, `references/` and
`assets/` directories travel with the skill.

The `description` is what an agent matches against when deciding whether a skill
applies, so write it as a trigger — say when to use the skill, not just what it
does.

Keep skills platform-neutral. Anything naming one agent's tools, paths or
variables belongs in that agent's own configuration:

- Reference bundled helpers through the shared path —
  `~/.agents/skills/<name>/scripts/<helper>` — never a host variable like
  `${CLAUDE_PLUGIN_ROOT}`.
- Describe capabilities generically ("ask the user", "delegate to a subagent")
  rather than by a host's tool name.

## Removing a skill or agent

Delete its directory and re-run the installer, which prunes the dangling links.
For a skill, Codex and OpenCode need no action — they read `~/.agents/skills`
live.

## Uninstall

```sh
rm ~/.agents/skills
for l in ~/.claude/skills/* ~/.claude/agents/* ~/.config/opencode/agents/* ~/.codex/agents/* \
         ~/.config/opencode/commands/* \
         ~/.codex/AGENTS.md ~/.config/opencode/AGENTS.md; do
  [ -L "$l" ] || continue
  case "$(readlink "$l")" in */agent-skills/skills/*|*/agent-skills/agents/*|*/agent-skills/commands/*|*/agent-skills/policy/*) rm "$l";; esac
done
```

If you used `--with-policy`, also delete the `@…/execution-policy.md` line from
`~/.claude/CLAUDE.md`. Otherwise only symlinks are created, so nothing else is
left behind. Swap `rm "$l"` for
`echo "$l"` first if you want to see what it would remove.

## Troubleshooting

**A shared skill is silently ignored.** When the same name exists in two
places, OpenCode loads the copy in `~/.config/opencode/skills` and ignores the
shared one in `~/.agents/skills`, so edits here never reach it. Check with
`opencode debug skill`, which prints each skill's source file, and remove the
local copy.

**A skill appears twice.** Platforms scan several directories and will happily load
the same name from two of them. OpenCode in particular reads
`~/.config/opencode/skills`, `~/.claude/skills`, `~/.agents/skills` and the
project-local equivalents. Codex reads `~/.codex/skills` as well as
`~/.agents/skills`. If you previously installed any of these skills by copying,
remove the old copies rather than linking them twice.

**A skill or agent does not appear.** Restart the platform; all three read
skills and agents at startup. For an agent, also check its frontmatter parses
(see the gotcha under [Agents](#agents)).
Then confirm the symlink resolves (`ls -lL ~/.agents/skills/<name>/SKILL.md`) and
that the frontmatter has both `name` and `description`.

**The installer refuses a path.** It will not overwrite a real file or directory,
only its own stale symlinks. Move the existing path aside and re-run.

## Licence

MIT — see [`LICENSE`](LICENSE).
