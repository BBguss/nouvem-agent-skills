---
name: code-change
description: Use when making a small or medium change in an existing codebase of any stack - add a field, endpoint, page, component, option or validation, rename or extract something, small refactor, dependency bump, "add a feature to this repo", "tambah fitur", "ubah", "refactor ini" - where the cause or design is already clear. Reads the repo's conventions first, makes a minimal diff that looks native to the codebase, adds or updates tests, and verifies. Escalates to plan-then-code when the change is cross-module or risky.
---

# Code change in an existing codebase (universal)

Origin: the gap between "one-line edit" (straight to `definition-of-done`) and "mapped multi-layer change" (`plan-then-code`). Model-agnostic and harness-agnostic; neutral terms follow `task-delegation` §0.

## When to use / not
- Use: a clear change touching roughly 1-6 files in one area of an unfamiliar or familiar repo.
- Escalate to `plan-then-code` when any of these hold: touches several modules or layers with unclear dependencies, changes a public API/schema used by others, needs a data migration, the root cause is unknown, or the user asked for /plan.
- Cause unknown: `analyze-problem` first. New project: `build-project`. Repo will not run: `local-dev-setup`.

## Adapt to the project (discover, do not guess)
| Placeholder | Meaning | Where to find it |
|---|---|---|
| `<CONVENTIONS>` | style, structure, naming, patterns | entry docs (AGENTS.md / CLAUDE.md / CONTRIBUTING), linter and formatter configs, 2-3 neighboring files |
| `<TEST_CMD>` / `<LINT_CMD>` / `<TYPECHECK_CMD>` | verification | package scripts, Makefile, CI workflow |
| `<BRANCH_RULES>` | branch/commit/PR conventions | CONTRIBUTING, recent `git log` |

## Steps
1. **Restate the change** and its acceptance criteria in 1-3 lines. Ask only if two reasonable readings lead to different code.
2. **Read conventions first.** Project rules files, lint/format configs, the CI workflow, and the closest existing example of the same kind of thing (another endpoint, form, component, migration). The new code should look like that example.
3. **Locate** every place the change must touch by search (definitions, callers, tests, types, docs, translations, config, fixtures). Note consumers downstream (frontend types, API clients, jobs, agent tools - `agent-tool-parity`).
4. **Smallest correct diff.**
   - Reuse existing helpers, components and patterns; no new dependency when the codebase already has one for the job (ask before adding one).
   - No drive-by reformatting, renames or unrelated refactors; note them as suggestions instead.
   - Keep public interfaces backward compatible unless the request is to change them.
   - Handle error, empty and loading paths like the neighboring code does; validate input at the boundary; authorization on new routes.
   - User-facing text follows the repo's i18n setup if one exists.
5. **Tests.** Add or update tests at the level the repo already uses for this kind of code (unit for logic, integration for endpoints, component/E2E for UI). For a bug, write the failing test first. Do not delete or weaken existing tests to make them pass.
6. **Verify.** Run `<LINT_CMD>`, `<TYPECHECK_CMD>`, the relevant tests, then the full suite if fast; run the app and exercise the change for UI/API work. Quote outputs.
7. **Review your own diff** (`git diff`): leftover debug code, secrets, commented-out blocks, unrelated changes, missing files. Commit per `<BRANCH_RULES>` with a message that says why.
8. **Close** with `definition-of-done`; record decisions or follow-ups with `living-docs`; shipping goes through `safe-hotfix` (small backend) or `release-deploy`.

## Refactor rules
- Behavior must not change: tests green before and after; add characterization tests first when coverage is thin.
- Move in small steps that each compile and pass; separate refactor commits from behavior commits.
- Big refactors (many files, architectural) are `plan-then-code`.

## Dependency bumps
- Read the changelog for breaking changes between the versions; update lockfile with the repo's package manager; run full tests and build; one major bump per change.

## Fixed rules
- The repo's conventions beat personal preference and beat this skill.
- Three failed attempts at the same step: stop and report (`definition-of-done` circuit breaker).
- Scope grows beyond the escalation criteria mid-way: stop, report, switch to `plan-then-code`.

## Report to the user
Files changed with one line each, how it was verified (quoted), any convention you followed that may surprise them, and suggestions you deliberately left out of the diff.
