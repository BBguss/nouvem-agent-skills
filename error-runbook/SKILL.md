---
name: error-runbook
description: Use when the user says "analyse error" / "analisis error", pastes an error message, stack trace, log line or failed deploy output, asks why something failed in production or staging, or asks to record/log an error ("catat error", "pencatatan error", lessons learned), including errors in the agent's own commands and tools. Looks the exact error signature up in the project runbook first, applies the documented fix, otherwise finds the root cause, fixes and tests it, then documents it back into the runbook (user, server and agent/tooling parts) and changelog.
---

# Error runbook SOP

A catalog of errors that grows with every incident. Works for any project: a production service, a PaaS app (Vercel/Netlify/Fly build and runtime logs), a CLI, a mobile backend, or a local dev environment where "production" is simply the developer's machine.

## When to use
- There is exact error text (message, code, HTTP status, stack trace) to explain or fix.
- Skip when the request is pure design/feature work, or no error can be identified (ask for logs/symptoms first).
- Related: `prod-log-watch` (event source), `background-job-watch` (hung or runaway jobs), `safe-hotfix` / `release-deploy` (ship the fix), `living-docs` (doc-writing rules), `definition-of-done`.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<RUNBOOK_FILE>` | the project's error catalog (parts A and B, see Structure) | `docs/error-runbook.md`; create it from `living-docs/templates/error-runbook.md` if the project has none (doc trail, `living-docs` section 7) |
| `<CHANGELOG_FILE>` | record of work | `CHANGELOG.md` |
| `<LOG_SOURCES>` | where logs live per layer | app log, build/deploy log, platform dashboard logs, browser console, local terminal |
| `<CLASSIFY_CMD>` | (optional) command returning a catalog code for raw error text | small script, or empty |
| `<READONLY_WORDS>` | user words that force read-only | "analyse", "investigate", "find out"; multilingual: "analisis" |
| `<CATALOG_TEST>` | (optional) test that fails when a catalog code is missing from the runbook | `error-runbook-sync` |
| `<FIX_DELIVERY>` | how a fix reaches users | `safe-hotfix`, `release-deploy`, PaaS push, or just commit for local-only projects |

## Relation to read-only mode
- A bare `<READONLY_WORDS>` word = **read-only**: read logs/code, report findings, ask permission before changing anything.
- **"analyse error"** (or a request to analyse a specific error) is a user-defined exception: continue to fix in the same turn, following the steps below.
- "analyse error only", "don't change anything", "read-only": stop after step 2 and report.
- Other guardrails still apply: production changes go only through `<FIX_DELIVERY>`, work that takes a service down waits for `maintenance-window-ops`, large or critical changes need approval.

## Steps

### 0. Record as you go
Any error met during a task (user-facing, server, or your own tooling) is noted with its exact text at the moment it happens, in the working notes or directly in the runbook. Fixing it quickly is not a reason to skip the record; step 4 turns the notes into entries.

### 1. Collect the error signature
Copy the exact text: message, code (`EACCES`, `P1001`, HTTP 502), file/service name, time. If the user gives only symptoms, search `<LOG_SOURCES>` with `grep -n` around the event time. Never paraphrase; the signature must be greppable.

### 2. Search the runbook first
```bash
grep -n -i "<text fragment | code | file name>" <RUNBOOK_FILE>
```
Try several fragments (code, unique phrase, file name). If `<CLASSIFY_CMD>` exists, run it too: an empty/null result means no catalog code exists yet.

### 3a. Found, with a solution
- **User side** (user-owned code/configuration): relay the cause and solution from the runbook. No app code change.
- **Server/infra side:** check whether the recorded fix is **already deployed** (compare the running files/version with main). Deployed but the error returns = a new cause, go to 3b. Not deployed = ship through `<FIX_DELIVERY>`. A solution that is an ops procedure: run it exactly as the runbook says, within the limits above.
- Did this occurrence bring new info (other symptom, other site)? Update the same entry; do not create a duplicate row.

### 3b. Not found, or the old solution did not work
1. Root-cause analysis (read-only).
2. Fix in dev with a regression test that fails before the fix; run the project tests.
3. Commit and push; ship via `<FIX_DELIVERY>`; verify. Full flow: `prod-log-watch` section 3.
4. A user-owned error the app does not yet recognize: add a pattern to the user-message catalog (bilingual text if the project is bilingual) and one catalog test line.
5. Three failures on the same step: stop and report.

### 4. Document back (mandatory, automatic)
Write without offering first, unless project rules say otherwise.
- **Part A** when adding a user-facing message catalog code.
- **Part B** for server/infra errors.
- **Part C** for errors of the agent's own work: a tool or command refused by a guard, a script that failed on this host's shell (BusyBox, PowerShell), a command that hung or overloaded the machine, a monitor that kept dying, a wrong assumption that cost a retry. Record each one the first time it happens, even when it was fixed in the same turn.
- An entry in `<CHANGELOG_FILE>`: symptom, root cause, fix, test, commit, release/hotfix tag. Then commit and push per project policy.

## Structure of `<RUNBOOK_FILE>`
Opening section: how to use (the grep command) and how to add entries. No secrets, tokens or env contents inside.

| Part | Content | Columns |
|---|---|---|
| **A. Errors shown to users** | catalog of user-side messages, matched in order, first match wins | code, side, trigger (raw text), message to user = solution for the user, agent action |
| **B. Server/infra errors** | app logs, nodes, DB, storage, web server, deploy | **error signature** (exact, greppable text), side, root cause, solution (file/script/commit/command), status, changelog reference |
| **C. Agent and tooling errors** | what went wrong in the agent's own commands and tools (see step 4) | **signature** (exact refusal or error text), context (tool, host, shell), cause, what works instead, date |

Part C is read at session start together with the newest changelog entry, so the same mistake is not repeated. Keep each row to the working alternative ("BusyBox `ps` has no `-e`: use `/bin/ps -eo ...`"), not the story.

- **Side:** `user` (user's code/configuration, not an app bug), `server` (app/infra), `mixed` (read detail/logs).
- **Status B:** `fixed`, `workaround`, `open`, `runbook` (operational procedure).
- One entry per cause. A new cause for an old signature: edit the old entry and add a note.

## Fixed rules
- The runbook is checked **before** analysing; guessing without grepping first is a violation.
- Never write secrets/credentials in the runbook or chat (`credential-broker`).
- Docs follow `living-docs`; finished means meeting `definition-of-done`.

## Report
Short, user's language: cause, solution (from the runbook or new), delivery status (shipped, or needs a release), runbook entry added or changed.
