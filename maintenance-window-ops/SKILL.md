---
name: maintenance-window-ops
description: Use when a production change could take sites or services down - web server or proxy restart that drops connections, node or service restart, reboot, storage remount, database switchover, migration cutover - or when asked "can I reboot/restart/reload this now?". Defers such work to a defined maintenance window, lists what is pre-approved inside it, checks what a node hosts before any reboot, never stops the old process before the new one is live, then monitors and reverts if unstable. Applies to VPS, Kubernetes, PaaS and shared infrastructure of any project type.
---

# Maintenance window ops

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

## When to use
- Use when: a change can cut user-facing service even briefly, or cannot be undone smoothly.
- Do not use when: the reload is graceful with no downtime (backend hotfix via `safe-hotfix`, release via `release-deploy`); those may run any time.
- Related: `prod-log-watch` (monitoring afterwards), `error-runbook` (record incidents), `credential-broker`, `task-delegation`.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<MAINTENANCE_WINDOW>` | agreed low-traffic hours plus time zone | `02:00-05:00 UTC` |
| `<TOPOLOGY_DOC>` | node map: what each node hosts | `docs/topology.md` |
| `<NODES>` | nodes that may be rebooted/restarted | `worker-1`, `db-1` |
| `<FALLBACK_CMD>` | switchover or fallback-readiness check | DB failover script, `nc -z <node> <port>`, `kubectl drain` + `cordon` |
| `<SAFE_RELOAD_CMD>` | the only web-server reload path (config test first) | `nginx -t && nginx -s reload`, `caddy validate && caddy reload`, `apachectl configtest && apachectl graceful` |
| `<SITE_HEALTH_CMD>` | health check of all sites/services | health sweep script, `curl -H "Host: <domain>" ...` |
| `<MONITOR_CMD>` | watcher during and after the window | see `prod-log-watch` |

Managed PaaS or serverless: node reboots are not yours to do; the same rules apply to plan changes, region moves, database upgrades and domain/DNS cutovers.

## 1. Does this need a window?
| Action | Window? |
|---|---|
| graceful app reload (new instance up first) | no |
| web server or proxy reload/restart that can drop sites | yes |
| restarting a service that cuts connections (DB, storage, runtime) | yes |
| restart or reboot of a node | yes |
| remount storage, change topology, cut over a domain | yes |
| delete data, drop tables, anything irreversible | always ask the user, inside or outside the window |

An active incident that has already taken service down may be handled immediately; tell the user and limit actions to what is needed.

## 2. Pre-approval inside `<MAINTENANCE_WINDOW>`
The user sets this once (record where and when they decided, in the project docs). Default:
- Pre-approved: non-destructive fixes and security patches (nothing is broken, deleted or damaged), including a web-server reload via `<SAFE_RELOAD_CMD>`.
- New features enabled in prod only if the user names them, with the monitor running and a fallback: if not stable by the end of the window, switch them off and continue in dev.
- Still needs the user: deletes/drops, anything irreversible, rebooting a node not yet checked (section 3), changes beyond the approved scope.
- First health regression during the window: stop and roll back; do not push on.

## 3. Before rebooting or restarting a node (required)
User approval of the reboot is not a substitute for this check.
1. Read `<TOPOLOGY_DOC>`: what does this node host? (primary/replica database, user apps, storage/NFS provider, proxy, cron.)
2. List the impact: which services drop, for how long, who is affected. Without this list, do not proceed.
3. Prepare the fallback first: switch the DB to a replica, confirm another node serves the same port and the proxy lists it (`<FALLBACK_CMD>`); test with a real port check, not an assumption. No fallback: tell the user service will go down and state the cost in the question.
4. After reboot: let the remount/storage storm settle (high load then is normal; do not panic-restart), then run `<SITE_HEALTH_CMD>`.

## 4. Never stop the old before the new is live
- Migration/cutover: keep the old process running until the new version is tested live (test vhost or `Host:` header), then switch; stop the old one only with approval.
- If you must touch the old one: stop, do not delete; keep sources and dumps.
- Customers' production apps are never stopped as "cleanup".
- Check whether other config uses a source before deleting any config.
- Cutover downtime target: minutes, not hours.

## 5. Working steps
1. Confirm you are inside `<MAINTENANCE_WINDOW>` (or handling an active incident). Start or check `<MONITOR_CMD>` first.
2. Record the starting state: `<SITE_HEALTH_CMD>`, healthy-site count, version/config about to change.
3. Back up the config you change; test it (`-t`/lint) before reloading.
4. Change one step at a time; verify health after each.
5. Monitor for several minutes up to hours depending on risk; check affected sites directly, not only logs.
6. Not stable near the end of the window: restore the starting state before the window closes; continue in dev.
7. Record outcome and lessons in the runbook/changelog (`error-runbook`, `living-docs`).

## Fixed rules
- No mass-kill of processes or process-manager daemons; targeted stops only for non-critical processes and with confirmation.
- Tests/E2E do not run against prod to "test the window".
- Parallel work (node checks, monitor, fallback prep) goes to sub-agents per `task-delegation`.
- Three failures at the same step: stop and report.

## Report
Short: what changed and when, health before/after, any impact, monitor status, and whether it was reverted or kept.
