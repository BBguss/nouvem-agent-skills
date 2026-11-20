#!/bin/sh
# Remove exactly what install.sh added (links into this pack, our hooks, managed blocks, plugin).
# Same options as the installer: sh uninstall.sh [--dry-run] [--harness LIST] [--project DIR]
DIR=$(cd "$(dirname "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo "error: node (>= 18) is required" >&2
  exit 1
fi
exec node "$DIR/install.mjs" --uninstall "$@"
