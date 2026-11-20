---
name: remote-offload
description: Use when tests, builds, linters or other CPU/RAM-heavy commands would overload the main or storage host (slow machine, load guard triggering, long suites, "run tests on the worker/remote node", "offload build"). Runs the command on a worker node, CI runner or container with primary, backup and local fallback, syncs the tree out, and brings the exit code and artifacts back. Applies to any project type.
---

# Remote offload

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

## When to use
- Use for test suites, frontend builds, large lint/typecheck, Lighthouse/E2E (see `web-quality-audit`), or anything that pushes the main host's load up.
- Do not use for checks that need git history (the remote often has no `.git`) or must observe the main host's own state (e.g. checking production files).
- Do not use to deploy or change production services; that is `release-deploy`.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<WORKER_PRIMARY>` | first-choice worker | `ci@worker1`, a CI runner, a cloud dev box |
| `<WORKER_BACKUP>` | second-choice worker | `ci@worker2` |
| `<WORKER_EXCLUDED>` | node deliberately not used, with the reason | flaky network |
| `<OFFLOAD_CMD>` | project's offload script/command, if any | `<script> -- '<command>'`; or `ssh`+`rsync`, `docker run`, `act`, a CI workflow dispatch |
| `<REMOTE_WORKDIR>` | work folder on the worker | `~/ci/<tree-name>-<hash>/` |
| `<ENV_FORCE_LOCAL>` | variable that forces a local run | `OFFLOAD=0` |
| `<LOAD_GUARD>` | threshold/mechanism protecting the host | load1 > N for M minutes |
| `<RESOURCE_CAPS>` | CPU/RAM/nice caps on the worker | CPU quota, memory limit, `nice`, `docker run --cpus --memory` |
| `<SHARED_PROD_CHECK>` | prod check after using a shared node | health URL + process list |

No worker at all (laptop only, CI-only repo)? Throttle locally (`nice`, `-j`/`--maxWorkers`, run suites one at a time) or push to a CI workflow and read its result.

## Steps
1. Needed or not. Light work (one small test) may run locally. Heavy or long: offload. Check `<LOAD_GUARD>`: if the host is already loaded, do not add local load.
2. Pick a node in order: `<WORKER_PRIMARY>` -> `<WORKER_BACKUP>` -> local (last fallback). Probe briefly (ssh batch mode, short timeout); do not wait long on a dead node. If `<OFFLOAD_CMD>` exists, use it, and distinguish the exit code "no node reachable" from "tests failed".
3. Sync the tree. Send git-tracked files plus new non-ignored files (rsync). Do not send `node_modules`, scratch folders, stale build output, or secrets that are not needed. Install dependencies on the worker only when the lockfile/manifest changed.
4. Run in `<REMOTE_WORKDIR>` under `<RESOURCE_CAPS>` (CPU quota, memory limit, low priority) so other apps on the node keep priority. Set a timeout per step. One work folder per tree with a lock (same tree queues, different trees may run in parallel).
5. Pull results. Return the exit code unchanged. Copy back needed artifacts (e.g. `dist/`, reports, screenshots) on success, and on failure when they are evidence.
6. Verify the exit code and summary (pass/fail) yourself. Never write "passed" without seeing the numbers. The worker's runtime version may print a different report format; adjust the reporter or filter.
7. Force local only when needed via `<ENV_FORCE_LOCAL>` (e.g. checks that need git, or debugging the environment).

## Fixed rules
- Worker nodes are often shared with production runtimes (apps, proxy, DB). Do not run anything touching shared ports, processes or DBs without checking; after any batch on a shared node run `<SHARED_PROD_CHECK>`.
- Never kill processes on the worker except ones this run created.
- Respect `<LOAD_GUARD>`: if the main host is guarded, do not fight it with heavy local work; offload or wait.
- Do not send unneeded secrets to the worker. Builds that need no env get no env.
- Environment differences are real (tool versions, filesystem, uid, BusyBox vs GNU utilities, inode reuse). If it fails only on the worker, compare environments before blaming the code.
- A node the user decided not to use (`<WORKER_EXCLUDED>`) stays unused, whatever the reason.
- Orphaned runs (dropped session) must be cleaned up by a watchdog or timeout, never left holding the lock.
- Setting up a new node (user, ssh key, runtime, linger) is idempotent and uses credentials via `credential-broker`; node change windows go through `maintenance-window-ops`.

## Report
Short: node used (or local fallback and why), command, exit code, result numbers (pass/fail, duration), artifacts pulled, and the `<SHARED_PROD_CHECK>` result when a shared node was used.
