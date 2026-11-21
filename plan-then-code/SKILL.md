---
name: plan-then-code
description: Use when a non-trivial change needs mapping before implementation (/plan), when executing an approved plan or implementing a feature or fix cleanly (/code), or when asked to map files, dependencies, and root cause. Produces a categorized file map with line ranges, a saved plan, then inner-layer-outward implementation with per-layer tests and a clean-code checklist. Complements brainstorming and TDD skills, does not replace them.
---

# Plan then code: map first, then implement cleanly

Works for any project type (web app, API, CMS, mobile backend, CLI, portfolio site, scripts). It complements, not replaces: open-ended design goes to a brainstorming skill (`idea-shaping` in this pack), test-first cycles to a TDD skill, systematic debugging to a debugging skill. This skill owns the map and the layer order.

## When to use
- A task spans several files, carries risk, has an unclear root cause, or a saved plan is ready to execute.
- Skip for a single obvious edit (go straight to `definition-of-done`).
- Read-only rules apply during the plan phase (`mode-gates`).

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<PLAN_FILE>` | persistent plan | `plan.md` in the project root, started from `living-docs/templates/plan.md` (doc trail) |
| `<MEMORY_STORE>` | fallback when no plan file exists | the harness's project memory |
| `<LAYER_ORDER>` | layers from inner to outer | utils, service, controller, route, UI; or lib, command, CLI; or data, API, screen |
| `<TEST_CMD>` / `<TYPECHECK_CMD>` | per-layer verification | see `definition-of-done` |
| `<MAX_FILE_LINES>` | file split threshold | about 300 |
| `<SECURITY_CHECKS>` | project-mandatory checks | ownership/tenant checks, tool parity, accessibility |

## A. PLAN phase (read-only; only the plan file may be written)
1. **Understand and reproduce.** Read the description; find relevant files with real grep/search, not memory.
2. **Map by category**, each file with line ranges:
```
CATEGORY: ENTRY_POINT | BUSINESS_LOGIC | DATA_LAYER | AUTH | INFRA | TYPES | UTILS
- path/file (lines X-Y)
  ROLE: its part in this problem
  ISSUE: the specific problem, if any
  DEPENDS: other files it calls or that call it
```
3. **Dependency chain**: from entry point to data storage; who the downstream consumers are (frontend, jobs, integrations).
4. **Root cause**: why it happens, not only where. Search for the same pattern elsewhere and record the result (impact analysis in `definition-of-done`).
5. **Decision questions**: architecture choices, backward compatibility, trade-offs. Ask the user one question per decision with a recommended option; never decide silently.
6. **Implementation steps** ordered by `<LAYER_ORDER>`, each with its test.
7. **Save the plan** to `<PLAN_FILE>` (or `<MEMORY_STORE>`) only after the user approves the draft in chat:
```
# PLAN: <short name>
Date / Mode: plan, approved, ready for /code
Goal | File map | Root cause or decision
Stepwise steps | Affected files (file: change)
Risks and mitigation | Verification (automated + manual) | Complexity: Low/Medium/High
```
8. Finish with: "Plan saved in `<PLAN_FILE>`, ready to execute with /code." No code is written.

## B. CODE phase
**Before starting**
1. Does `<PLAN_FILE>` have content? Follow it; deviating means reporting why. No plan and a complex task: suggest the plan phase first.
2. Quick impact analysis (`definition-of-done`): same pattern elsewhere; fix in the shared layer when possible.

**Implement inside-out** (`<LAYER_ORDER>`):
- One layer, then **test that layer** before moving up: pure functions with unit tests (tests first when behavior is deterministic), then service, controller, route, UI.
- After a data or API layer changes: find consumers and sync the frontend and types.
- A newly written large file: check it is not corrupted (sane line count, parses/imports).

**Clean-code checklist (before finishing)**
- [ ] Single responsibility: one file one focus; files over `<MAX_FILE_LINES>` split; no duplication or dead code.
- [ ] Descriptive names; no confusing abbreviations.
- [ ] Parameterized queries (no string concatenation); transactions for multi-step writes; indexes for searched columns.
- [ ] Authentication and authorization on every sensitive route, including resource-ownership checks.
- [ ] Inputs validated; outputs sanitized; no hardcoded secrets or URLs.
- [ ] Every async operation has error handling with useful logs that do not leak secrets.
- [ ] Typed props/interfaces; loading, error and empty states handled; no fake data.
- [ ] No leftover debug logs; project `<SECURITY_CHECKS>` satisfied.
(Items that do not apply to the project type, such as DB items in a static site, are marked n/a.)

**Finish** with `definition-of-done` (tests, typecheck, quoted evidence), then `living-docs`; clear `<PLAN_FILE>` when the plan is fully done.

## Fixed rules
- One plan, one execution; do not start another feature midway.
- Three failures on the same step: stop and report (circuit breaker in `definition-of-done`).
- A change needed but absent from the plan: report before doing it when it has wider impact.
- Large independent chunks may go to sub-agents (`task-delegation`); the main agent integrates and verifies.

## Report
Plan phase: map summary (categories, key files), root cause, decision questions, plan location. Code phase: changed files with a summary, decisions and trade-offs, quoted test evidence, what remains.
