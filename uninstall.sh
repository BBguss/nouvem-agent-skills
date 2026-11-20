#!/bin/sh
# Remove only what install.sh created: skill links pointing into this pack, hook entries
# running this pack's router, the opencode plugin file, and the managed instruction blocks.
# Real folders, other links, other hooks and the rest of each file are left untouched;
# every edited file gets a .bak-<timestamp> copy first.
#
# Usage: sh uninstall.sh [--dry-run] [--harness LIST] [--project DIR]
set -u

PACK=$(cd "$(dirname "$0")" && pwd -P)
LIB="$PACK/hooks/install-lib.mjs"
NEEDLE="$PACK/hooks/skill-router.mjs"
DRY=0
ONLY=""
PROJECT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --harness) shift; ONLY="${1:-}" ;;
    --harness=*) ONLY="${1#*=}" ;;
    --project) shift; PROJECT="${1:-}" ;;
    --project=*) PROJECT="${1#*=}" ;;
    --no-hooks|--links-only) ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v node >/dev/null 2>&1 || { echo "error: node is required" >&2; exit 1; }
export DRY_RUN=$DRY
[ "$DRY" = 1 ] && echo "(dry run: nothing will be changed)"

wanted() { [ -z "$ONLY" ] && return 0; case ",$ONLY," in *",$1,"*) return 0 ;; esac; return 1; }

unlink_skills() { # unlink_skills <dir>
  [ -d "$1" ] || return 0
  n=0
  for l in "$1"/*; do
    [ -L "$l" ] || continue
    t=$(readlink "$l")
    case "$t" in "$PACK"/*) [ "$DRY" = 0 ] && rm -f "$l"; n=$((n + 1)) ;; esac
  done
  echo "  $1: $n links removed"
}

rm_hook() { [ -f "$1" ] && echo "  hook in $1: $(node "$LIB" remove-hook "$1" "$NEEDLE")"; }
rm_block() { [ -f "$1" ] && echo "  managed block in $1: $(node "$LIB" block-remove "$1")"; }

if [ -n "$PROJECT" ]; then
  PROJECT=$(cd "$PROJECT" && pwd -P) || exit 1
  echo "project $PROJECT"
  rm_hook "$PROJECT/.claude/settings.json"
  rm_block "$PROJECT/AGENTS.md"
  exit 0
fi

H=$HOME
if wanted claude; then echo "claude"; unlink_skills "$H/.claude/skills"; rm_hook "$H/.claude/settings.json"; fi
if wanted agents; then echo "agents"; unlink_skills "$H/.agents/skills"; fi
if wanted codex; then echo "codex"; unlink_skills "$H/.codex/skills"; rm_hook "$H/.codex/hooks.json"; rm_block "$H/.codex/AGENTS.md"; fi
if wanted gemini; then echo "gemini"; unlink_skills "$H/.gemini/skills"; rm_hook "$H/.gemini/settings.json"; rm_block "$H/.gemini/GEMINI.md"; fi
if wanted opencode; then
  echo "opencode"
  unlink_skills "$H/.config/opencode/skills"
  p="$H/.config/opencode/plugins/skill-pack-router.js"
  if [ -f "$p" ] && grep -q 'skill-pack-router (opencode plugin)' "$p"; then
    [ "$DRY" = 0 ] && rm -f "$p"; echo "  plugin $p: removed"
  fi
  rm_block "$H/.config/opencode/AGENTS.md"
fi
echo "Done$( [ "$DRY" = 1 ] && echo ' (dry run)')."
