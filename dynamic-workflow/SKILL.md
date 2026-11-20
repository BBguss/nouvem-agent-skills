---
name: dynamic-workflow
description: Use at the start of any request that is not clearly covered by one other skill, or that mixes several intents - build, change, fix, analyze, ship, operate, audit, migrate, document - for any project type (portfolio, CMS/blog, SaaS, dashboard, e-commerce, API, landing page, internal tool, local-only). Classifies the request, composes a chain of skills from this pack on the fly, decides inline vs delegated work, re-plans when evidence changes, and stops at defined conditions.
---

# Dynamic workflow orchestrator (universal)

Origin: sessions where requests arrive in natural language, mix intents, and change direction once evidence comes in. This skill picks and orders the other skills; it does no domain work itself. Model-agnostic and harness-agnostic; neutral terms follow `task-delegation` §0.

## When to use / not
- Use: ambiguous or mixed requests, multi-step goals ("build it and put it online"), or when no other skill clearly matches.
- Skip: the request clearly matches one skill (load that skill directly) or is a trivial question (answer it).
- Project rules (entry docs such as AGENTS.md / CLAUDE.md) always win over the chain chosen here.

## Steps
1. **Classify** the request into one or more intents (table below). Read the words, the current working directory (files present, git state), and the conversation so far. Read-only words ("analyse", "find out", "just tell me") cap every chain at its read-only part (`mode-gates`).
2. **Detect project type and stage**: type from files or the user's words (see `build-project` references); stage = idea / scaffold / developing / live. Live systems pull in production-safety skills.
3. **Compose a chain** from the routing table. Drop links that do not apply; never add links "just in case". State the chain to the user in one line, e.g. `analyze-problem → code-change → definition-of-done → safe-hotfix`.
4. **Split into jobs** and decide placement with `task-delegation`: one job → inline; several independent jobs or one heavy job → sub-agents in parallel, with heartbeat. Dependent links stay sequential.
5. **Run the chain** link by link. Each link's output is the next link's input (findings → plan → diff → evidence → release).
6. **Re-plan at every checkpoint** (after evidence, after a failed step, after user feedback): if the evidence changes the intent (the "bug" is a config issue, the "small change" touches the schema), swap links and say so in one line. Do not silently continue the old chain.
7. **Stop** when a stop condition hits (below), then report.

## Intent → skill chain
| Intent | Signals | Default chain |
|---|---|---|
| **build** | new project, idea, "bikin website/app" | `build-project` → `local-dev-setup` → `definition-of-done` → (`web-quality-audit` if public web) → `release-deploy` |
| **change** | add/modify feature, refactor in existing repo | small: `code-change` → `definition-of-done`; large/risky: `plan-then-code` → `definition-of-done` |
| **fix** | error message, stack trace, broken behavior | known signature: `error-runbook`; unknown cause: `analyze-problem` → `code-change`/`plan-then-code` → `definition-of-done`; prod impact: + `safe-hotfix` or `release-deploy` |
| **analyze** | why, investigate, compare options, root cause | `analyze-problem` (read-only), then ask before any fix chain |
| **ship** | deploy, release, go live, hotfix | small tested backend fix: `safe-hotfix`; otherwise `release-deploy`; downtime risk: + `maintenance-window-ops` |
| **operate** | watch logs, alerts, restarts, reboots | `prod-log-watch`; disruptive actions: `maintenance-window-ops`; heavy jobs: `remote-offload` |
| **audit** | security review, pentest, quality/SEO/perf | security: `security-audit-cycle`; web quality: `web-quality-audit`; agent tools: `agent-tool-parity` |
| **migrate** | move site/app to new host/platform | `zero-downtime-migration` (+ `maintenance-window-ops` for cutover) |
| **setup / local** | run locally, env broken, onboarding | `local-dev-setup` (→ `analyze-problem` if stuck) |
| **document** | write up, changelog, decision, runbook | `living-docs` |
| **secrets** | needs password/token/key | `credential-broker` inside whatever chain is running |
| **outside project** | another repo/path | `external-project-scope` wraps the chain |
| **agent safety** | guards, hooks, protected paths | `agent-safety-hooks` |
| **mixed** | several of the above | one chain per intent; independent ones in parallel via `task-delegation`; shared files → sequential |

Always-on links: `mode-gates` (permissions), `definition-of-done` (before any "done"), `credential-broker` (any secret), `living-docs` (after finished work).

## Decision rules
- Prefer the shortest chain that reaches a verified outcome.
- Analysis before change when the cause is unknown; change before ship; never ship unverified work.
- Production touched → production-safety skills are mandatory links, not optional.
- Unknown project type → ask one question, or infer from files and state the assumption.
- Same file or system touched by two jobs → sequential, not parallel.

## Stop conditions
- Goal met and verified with quoted evidence (`definition-of-done`).
- Read-only cap reached: findings delivered, waiting for permission.
- Approval gate: cost, destructive action, production change, vendor lock-in, or a decision only the owner can make.
- Circuit breaker: three failures on the same step, or three hypotheses killed with no new lead.
- Missing access or information the agent cannot obtain itself.
- Scope drift: the work has become a different project than requested - confirm before continuing.

## Examples
Worked chains for a portfolio, CMS/blog, SaaS, admin dashboard, local-only tool, and a mixed request are in `references/examples.md`.

## Report to the user
One line with the chain, then per job: done / running / needs decision, with evidence for done items and the single next step.
