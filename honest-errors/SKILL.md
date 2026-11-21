---
name: honest-errors
description: Use when designing, reviewing or fixing how an app reports errors to people and agents - vague messages ("Something went wrong", "Error 500", "failed"), swallowed exceptions, errors that never reach the UI, CLI, API or AI-agent/MCP tools, missing error codes or translations, logs nobody reads, "is the error clear to the user?", "pesan error tidak jelas", "error tidak tampil", "tambahkan kode error". Makes every error say what happened, why, and what to do, reach every surface, land in a real log, and stay in sync with the error runbook through a test.
---

# Honest errors

Origin: a hosting panel's user-error catalog (codes plus ID/EN texts, a sanitizer that never leaks internals, the same message reaching the web UI, the deploy log and the MCP agent tools, and a parity test between catalog, runbook and translations). Model-agnostic, any stack.

An honest error answers three questions in the user's words: **what happened, why, what to do now.**

## When to use / not
- Use when adding a failure path, when a user or agent got a vague or misleading message, when an error showed in one surface but not another, or when setting up error handling in a new project.
- Do not use to find the cause of one specific error: `error-runbook` (it uses this skill's catalog afterwards). Security leaks found during review go to `security-audit-cycle`.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<ERROR_CATALOG>` | single list of known user-facing errors | `src/errors.ts`, `errors.json`, `app/errors.py` |
| `<SURFACES>` | where errors are shown | web UI, form fields, toast, dialog, CLI, API JSON, agent/MCP tool result, email |
| `<LOG_SINK>` | where full details go | file log, journald, Sentry, cloud logs, `%APPDATA%/<app>/logs` |
| `<LOCALES>` | languages | `en`, `en,id` |
| `<RUNBOOK_FILE>` | runbook from the doc trail | `docs/error-runbook.md` |

## Steps
1. **Inventory.** List failure points: `catch`/`except` blocks, rejected promises, non-2xx responses, process exit codes, crash handlers. Flag each one that: swallows the error, shows a generic text, shows a raw stack or internal path, or shows nothing.
2. **Catalog.** Every error a user can hit gets an entry in `<ERROR_CATALOG>`:
   ```
   CODE          SITE_BUILD_LOCKFILE
   when          npm ci rejects an out-of-sync package-lock.json
   message.en    "The build used npm install because package-lock.json is out of sync. Run npm install locally and commit the lockfile."
   message.id    "Build memakai npm install karena package-lock.json tidak sinkron. Jalankan npm install di lokal lalu commit lockfile-nya."
   fix           what the user does (one line)
   retryable     yes | no
   ```
   - Stable code (UPPER_SNAKE), never reused.
   - Message: plain words, the cause the user can act on, the next step. No blame, no jargon, no internal paths, hosts or stack traces.
   - One message per code per locale.
3. **Map raw errors to codes** in one place (a classifier function), not scattered string checks. Unknown errors map to a generic code that still says what to do ("try again; if it repeats, send code X and time Y to support") and keeps a request or log id.
4. **Reach every surface.** The same code and message must arrive at each item of `<SURFACES>`:
   - UI: next to the field for form errors; a dialog or toast for actions; never only in the console.
   - API: `{ "error": { "code", "message", "requestId" } }` with a fitting status code.
   - CLI: message on stderr, non-zero exit code.
   - Agent/MCP tools: return the code and message as the tool result with `isError`, so the agent can explain or retry; never just "failed".
   - Logs and long-running jobs (builds, deploys, imports): write the warning into the job log the user reads, not only the server log.
5. **Log the full detail** to `<LOG_SINK>`: code, raw error, stack, request or job id, user or tenant id (no secrets). Check the sink really receives it (trigger one error and find it).
6. **Parity test.** One automated test that fails when:
   - a catalog code has no message in one of `<LOCALES>`;
   - a catalog code is missing from `<RUNBOOK_FILE>` part A;
   - a known raw error no longer maps to its code.
7. **Verify** by triggering each changed error once per surface and pasting what the user actually sees.

### Same skill, three kinds of project
| | Portfolio / static site | Desktop app | SaaS / web app |
|---|---|---|---|
| Typical failures | contact form fails, 404, image or embed missing, build breaks | file cannot open, no disk space, update fails, crash | deploy fails, quota full, payment declined, third-party API down |
| Surfaces | inline form message, friendly 404 page with links, `alt` text and fallback image, build log | native dialog with a "Copy details" button, status bar, log file | UI toast and page, API JSON, email, agent/MCP tools, job logs |
| Log sink | form provider dashboard or serverless function logs | rotating log file in the app data folder, opt-in crash reports | central logs or error tracker with request ids |
| Must not | show a blank page or a raw 500 | quit silently or show an exception class name | leak SQL, hostnames, paths or other tenants' data |

## Doc trail
Follows `living-docs` section 7.
- `docs/error-runbook.md` part A: one row per catalog code (code, trigger, message, user fix). The parity test keeps it in sync.
- Part B: server-side errors found while wiring this up (swallowed exception, broken log sink), with root cause and fix.
- `checkpoint.md`: which codes were added or changed, which surfaces were verified, test result.
- `plan.md`: when the inventory finds many failure points, list them as plan steps and tick them off.

## Fixed rules
- Never show a stack trace, SQL, file path, host name, secret or another user's data to users or agents.
- Never swallow an error silently; at least log it with an id.
- An error message never claims success, and a success message never hides a fallback or a warning.
- Message text lives in the catalog and locale files, not inline in code.

## Report
Result first: codes added or changed, surfaces verified (with the text users now see), parity test result, runbook rows added.
