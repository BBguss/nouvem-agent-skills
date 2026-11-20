#!/bin/sh
# Kept for compatibility: links every skill into each harness skills dir, without hooks.
# Use install.sh for the full setup (automatic skill activation included).
exec sh "$(dirname "$0")/install.sh" --links-only "$@"
