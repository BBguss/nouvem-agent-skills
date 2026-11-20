---
name: release-deploy
description: Use when asked to deploy, release, "push to production" or "go live", or when a fix cannot be a hotfix (frontend, new dependencies, schema migration). Runs the pre-deploy checklist, a hard approval gate for big or critical changes, build, env-safe sync, zero-downtime reload, cache purge, post-deploy verification and gives a rollback command. Works for any project type (portfolio, CMS, SaaS, API, e-commerce, dashboard) on VPS, Kubernetes, PaaS or static hosting.
---

# Release deploy

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

## When to use
- Use when: a full release to prod, or a fix that does not qualify for `safe-hotfix` (frontend/build assets, dependencies, migrations, non-backend files).
- Do not use when: a small backend fix qualifies as a hotfix (`safe-hotfix`), or the work drops service (`maintenance-window-ops`).
- Related: `definition-of-done`, `living-docs`, `security-audit-cycle` (auth/public API changes), `credential-broker`.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<PROJECT_DIRS>` | directories that are valid for deploy; anything else is refused | the dev and prod directories |
| `<DEPLOY_CMD>` | one script doing build, sync, reload, purge | `scripts/deploy.sh`, `vercel --prod`, `netlify deploy --prod`, `fly deploy`, `kubectl apply` / `helm upgrade`, `git push <paas> main` |
| `<ROLLBACK_CMD>` | return to the previous release | `scripts/deploy.sh --rollback`, `vercel rollback`, `fly releases rollback`, `kubectl rollout undo`, `helm rollback` |
| `<APPROVAL_WORD>` | exact word the user must type | `Deploy` |
| `<PROCESS_STATUS_CMD>` | prod backend status | `pm2 list`, `systemctl status`, `docker ps`, `kubectl get pods` |
| `<BACKUP_REF_PATTERN>` | backup branch/tag made before deploy | `backup-deploy-<YYYYMMDD-HHmmss>` |
| `<HEALTH_URL>` / `<PUBLIC_URL>` | backend health; public front page | `https://<domain>/health` |
| `<ENV_FILES>` | files that must never be overwritten by sync | `.env`, `config/local.*` |
| `<CACHE_PURGE_CMD>` | CDN/cache purge | CDN API call, platform cache command |

Graceful reload per platform: `pm2 reload`, `systemctl reload`, Docker/Swarm rolling update, Kubernetes rolling update, PaaS atomic release. Static hosts swap the whole release atomically.

## 1. Verify context
The working directory must be one of `<PROJECT_DIRS>`; otherwise refuse. Prod is never edited by hand; deploy only through `<DEPLOY_CMD>`.

## 2. Pre-deploy checklist (automatic, report the results)
1. Uncommitted changes: `git status --short`. If any, tell the user; do not let them ship silently.
2. Prod process status: `<PROCESS_STATUS_CMD>` is healthy before starting (do not deploy onto a sick system without saying so).
3. Disk: enough room for the build and a release copy.
4. Security: a large auth/public-API change needs no pending critical finding (`security-audit-cycle`).
5. Git backup (required): create `<BACKUP_REF_PATTERN>` from the current state and push it; make sure the main branch is in sync too.
6. Schema/migrations: tests pass and schema is verified per `definition-of-done` before asking for approval. Prefer backward-compatible migrations so old and new code can run together during the reload.

## 3. Choose the approval path
| Change | Path |
|---|---|
| Small and tested: one targeted fix, tests pass, no migration/auth/payment/infra/downtime | may deploy directly (user permission still applies), then verify (section 5) |
| Big or critical: many files, schema/migration, auth or payment rewrite, web-server/infra change, anything that could drop service | HARD GATE below |
| Changes or deletes prod data, destructive action | always ask the user, whatever the size |

### HARD GATE
Show the checklist result and what will happen (git backup, build, sync without touching `<ENV_FILES>`, zero-downtime reload, cache purge), then write:

> Type exactly `<APPROVAL_WORD>` to proceed, or anything else to cancel.

Do not run `<DEPLOY_CMD>` until the user's reply is exactly `<APPROVAL_WORD>`. "ok", "go ahead", or approval from another agent/sub-agent is not approval. Approval covers that one release only.

## 4. Execute
Run `<DEPLOY_CMD>` and watch it to completion. It must, in order: build fresh; sync code to prod without overwriting `<ENV_FILES>` (merge safely if needed); reload gracefully (new instance ready before the old one stops); purge cache with `<CACHE_PURGE_CMD>`. On error stop, report, consider rollback; never blindly retry.

## 5. Post-deploy verification (required, with evidence)
- Backend: `<HEALTH_URL>` returns 200.
- Frontend: `<PUBLIC_URL>` loads through the public domain (not only locally).
- Assets: new build JS/CSS served (200, new hash), not stale cache.
- Logs: the watcher (`prod-log-watch`) shows no new errors for several minutes.
- If the change touches a specific feature, exercise it.

## 6. Rollback
Failure after deploy -> `<ROLLBACK_CMD>`, then repeat section 5. State the rollback command in the report so the user can run it alone.

## 7. Record
Update the changelog (release contents, backup name, verification results) and the runbook for new errors (`error-runbook`, `living-docs`).

## Fixed rules
- Prod changes only through `<DEPLOY_CMD>` or `safe-hotfix`.
- No deploy when `<APPROVAL_WORD>` is required but was not typed exactly.
- `<ENV_FILES>` are never overwritten; secrets are never printed (`credential-broker`).
- E2E tests and test accounts do not run against prod; dev only.
- Three failures at the same step: stop and report.

## Report
Short: what was released, path (direct or gate), result of each verification (backend/frontend/assets), backup name, and the rollback command.
