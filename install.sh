#!/bin/sh
# POSIX wrapper (Linux, macOS, BusyBox, Git Bash on Windows) for the cross-platform installer.
# All options are passed through: sh install.sh --help
DIR=$(cd "$(dirname "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo "error: node (>= 18) is required; install it from https://nodejs.org and run this again" >&2
  exit 1
fi
exec node "$DIR/install.mjs" "$@"
