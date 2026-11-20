---
name: prod-log-watch
description: Use when watching production logs, when a monitor/alert line, 5xx burst, health-check DOWN or stack trace from prod arrives, or when asked to "watch prod", "monitor the logs", "tail production" or "fix the error in the prod log". Keeps exactly one read-only log watcher alive, triages every event (user error, follow-on, noise, app bug, infrastructure) and runs the standard flow for app bugs - analyse, fix in dev with a regression test, test, commit, hotfix, verify, log. Works for any project type and host.
---

# Prod log watch

Model- and harness-agnostic. Neutral terms (sub-agent, background, heartbeat, isolation) follow `task-delegation`.

## When to use
- Use when: asked to watch or monitor production logs, an error/5xx/health-DOWN line arrives from a watcher, or the user pastes an error from prod.
- Do not use when: the error only happens in dev/local (ordinary debugging), or the user wants analysis only with no change (follow `error-runbook`, read-only).
- Follow-ups: `error-runbook` (look up / document errors), `safe-hotfix` (ship), `release-deploy` (when a hotfix is not possible), `maintenance-window-ops` (fixes needing downtime).

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<WATCH_CMD>` | read-only watcher: follows logs, dedupes, one line per event | `tail -F` + filter, `journalctl -fu app`, `kubectl logs -f deploy/app`, `fly logs`, `vercel logs --follow`, `heroku logs --tail` |
| `<WATCH_STATUS_CMD>` | is a watcher already alive / kill duplicates | `pgrep -af`, `<WATCH_CMD> --status` |
| `<ERR_LOG>` / `<OUT_LOG>` | error and output logs | `~/.pm2/logs/*-error.log`, `/var/log/app/*.log`, container stdout |
| `<NOISE_FILE>` | where known-noise patterns live in the repo | `NOISE` array in the watcher script |
| `<RUNBOOK_FILE>` | catalogue of known errors | see `error-runbook` |
| `<CHANGELOG_FILE>` | finished-work log | `CHANGELOG.md` |
| `<DEV_ENV>` | place to fix and test, isolated from prod data | worktree + test DB, preview env |
| `<TEST_CMD>` / `<SYNTAX_CMD>` | project tests / per-file syntax check | `npm test`, `pytest`, `go vet`, `node --check` |
| `<HEALTH_URL>` | production health endpoint (or home page for static sites) | `https://<domain>/health` |
| `<TTL>` | max lifetime of one watcher process | a little under the harness monitor limit |

No logs of your own (static host, PaaS)? Use the platform log stream plus an uptime check on `<HEALTH_URL>`.

## 1. Install the watcher (exactly one)
1. Check first with `<WATCH_STATUS_CMD>`. If one is alive and its output reaches this session, do not start another.
2. Start one read-only watcher. Harness with a monitor tool: run it as a monitor. Otherwise run it in the background writing to a file and read that file on a 60-120 s heartbeat: `timeout <TTL> <WATCH_CMD> >> <JOB_TMP>/watch.log 2>&1 &`
3. Dedupe: one line per event; repeats within about 10 minutes are counted, not reprinted. Check health every ~30 s; report DOWN after 2 consecutive failures and "UP again" on recovery.
4. No orphans: wrap every monitor command in `timeout <TTL>`. Expired monitors often do not kill their children; re-arming on each expiry stacks copies and raises server load. One-off checks get `timeout 20`.
5. On expiry, start one new watcher, then kill older copies (keep the newest). Final count must be exactly 1.
6. A new session may not receive an old session's watcher output: start yours, then stop the old one.
7. A permanent watcher (cron or systemd timer with an `--ensure` mode writing events to a file) may replace a session monitor. Read its event file; never stop it.

## 2. Triage each event
Grep `<RUNBOOK_FILE>` for a message fragment first. Known entry: use its class and fix.

| Class | Signs | Action |
|---|---|---|
| End-user or customer-code error | failure caused by the user's own code/config (bad build, dependency clash, bad input) | not an app bug; one-line report, no code change |
| Follow-on | consequence of an earlier event (e.g. "deploy failed" notice) | mention as follow-up, no action |
| Noise | repeating, harmless, already known | add the pattern to `<NOISE_FILE>` via a normal commit |
| App bug | stack trace in our code, 500 from a handler, `TypeError`, failed query, misleading user message | run section 3 |
| Infrastructure | node, storage, DB, proxy, CDN unreachable | check health; fixes that need downtime go to `maintenance-window-ops` |

Unsure between user error and app bug: treat it as an app bug and analyse. Do not guess.

## 3. App-bug flow
1. Analyse (read-only). Pull context around the event time, find the affected request/user/resource and the root cause in code. Compare the prod file with `main`. If the user said "analyse" only, stop and report.
2. Fix in dev (`<DEV_ENV>`; isolate the repo if running in parallel). Fix the root cause, not the symptom. Write a failing regression test before the fix. Never edit prod directly.
3. Test: `<SYNTAX_CMD>` on each changed file, `<TEST_CMD>` (failure count must not rise above baseline), manual check in dev when possible.
4. Commit and push to the main branch (`fix(<area>): ...`; follow the project's trailer/attribution rules).
5. Ship: backend-only change already on main -> `safe-hotfix`. Frontend, new dependencies, schema migration or non-backend files -> `release-deploy`. A hotfix may go any time if the reload is graceful.
6. Verify: health 200 and the watcher no longer shows the same error; for a single-user issue check that user's case.
7. Record in `<RUNBOOK_FILE>` and `<CHANGELOG_FILE>`: symptom, root cause, fix, test, commit, hotfix tag. See `error-runbook`, `living-docs`, `definition-of-done`.

## Fixed rules
- The watcher is read-only: it never changes prod and never prints secrets (use `credential-broker`).
- Exactly one watcher; every process is bounded by `timeout`.
- Heavy tests on nodes shared with prod can disturb prod: check prod after big runs.
- Three failures at the same step: stop and report.
- Many independent alerts at once: one sub-agent per event (`task-delegation`); customer/follow-on events need one line only.

## Report
Short, in the user's language, result first: event class, root cause, fix + commit, prod status (hotfix tag or release needed), runbook entry changed. Customer/follow-on/noise events get one line.
