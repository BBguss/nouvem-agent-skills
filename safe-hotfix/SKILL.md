---
name: safe-hotfix
description: Use when a small, already-tested backend fix must reach production now without a full release - "hotfix prod", "ship this fix", "copy the changed files to prod", "patch production". Ships only files from a commit already on the main remote ref, with guards, backup, syntax check, graceful reload, health check, auto-revert and a revert tag. Works for VPS (PM2/systemd/Docker), Kubernetes and PaaS projects of any type.
---

# Safe hotfix

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

## When to use
- Use when: the fix is small, tested in dev, committed and pushed to main, touches only files in an allowed directory, and the reload is graceful.
- Do not use (go to `release-deploy`): frontend/build assets, new or changed dependencies, schema migrations, files outside the allowed directory, or anything that drops service (`maintenance-window-ops`).
- Full flow from a log error: `prod-log-watch` section 3. Documentation: `error-runbook`.
- Image-based or immutable hosts (Kubernetes, Vercel, Netlify, Fly, Render, Heroku): there is no file copy. A "hotfix" is a fast redeploy of one tested commit, or a rollback. Apply the same guards (commit on main, tests, health check, revert target) to that redeploy.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<PROD_DIR>` | production code directory (never hand-edited) | `/srv/app-prod` |
| `<ALLOWED_DIR>` | only directory that may be hotfixed | `server/`, `src/api/` |
| `<DEP_FILES>` | dependency files that are rejected | `package.json`, lockfiles, `requirements.txt`, `go.mod`, `composer.json` |
| `<MAIN_REF>` | ref that must contain the commit | `origin/main` |
| `<RELOAD_CMD>` | graceful, zero-downtime reload | `pm2 reload <app>`, `systemctl reload <svc>`, `docker compose up -d --no-deps <svc>`, `kubectl rollout restart deploy/<app>`, platform redeploy |
| `<HEALTH_URL>` | production health endpoint | `https://<domain>/health` |
| `<SYNTAX_CMD>` | per-file syntax check | `node --check`, `python -m py_compile`, `php -l`, `ruby -c` |
| `<GATE_CMD>` | fast mandatory test before touching prod | `npm test`, `make test` |
| `<LOCK_FILE>` | ensures one hotfix at a time | `flock` on a lock file |
| `<HOTFIX_CMD>` | script wrapping all steps below | `scripts/hotfix.sh <commit> <file>...` |

No script yet? Write a small shell script that implements the guard table below. Do not do it with manual `cp`.

## Guards (refuse before changing anything)
| # | Check | On failure |
|---|---|---|
| 1 | commit is in `<MAIN_REF>` (`git merge-base --is-ancestor <commit> <MAIN_REF>`; fetch first) | ABORT: commit and push first |
| 2 | every file is under `<ALLOWED_DIR>` | ABORT: use `release-deploy` |
| 3 | file is not in `<DEP_FILES>` | ABORT: a dependency change is a release |
| 4 | file exists in `<commit>` | ABORT |
| 5 | drift: prod file equals `<commit>^`. Already equal to `<commit>`: skip. Different from both: prod has other changes | ABORT; inspect the diff, retry with `FORCE=1` only after understanding it (and user approval if risky) |
| 6 | the checkout running the script contains `<commit>`; `<GATE_CMD>` passes | ABORT |
| 7 | no other hotfix running (`<LOCK_FILE>`); wait in queue | concurrent reloads can break workers and trigger false reverts |
| 8 | no long-running job would be cut by the reload (jobs/deploys running inside the app process): wait for idle, re-check right before reload | ABORT and retry later; `FORCE_RELOAD=1` only with user approval |
| 9 | process-manager CLI is on PATH and non-empty | ABORT: a silently failing reload still reports success |

## Steps
1. Identify `<commit>` (already on main) and the exact list of files changed for this fix; include nothing else.
2. Run `<HOTFIX_CMD> <commit> <file>...`. Internally:
   1. guards above;
   2. create tag `<short-commit>-<hour>`; back up each prod file as `<file>.bak-<tag>`;
   3. write file contents from `git show <commit>:<file>` (not the working tree);
   4. `<SYNTAX_CMD>` per file; failure -> revert at once;
   5. `<RELOAD_CMD>` (print the real error on failure; failure -> revert);
   6. clean up orphan workers left by the reload;
   7. poll `<HEALTH_URL>` for up to about 60 s (slow apps under load; a single 8 s check once reverted a correct fix);
   8. not 200 -> automatic revert from backup and reload again.
3. On success record the tag. Manual revert any time: `<HOTFIX_CMD> --revert <tag>` (restores all `.bak-<tag>`, reload, health).
4. Verify: the watcher (`prod-log-watch`) no longer shows the same error; exercise the fixed feature if possible.
5. Record tag, commit and result in the changelog and runbook.

## Fixed rules
- Prod changes only through this script or `release-deploy`; no manual `cp`/edit in `<PROD_DIR>`.
- Only the files that belong to the fix; no "while I'm here" files.
- A script that can silently do nothing (empty CLI, failed reload) is a bug: always verify the reload really happened.
- Unsure about drift or impact: ask the user, do not `FORCE`.
- A graceful-reload hotfix may go at any hour; anything that drops service goes through `maintenance-window-ops`.

## Report
Short: commit, files shipped, health result, revert tag, or the ABORT reason and next step.
