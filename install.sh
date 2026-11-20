#!/bin/sh
# Install the skill pack: link skills into every detected agent harness and wire up
# automatic skill activation (prompt hooks where the harness has them, a managed
# instructions block where it does not). POSIX sh; works on Linux, macOS and BusyBox.
# Idempotent: running it again only changes what is missing or outdated.
#
# Usage: sh install.sh [--dry-run] [--harness claude,agents,codex,gemini,opencode]
#                      [--no-hooks] [--project DIR] [--uninstall] [-h|--help]
set -u

PACK=$(cd "$(dirname "$0")" && pwd -P)
ROUTER="$PACK/hooks/skill-router.mjs"
LIB="$PACK/hooks/install-lib.mjs"
HOOK_CMD="node \"$ROUTER\""
DRY=0
HOOKS=1
LINKS_ONLY=0
ONLY=""
PROJECT=""

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

  --dry-run          show what would change, change nothing
  --harness LIST     only these harnesses (comma separated): claude, agents, codex, gemini, opencode
  --no-hooks         link skills and write instruction blocks, but register no hook or plugin
  --links-only       only link skills (what link-all.sh does)
  --project DIR      install into one project instead of the user's home:
                     DIR/.claude/settings.json hook + managed block in DIR/AGENTS.md
  --uninstall        run uninstall.sh with the same options
EOF
}

UNINSTALL=0
for a in "$@"; do [ "$a" = --uninstall ] && UNINSTALL=1; done
if [ "$UNINSTALL" = 1 ]; then
  n=$#; i=0
  while [ "$i" -lt "$n" ]; do a=$1; shift; i=$((i + 1)); [ "$a" = --uninstall ] || set -- "$@" "$a"; done
  exec sh "$PACK/uninstall.sh" "$@"
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --no-hooks) HOOKS=0 ;;
    --links-only) HOOKS=0; LINKS_ONLY=1 ;;
    --harness) shift; ONLY="${1:-}" ;;
    --harness=*) ONLY="${1#*=}" ;;
    --project) shift; PROJECT="${1:-}" ;;
    --project=*) PROJECT="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if ! command -v node >/dev/null 2>&1; then
  echo "error: node (>= 18) is required for the skill router and the installer helpers" >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "error: node >= 18 required, found $(node --version)" >&2
  exit 1
fi

export DRY_RUN=$DRY
TMPD=$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/skill-pack.$$")
mkdir -p "$TMPD"
trap 'rm -rf "$TMPD"' EXIT INT TERM
SUMMARY="$TMPD/summary"
: > "$SUMMARY"
say() { echo "$*" >> "$SUMMARY"; }
[ "$DRY" = 1 ] && echo "(dry run: nothing will be changed)"

wanted() { # wanted <harness>
  [ -z "$ONLY" ] && return 0
  case ",$ONLY," in *",$1,"*) return 0 ;; esac
  return 1
}

points_into_pack() { # points_into_pack <link>
  t=$(readlink "$1" 2>/dev/null) || return 1
  case "$t" in "$PACK"/*|"$PACK") return 0 ;; esac
  return 1
}

# ---------- skill links ----------
link_skills() { # link_skills <skills dir>
  dir="$1"; made=0; same=0; skipped=0; pruned=0
  if [ "$DRY" = 0 ]; then mkdir -p "$dir"; fi
  for d in "$PACK"/*/; do
    d=${d%/}; n=${d##*/}
    [ -f "$d/SKILL.md" ] || continue
    case "$n" in _*|.*|hooks|tests|scripts) continue ;; esac
    dest="$dir/$n"
    if [ -L "$dest" ]; then
      if [ "$(readlink "$dest")" = "$d" ]; then same=$((same + 1)); continue; fi
      if ! points_into_pack "$dest"; then
        echo "  skip $dest (link to $(readlink "$dest"), not this pack)"; skipped=$((skipped + 1)); continue
      fi
    elif [ -e "$dest" ]; then
      echo "  skip $dest (real folder, not a link; left untouched)"; skipped=$((skipped + 1)); continue
    fi
    [ "$DRY" = 0 ] && ln -sfn "$d" "$dest"
    made=$((made + 1))
  done
  # links into the pack whose skill was removed
  for l in "$dir"/*; do
    [ -L "$l" ] || continue
    if points_into_pack "$l" && [ ! -e "$l" ]; then
      [ "$DRY" = 0 ] && rm -f "$l"
      pruned=$((pruned + 1))
    fi
  done
  say "  links in $dir: $made new/updated, $same unchanged, $skipped skipped, $pruned stale removed"
}

# ---------- hooks and managed blocks ----------
add_hook() { # add_hook <settings file> <event> <style>
  r=$(node "$LIB" add-hook "$1" "$2" "$HOOK_CMD" "$3")
  case "$r" in
    added|created) say "  hook $2 -> $1: $r$( [ "$DRY" = 1 ] && echo ' (dry run)')" ;;
    unchanged) say "  hook $2 -> $1: already present" ;;
    *) say "  hook $2 -> $1: FAILED ($r), file left unchanged" ;;
  esac
  if [ "$DRY" = 0 ] && [ -f "$1" ]; then
    v=$(node "$LIB" check-json "$1")
    [ "$v" = valid ] || say "  WARNING: $1 is not valid JSON after the change; restore the newest $1.bak-*"
  fi
}

BLOCK="$TMPD/block.md"
make_block() {
  {
    echo "## Skill pack: automatic skill loading"
    echo
    echo "Skills from the pack at \`$PACK\` are installed. Do not wait for a slash command: when the user's words, sentence or task context match a row below (any language), read that SKILL.md and follow it before acting. When two or more rows match, load each one (and \`dynamic-workflow\` if it is listed) and sequence them. Project instructions (AGENTS.md/CLAUDE.md/GEMINI.md) and project-level skills with the same purpose take precedence over these skills."
    echo
    node "$ROUTER" --table
  } > "$BLOCK"
}

set_block() { # set_block <file>
  [ "$LINKS_ONLY" = 1 ] && return 0
  r=$(node "$LIB" block-set "$1" "$BLOCK")
  case "$r" in
    unchanged) say "  managed block in $1: up to date" ;;
    error|"") say "  managed block in $1: FAILED" ;;
    *) say "  managed block in $1: $r$( [ "$DRY" = 1 ] && echo ' (dry run)')" ;;
  esac
}

gemini_has_hooks() {
  command -v gemini >/dev/null 2>&1 || return 1
  v=$(gemini --version 2>/dev/null | head -n 1 | sed 's/[^0-9.].*//')
  maj=${v%%.*}; rest=${v#*.}; min=${rest%%.*}
  case "$maj$min" in ''|*[!0-9]*) return 1 ;; esac
  # hooks (BeforeAgent with additionalContext) ship from Gemini CLI 0.20 onward
  [ "$maj" -gt 0 ] || [ "$min" -ge 20 ]
}

install_opencode_plugin() { # install_opencode_plugin <opencode config dir>
  dest="$1/plugins/skill-pack-router.js"
  sed "s|__SKILL_PACK_DIR__|$PACK|" "$PACK/hooks/opencode-plugin.js" > "$TMPD/plugin.js"
  if [ -f "$dest" ] && cmp -s "$dest" "$TMPD/plugin.js"; then
    say "  opencode plugin $dest: up to date"; return
  fi
  if [ -f "$dest" ] && ! grep -q 'skill-pack-router (opencode plugin)' "$dest"; then
    say "  opencode plugin $dest: exists and is not ours, left untouched"; return
  fi
  if [ "$DRY" = 0 ]; then mkdir -p "$1/plugins"; cp "$TMPD/plugin.js" "$dest"; fi
  say "  opencode plugin $dest: installed$( [ "$DRY" = 1 ] && echo ' (dry run)')"
}

make_block

# ---------- project mode ----------
if [ -n "$PROJECT" ]; then
  if [ ! -d "$PROJECT" ]; then echo "error: project dir not found: $PROJECT" >&2; exit 1; fi
  PROJECT=$(cd "$PROJECT" && pwd -P)
  say "project $PROJECT"
  if [ "$HOOKS" = 1 ]; then add_hook "$PROJECT/.claude/settings.json" UserPromptSubmit claude; fi
  set_block "$PROJECT/AGENTS.md"
  echo
  echo "Done. Summary:"; cat "$SUMMARY"
  exit 0
fi

# ---------- per harness (user level) ----------
H=$HOME
found=0

if wanted claude && { [ -d "$H/.claude" ] || command -v claude >/dev/null 2>&1; }; then
  found=1; say "claude (Claude Code)"
  link_skills "$H/.claude/skills"
  # Claude Code also matches skills by description natively; the hook makes it reliable
  if [ "$HOOKS" = 1 ]; then add_hook "$H/.claude/settings.json" UserPromptSubmit claude; fi
fi

if wanted agents && [ -d "$H/.agents" ]; then
  found=1; say "agents (shared ~/.agents skills dir)"
  link_skills "$H/.agents/skills"
fi

if wanted codex && { [ -d "$H/.codex" ] || command -v codex >/dev/null 2>&1; }; then
  found=1; say "codex (Codex CLI)"
  link_skills "$H/.codex/skills"
  # Codex reads Claude-style hooks from ~/.codex/hooks.json; new hooks need one-time trust in Codex (/hooks)
  if [ "$HOOKS" = 1 ]; then add_hook "$H/.codex/hooks.json" UserPromptSubmit claude; fi
  set_block "$H/.codex/AGENTS.md"
fi

if wanted gemini && { [ -d "$H/.gemini" ] || command -v gemini >/dev/null 2>&1; }; then
  found=1; say "gemini (Gemini CLI / Antigravity)"
  link_skills "$H/.gemini/skills"
  if [ "$HOOKS" = 1 ] && [ -f "$H/.gemini/settings.json" ] && gemini_has_hooks; then
    add_hook "$H/.gemini/settings.json" BeforeAgent gemini
  else
    say "  no Gemini CLI hook support detected (needs gemini >= 0.20 and ~/.gemini/settings.json); using instructions block"
    set_block "$H/.gemini/GEMINI.md"
  fi
fi

if wanted opencode && { [ -d "$H/.config/opencode" ] || command -v opencode >/dev/null 2>&1; }; then
  found=1; say "opencode"
  link_skills "$H/.config/opencode/skills"
  if [ "$HOOKS" = 1 ] && [ -d "$H/.config/opencode/node_modules/@opencode-ai/plugin" ]; then
    install_opencode_plugin "$H/.config/opencode"
  fi
  set_block "$H/.config/opencode/AGENTS.md"
fi

[ "$found" = 0 ] && say "no supported agent harness found under $H (claude, agents, codex, gemini, opencode)"

# warm the router index
[ "$DRY" = 0 ] && node "$ROUTER" --rebuild >/dev/null 2>&1

echo
echo "Done$( [ "$DRY" = 1 ] && echo ' (dry run)'). Summary:"
cat "$SUMMARY"
echo "Test it: node \"$ROUTER\" --explain \"deploy this to production\""
