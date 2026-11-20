---
name: security-audit-cycle
description: Use when the user asks to check security, find bugs, review code or pasted snippets (quick audit), or runs a formal offensive audit (off-sec / red team / OWASP / pentest) and then fixes the findings (def-sec / harden / remediate). Keeps two tracks separate - a quick chat report with severity levels, and a formal audit-then-fix cycle tracked in a deferred-items ledger file.
---

# Security audit cycle: two tracks that never mix

Works for any project type: web apps, APIs, CMS, admin dashboards, mobile backends, CLIs, static sites (mostly secrets, dependencies, headers, third-party scripts). Skip categories that do not apply and say so.

## When to use
- The user asks to check security, find bugs, review code (or pastes a snippet), or runs a formal security audit followed by fixes.
- Skip for ordinary bug fixes with no security angle (follow `definition-of-done`).
- Fixes that reach a live system go through `safe-hotfix` / `release-deploy` (or the platform's deploy flow), not this skill.
- Read and fix this project's own code only; never test exploits against third-party systems or live production.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<LEDGER_FILE>` | source of truth for formal findings | `SECURITY_LEDGER.md` |
| `<SOURCE_DIRS>` | code folders to grep | `src/`, `server/`, `app/` |
| `<ROUTE_FILES>` | route/endpoint definitions | `routes/*.js`, `app/api/**` |
| `<AUTH_MIDDLEWARES>` | auth/authorization middleware names | `requireAuth`, `requireAdmin`, `requireOwnership` |
| `<TEST_CMD>` | project test command | `npm test` |
| `<EXTERNAL_PENTEST>` | optional autonomous pentest tool | Strix, ZAP, Nuclei |

## Choose the track first
| | Track A: quick audit | Track B: formal cycle |
|---|---|---|
| Trigger | free text: "check security", "any bugs?", "review code", pasted code | explicit off-sec then def-sec (or "formal security audit", "pentest", "hardening") |
| Output | report in chat | report plus entries in `<LEDGER_FILE>` |
| Ledger | **not written** | **must** be written/updated |
| Changes code | no (unless asked) | off-sec no; def-sec yes |

- An explicit user command wins. With no explicit command and a free-form question: track A.
- Do **not** copy track A results into the ledger. If an A finding needs a product/architecture decision, suggest track B so it enters tracking.
- "Analyse" or "find out" means read-only: report first, ask permission before fixing (`mode-gates`).

## Track A: quick code audit
1. **Scope**: one file, a module, or the whole repo. Read relevant files fully; never judge from names.
2. **Trace data flow**: input entry points, transformations, boundaries (DB, external APIs, system I/O). Follow suspicious functions to their definition.
3. **Check 6 categories**: security, logic, syntax/types, mismatches (API contract vs UI, DB schema vs query, env vs runtime), quality, infrastructure/config.
4. **Verify**: drop false positives (validation may already exist in middleware or a proxy). Accuracy over count.
5. **Report** heaviest first. Each finding: severity, `file:line`, category, why it is dangerous, the problem code, a concrete fix.

| Severity | Criteria |
|---|---|
| **CRITICAL** | directly exploitable: RCE, total auth bypass, mass data leak, unauthenticated SQLi |
| **HIGH** | serious but conditional: stored XSS, authorized IDOR, privilege escalation, financial race condition |
| **MEDIUM** | limited impact or needs user interaction: CSRF, small info disclosure, weak error handling |
| **LOW** | best-practice violation, future risk, code hygiene |
| **INFO** | observation with no direct security impact, refactor advice |

Compact format: `## Code Audit Result`, count per severity, findings list, "Action priorities" (fix order).

## Track B1: off-sec (honest offensive audit)
Stance: a paid red team finding problems. No praise for basics, no softening severity, point at the vulnerable line.

Scope: OWASP Top 10 plus OWASP API Security Top 10:
- A01 access control: routes without `<AUTH_MIDDLEWARES>`, IDOR, privilege escalation, mass assignment.
- A02 crypto: hardcoded secrets, weak hashes, sensitive data in logs.
- A03 injection: SQL concatenation, command (`exec`/`spawn`), template.
- A04 design: business-logic gaps, rate-limit/quota bypass.
- A05 misconfiguration: debug on in production, leaked stack traces, loose CORS.
- A06/A08 components and integrity: outdated dependencies, untrusted packages.
- A07 auth/session: JWT validation, token expiry.
- A09 logging: log injection, secrets in logs.
- A10 SSRF: requests to user-supplied URLs.

Quick grep recipes (adapt language and folders; results are leads, not proof):
```bash
# queries built by string interpolation
grep -rnE "(query|execute)\(.*(\\$\{|\+ *[a-z])" <SOURCE_DIRS> --include="*.js" | grep -v node_modules
# hardcoded secrets
grep -rnEi "(password|secret|token|api_?key)\s*[:=]\s*['\"][^'\"]{6,}" <SOURCE_DIRS> | grep -v "process.env\|test"
# routes without auth middleware (match names in <AUTH_MIDDLEWARES>)
grep -nE "\.(get|post|put|patch|delete)\(" <ROUTE_FILES> | grep -vE "<AUTH_MIDDLEWARES joined by |>"
# command execution and fetch from input
grep -rnE "exec\(|spawn\(|eval\(|fetch\(|axios\(" <SOURCE_DIRS> | grep -v node_modules
```
An autonomous pentest tool (`<EXTERNAL_PENTEST>`) may yield deeper findings with real PoCs. Put its output (JSON/SARIF/report) into each finding's PoC section and treat it like a manual finding. Run it only against targets you own, in a test environment.

Report format:
```
SECURITY AUDIT REPORT: <scope>   Method: OWASP Top 10 + API Top 10
EXECUTIVE SUMMARY: <honest status, no fluff>
[Severity] VULN-001: <name>
  File: path:line   Category: A0X
  PoC/Scenario: <concrete exploit steps>
  Code: <snippet>   Fix: <proposal>
STATS: CRITICAL x | HIGH x | MEDIUM x | LOW x | INFO x
VERDICT: <safe to release / block release / fix on schedule>
```
Record each finding in `<LEDGER_FILE>`: sequential number, severity, location, short PoC, status `pending`. Offer def-sec afterwards.

## Track B2: def-sec (fix and harden)
1. **Ingest**: read `<LEDGER_FILE>` (or the external tool's artifacts). With no earlier findings, run B1 first.
2. **Order by severity**: CRITICAL, HIGH, MEDIUM, then LOW/INFO.
3. **Root cause, not symptom**: authorization in controller/model, input types and validation (field allowlist), parameterized queries, rate limits on auth endpoints, generic errors without stack traces to clients.
4. **Minimal, targeted fix**: touch only what is needed. **Do not change business logic**; if the fix requires it, stop and ask.
5. **Re-run the exploit**: run the same PoC and show it now fails, plus `<TEST_CMD>` green (no regressions). Without this evidence the status stays `pending`.
6. **Update the ledger**: `RESOLVED` + date + how it was fixed; the rest stay `pending` with reasons.

Fix report: `FIXED` (VULN id, location, fix, re-test evidence) and `PARTIAL / needs user` (reason).

## Fixed rules
- The ledger is the single source of truth for track B; track A never touches it.
- Reports contain no real secrets; mask values (`***`) and never paste tokens from findings. See `credential-broker`.
- Never exploit production or third parties; PoCs run in dev/test.
- Every new route needs an authorization check; for features exposed to both UI and agents see `agent-tool-parity`.
- Fixes that go live follow `safe-hotfix` / `release-deploy`; record results via `living-docs`.
- Large audits may be split across parallel sub-agents per module (`task-delegation`); verify their findings yourself before reporting.

## Report
Short, user's language, result first: finding counts per severity, the worst with locations, ledger status (track B), and next step (def-sec, or the decision needed).
