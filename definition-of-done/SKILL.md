---
name: definition-of-done
description: Use when about to claim any task finished, fixed, passing, or ready (bug fix, feature, refactor, config change, UI change), when starting a bug or feature that may touch shared code, or when an attempt keeps failing. Runs the Gather-Reason-Act-Verify loop with a 3-failure circuit breaker and a Definition of Done checklist that needs quoted evidence before any "done" claim.
---

# Definition of Done + Gather-Reason-Act-Verify loop

Applies to any project type: SaaS, API, CMS, dashboard, mobile backend, CLI, portfolio site, local-only experiment. Items that do not apply are reported as "n/a" with a reason, not silently skipped.

## When to use
- Before declaring anything "done / fixed / passing / ready"; when starting a bug or feature that touches shared code; when repeated attempts fail.
- Always active in every mode (`mode-gates` priority 3): done by the mode is not done by this checklist.
- Skip for pure questions or explanations with no change (answer with evidence from the source).

## Project adaptation
The project defines these in its entrypoint or rules file; the skill reads them and does not guess.
| Placeholder | Meaning | Example |
|---|---|---|
| `<TEST_CMD>` | test command | `npm test`, `pytest -q`, `go test ./...` |
| `<TYPECHECK_CMD>` | typecheck / lint / syntax check | `tsc --noEmit`, `ruff check` |
| `<BUILD_CMD>` | build if any | `npm run build` |
| `<BREAKPOINTS>` | responsive test widths | 360, 390, 768, 1024, 1440 px |
| `<CHANGELOG_FILE>` | record of finished work | see `living-docs` |
| `<LIVE_CHECK>` | how to verify it really runs | UI end-to-end in a test environment, curl the endpoint, read logs, run the CLI, open the local dev server or preview deploy |
| `<EXTRA_DOD_ITEMS>` | project-specific extras | agent-tool parity, i18n, accessibility |

No tests configured: say so, then verify by running the real path (script, request, page load) and quote that output.

## Loop (runs behind every step)
| Phase | Do | Do not |
|---|---|---|
| **Gather** | Read the actual files/docs, reproduce the problem first, trace who calls what | Answer from memory or assumption |
| **Reason** | State the root cause (why, not only where) and the approach; split into sub-steps | Stall on small ambiguity; pick the most rational option and note the assumption |
| **Act** | Small, verifiable change; ask confirmation before destructive actions (data deletion, force push, restarting live services) | Bundle several unrelated changes in one step |
| **Verify** | Run tests/typecheck/read logs/check live; compare real result to expected | Assume success without running anything |

- Each command's output is new context for the next step; do not discard it.
- On failure, use the error message as new evidence and return to Gather/Reason. **The next attempt must differ** from those that failed.

## Circuit breaker
- **3 consecutive failures on the same step without real progress = STOP.** No fourth attempt.
- Report: what was tried (each attempt), main error output, remaining hypotheses, decision or permission needed. Then wait.
- Applies to sub-agents too: the brief must say "stop after 3 failures and report".
- Dead end because a file/path is missing or permission is denied: stop and report, do not proceed on assumptions.

## Definition of Done (all met, or explicitly reported as not applicable)
- [ ] **Root cause** validated, not just the symptom gone.
- [ ] **Global impact analysis**: grep/search (record hits and misses) for other callers or users of what changed, and similar patterns in other modules. Fix in the shared layer when possible, then run the existing usages (not only the new case) to check for regressions.
- [ ] **Frontend/backend (producer/consumer) in sync**: consumers of a changed endpoint, schema or payload were searched and aligned (including types and validation schemas), or the mismatch is reported. Incompatible change: report the decision (versioning or simultaneous update), never silently.
- [ ] **Tests and typecheck run** (`<TEST_CMD>`, `<TYPECHECK_CMD>`, `<BUILD_CMD>`), passing, with **summary output quoted** in the report. New deterministic behavior gets a new test.
- [ ] **No debug leftovers**: no debug logs, temporary `TODO`s, dead code, scratch files, or secrets in the diff, logs or report.
- [ ] **Real data only**: UI shows measured data or a "no data" state; no mock, random, estimated or plausible-looking default values. Missing data is `null`/unknown, not a believable number.
- [ ] **Responsive** when UI changed: checked at `<BREAKPOINTS>` (screenshots, overflow check, clean console).
- [ ] **Docs** updated (`living-docs`): entry in `<CHANGELOG_FILE>`, new decisions routed to the right doc.
- [ ] **Verified live** where possible (`<LIVE_CHECK>`): the real path through UI/API/CLI, not a contrived or assumed test.
- [ ] Project `<EXTRA_DOD_ITEMS>`.

## Fixed rules
- **No done claim without evidence**: quote command output, not "should pass". A sub-agent's claim is not evidence; verify it yourself.
- Side bugs found while working: fix in the same session when small and the mode allows (`mode-gates`); when out of scope or read-only, note and report them.
- Ship only what was asked: do not smuggle other changes into a named fix.
- One unmet DoD item = not done: continue the loop or report the blocker.
- Never leak credentials or secret file contents into reports or logs (`credential-broker`).

## Report
Short, user's language, result first: what changed (files), evidence (quoted test/typecheck/live output), DoD items not applicable or unmet with reasons, remaining risk. After tests pass, continue to `living-docs`.
