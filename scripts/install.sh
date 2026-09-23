#!/usr/bin/env bash
#
# Install this repo's skills, agents, OpenCode commands and (optionally) policy
# for every platform on this machine: Claude Code, Codex and OpenCode.
#
# Skills follow the Agent Skills standard (agentskills.io): one directory per
# skill, each containing SKILL.md. Codex and OpenCode both scan ~/.agents/skills
# natively, so a single directory symlink serves both. Claude Code only scans
# ~/.claude/skills, so it gets one symlink per skill.
#
#   ~/.agents/skills        -> <repo>/skills          (Codex, OpenCode)
#   ~/.claude/skills/<name> -> <repo>/skills/<name>   (Claude Code)
#
# Everything is a symlink into this working tree, so an edit here is live in the
# next session of every platform, and `git status` shows what they are running.
#
# Idempotent. Re-run after `git pull`, or after adding or removing anything.

set -Eeuo pipefail

WITH_POLICY=0
for arg in "$@"; do
  case "$arg" in
    --with-policy) WITH_POLICY=1 ;;
    -h|--help)
      printf 'usage: %s [--with-policy]\n\n' "$0"
      printf '  --with-policy  also install policy/execution-policy.md as the always-on\n'
      printf '                 instructions for Claude Code, Codex and OpenCode\n'
      exit 0 ;;
    *) printf 'error: unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"

AGENTS_HOME="${AGENTS_HOME:-$HOME/.agents}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"

log()  { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

# Symlink $2 -> $1, replacing a stale symlink, but never silently destroying a
# real file or directory that something else put there.
link() {
  local target="$1" linkname="$2"

  [ -e "$target" ] || die "missing source: $target"

  if [ -L "$linkname" ]; then
    if [ "$(readlink "$linkname")" = "$target" ]; then
      log "  ok       ${linkname/#$HOME/\~}"
      return
    fi
    rm "$linkname"
  elif [ -e "$linkname" ]; then
    die "${linkname/#$HOME/\~} exists and is not a symlink; move it aside and re-run"
  fi

  ln -s "$target" "$linkname"
  log "  linked   ${linkname/#$HOME/\~}"
}

command -v node >/dev/null 2>&1 \
  || warn "node is not on PATH; the langsmith-review helper will not run"

mapfile -t SKILLS < <(cd "$SKILLS_DIR" && find . -maxdepth 2 -name SKILL.md -printf '%h\n' | sed 's|^\./||' | sort)
[ "${#SKILLS[@]}" -gt 0 ] || die "no SKILL.md found under $SKILLS_DIR"

log "Codex + OpenCode (shared ~/.agents/skills):"
mkdir -p "$AGENTS_HOME"
link "$SKILLS_DIR" "$AGENTS_HOME/skills"

log "Claude Code (per-skill symlinks):"
if [ -d "$CLAUDE_HOME" ]; then
  mkdir -p "$CLAUDE_HOME/skills"
  for skill in "${SKILLS[@]}"; do
    link "$SKILLS_DIR/$skill" "$CLAUDE_HOME/skills/$skill"
  done

  # Drop symlinks for skills that no longer exist in this repo.
  for existing in "$CLAUDE_HOME"/skills/*; do
    [ -L "$existing" ] || continue
    case "$(readlink "$existing")" in
      "$SKILLS_DIR"/*)
        [ -e "$existing" ] || { rm "$existing"; log "  pruned   ${existing/#$HOME/\~}"; }
        ;;
    esac
  done
else
  warn "no $CLAUDE_HOME; skipping Claude Code"
fi

# --- Agents -----------------------------------------------------------------
# Agents are not part of the Agent Skills standard: each platform has its own
# format. So each agent is one directory holding a thin file per platform —
# model and permissions only — whose instructions just load a shared skill.
#
#   agents/<name>/claude.md   -> ~/.claude/agents/<name>.md
#   agents/<name>/opencode.md -> ~/.config/opencode/agents/<name>.md
#   agents/<name>/codex.toml  -> ~/.codex/agents/<name>.toml

AGENTS_SRC="$REPO_ROOT/agents"
OPENCODE_HOME="${OPENCODE_HOME:-$HOME/.config/opencode}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

mapfile -t AGENT_NAMES < <(find "$AGENTS_SRC" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort)

# link_agents <platform label> <platform home> <source filename> <target ext>
link_agents() {
  local label="$1" home="$2" src="$3" ext="$4"
  log "$label agents:"
  if [ ! -d "$home" ]; then
    warn "no $home; skipping $label agents"
    return
  fi
  mkdir -p "$home/agents"
  local name
  for name in "${AGENT_NAMES[@]}"; do
    [ -f "$AGENTS_SRC/$name/$src" ] || continue
    link "$AGENTS_SRC/$name/$src" "$home/agents/$name.$ext"
  done
  # Drop links to agents that no longer exist in this repo.
  local existing
  for existing in "$home"/agents/*."$ext"; do
    [ -L "$existing" ] || continue
    case "$(readlink "$existing")" in
      "$AGENTS_SRC"/*)
        [ -e "$existing" ] || { rm "$existing"; log "  pruned   ${existing/#$HOME/\~}"; }
        ;;
    esac
  done
}

link_agents "Claude Code" "$CLAUDE_HOME"   claude.md   md
link_agents "OpenCode"    "$OPENCODE_HOME" opencode.md md
link_agents "Codex"       "$CODEX_HOME"    codex.toml  toml

# --- OpenCode commands ------------------------------------------------------
# Claude Code and Codex let you invoke a skill by name. OpenCode's slash
# commands are separate files, so each is a thin launcher that loads a skill.
#
#   commands/opencode/<name>.md -> ~/.config/opencode/commands/<name>.md

COMMANDS_SRC="$REPO_ROOT/commands/opencode"
mapfile -t COMMAND_NAMES < <(find "$COMMANDS_SRC" -maxdepth 1 -name '*.md' -printf '%f\n' 2>/dev/null | sed 's/\.md$//' | sort)

log "OpenCode commands:"
if [ -d "$OPENCODE_HOME" ]; then
  mkdir -p "$OPENCODE_HOME/commands"
  for name in "${COMMAND_NAMES[@]}"; do
    link "$COMMANDS_SRC/$name.md" "$OPENCODE_HOME/commands/$name.md"
  done
  for existing in "$OPENCODE_HOME"/commands/*.md; do
    [ -L "$existing" ] || continue
    case "$(readlink "$existing")" in
      "$COMMANDS_SRC"/*)
        [ -e "$existing" ] || { rm "$existing"; log "  pruned   ${existing/#$HOME/\~}"; }
        ;;
    esac
  done
else
  warn "no $OPENCODE_HOME; skipping OpenCode commands"
fi

# --- Policy (opt-in) --------------------------------------------------------
# One always-on instruction file for all three platforms. Opt-in because it is
# specific to a controller/worker setup (Crabbox, cbrun, HPC handoff).
#
#   Codex, OpenCode: their global AGENTS.md becomes a symlink to the policy.
#   Claude Code:     ~/.claude/CLAUDE.md gets an @import line, so any other
#                    content you keep in CLAUDE.md is left alone.

POLICY="$REPO_ROOT/policy/execution-policy.md"

if [ "$WITH_POLICY" = 1 ]; then
  [ -f "$POLICY" ] || die "missing $POLICY"
  log "Policy:"

  [ -d "$CODEX_HOME" ]    && link "$POLICY" "$CODEX_HOME/AGENTS.md"
  [ -d "$OPENCODE_HOME" ] && link "$POLICY" "$OPENCODE_HOME/AGENTS.md"

  if [ -d "$CLAUDE_HOME" ]; then
    claude_md="$CLAUDE_HOME/CLAUDE.md"
    import_line="@$POLICY"
    if [ -f "$claude_md" ] && grep -qxF "$import_line" "$claude_md"; then
      log "  ok       ${claude_md/#$HOME/\~} imports the policy"
    else
      printf '\n%s\n' "$import_line" >> "$claude_md"
      log "  added    import to ${claude_md/#$HOME/\~}"
    fi
    # Another imported copy would load the policy twice.
    if grep -E '^@.*execution-policy\.md$' "$claude_md" | grep -vxF "$import_line" | grep -q .; then
      warn "${claude_md/#$HOME/\~} also imports another execution-policy.md; remove it to avoid loading the policy twice"
    fi
  fi
fi

log ""
log "Installed ${#SKILLS[@]} skills: ${SKILLS[*]}"
log "Installed ${#AGENT_NAMES[@]} agents: ${AGENT_NAMES[*]}"
log "Installed ${#COMMAND_NAMES[@]} OpenCode commands"
log "Restart each platform to pick them up."
