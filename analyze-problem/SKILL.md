---
name: analyze-problem
description: Use when the user asks why something happens or wants a problem understood before fixing - a bug, slow page or query, failing build or test, flaky behavior, unexpected output, a design or architecture question, "why does X", "what's causing", "investigate", "root cause", "analisis", "cari tahu", "kenapa", "kok bisa". Read-only by default - restates the problem, gathers evidence, ranks hypotheses, tests the cheapest first, finds the root cause, and proposes fix options with trade-offs, then hands off to error-runbook or plan-then-code.
---

# Analyze a problem (universal)

Origin: the "analyse first, change later" rule used across projects, generalized beyond error logs to performance, builds, design and behavior questions. Model-agnostic and harness-agnostic; neutral terms follow `task-delegation` §0.

## When to use / not
- Use: anything where the cause is unknown or disputed; "why" questions; decisions that need evidence (which DB, why is it slow, should we split this service).
- Prefer `error-runbook` when there is a concrete error signature or the user says "analyse error" (it checks the known-errors catalog first, then may come back here for an unknown cause).
- Do not use: the cause and fix are already obvious and agreed (`code-change` / `plan-then-code`).
- **Read-only by default** (`mode-gates`): no edits, no restarts, no data changes. Adding temporary logging or running a profiler in a local/dev environment is allowed when stated; anything in production needs approval.

## Adapt to the project (fill once, or discover)
| Placeholder | Meaning | Example |
|---|---|---|
| `<LOG_SOURCES>` | where logs live per environment | dev server output, container logs, log service |
| `<METRICS>` | dashboards or commands for latency/CPU/errors | APM, `top`, DB slow log |
| `<REPRO_ENV>` | where reproduction is safe | local, staging |
| `<RUNBOOK>` | known-errors catalog | see `error-runbook` |

## Steps
1. **Restate** the problem in one or two sentences: observed vs expected, where, since when, how often, who is affected. Ask only for facts you cannot get yourself (a URL, account, time of occurrence). Note scope words: one user or all, one page or all, always or intermittent.
2. **Gather evidence before theorizing** (quote it, do not paraphrase):
   - Reproduce in `<REPRO_ENV>` with exact steps; record whether it reproduces.
   - Logs and the **first** error around the time; full stack trace.
   - What changed: `git log --since`, `git log -p -- <file>`, `git bisect` for regressions, dependency/lockfile diffs, config/env changes, infrastructure or data changes.
   - Metrics: latency percentiles, error rate, CPU/memory, DB slow queries, network waterfall for web pages.
   - Code reading along the actual path (entry point → logic → data), found by search, not memory.
   - Check `<RUNBOOK>` and issue trackers for the same signature.
3. **Form ranked hypotheses** in the table from `references/templates.md`: each with supporting evidence, contradicting evidence, likelihood, cost to test, and the test that would confirm or kill it. At least two hypotheses; include "it is not a bug" (expected behavior, user setup, stale cache) when plausible.
4. **Test cheapest-first, highest-information-first.** One variable at a time. Prefer tests that split the space in half (bisect, toggle feature flag, swap input, compare working vs broken environment). Record each result in the table. Kill hypotheses explicitly.
5. **Find the root cause, not the trigger.** Run the 5-whys from `references/templates.md` until you reach something that can be changed and would prevent the whole class. Check whether the same pattern exists elsewhere (impact analysis, `definition-of-done`).
6. **Propose options** (usually 2-3): quick mitigation, proper fix, structural prevention. For each: change summary, files/areas, risk, effort, how to verify, whether it needs downtime. Recommend one and say why.
7. **Hand off, do not auto-fix.** Ask permission to move to a write mode (`mode-gates`). Then:
   - known/runtime error fix and runbook entry → `error-runbook`
   - small contained change → `code-change`
   - multi-file or risky change → `plan-then-code`
   - production impact now → `safe-hotfix` or `release-deploy`; downtime work → `maintenance-window-ops`
   - security-relevant finding → `security-audit-cycle`
   - slow web pages → `web-quality-audit`

## Problem-type playbooks
`references/playbooks.md` has short checklists for: bug/wrong output, performance (frontend and backend), failing build/CI, flaky tests, deploy/infra issues, data inconsistencies, and design/architecture questions.

## Fixed rules
- Evidence before conclusion; label every claim as verified (quoted output) or assumed.
- Do not change two things at once while testing; revert temporary instrumentation.
- Never test hypotheses against production data or users without approval.
- Three hypotheses killed with no new lead: stop, summarize what is ruled out, ask for more access or data.
- Correlation is not cause: a fix that "seems to work" must explain every observed symptom.
- Heavy parallel investigation (several independent hypotheses, large log sets) may go to sub-agents (`task-delegation`); the main agent verifies.

## Report to the user
Short, in the user's language, result first:
1. Root cause (one paragraph) with the key evidence quoted.
2. Hypotheses ruled out and how.
3. Options table with recommendation.
4. What you need from them: approval to fix, missing access, or a decision.
