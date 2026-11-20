---
name: build-project
description: Use when the user wants to build a new project or app from an idea - "build me a portfolio", "create a SaaS", "make a blog/CMS", "admin dashboard", "online shop", "REST/GraphQL API", "landing page", "internal tool", "bikin website", "buat aplikasi" - or wants a greenfield scaffold. Clarifies only outcome-changing requirements, picks a stack by project type, scaffolds with repo/env/lint/test/CI, builds in vertical slices, verifies, and hands off to release-deploy.
---

# Build a project from idea to running app (universal)

Origin: repeated greenfield builds across very different project types. Model-agnostic and harness-agnostic; neutral terms (sub-agent, background, heartbeat, isolation) follow `task-delegation` §0.

## When to use / not
- Use: a new project, a new app inside a monorepo, or a rebuild from scratch.
- Do not use: a change to an existing codebase (`code-change` or `plan-then-code`); only getting an existing repo to run (`local-dev-setup`); diagnosing a problem (`analyze-problem`).
- Read-only words in the request ("analyse", "just propose") mean: produce the plan of section 1-2 only (`mode-gates`).

## Adapt to the project (fill once)
| Placeholder | Meaning | Example |
|---|---|---|
| `<PROJECT_TYPE>` | one of the reference types below, or a mix | `saas` + `landing-page` |
| `<STACK>` | chosen stack and why | Next.js + Postgres + Prisma |
| `<PKG_MANAGER>` | package manager, pinned | pnpm 9 |
| `<DEPLOY_TARGET>` | where it will run | static host, container, VPS, serverless |
| `<TEST_CMD>` / `<LINT_CMD>` / `<TYPECHECK_CMD>` | verification commands | `pnpm test`, `pnpm lint`, `tsc --noEmit` |

## Type references (load only the one(s) that match)
| Type | File |
|---|---|
| Portfolio / personal site | `references/portfolio.md` |
| Landing page / marketing site | `references/landing-page.md` |
| CMS / blog / content site | `references/cms-blog.md` |
| SaaS (auth, tenants, billing, roles, onboarding, email) | `references/saas.md` |
| Admin panel / dashboard | `references/admin-panel-dashboard.md` |
| E-commerce / shop | `references/ecommerce.md` |
| REST / GraphQL API, backend service | `references/api-backend.md` |
| Internal tool / back-office / script UI | `references/internal-tool.md` |

Each reference holds: feature checklist, data model sketch, 2-3 stack options, security and SEO/a11y musts, definition of done.

## Steps

### 1. Clarify (ask only what changes the outcome)
Ask at most 3-5 questions, one message, each with a recommended default so the user can answer "defaults". Ask only when the answer changes stack, data model, cost or scope:
- Who uses it and how many (public visitors, signed-in users, staff only)?
- Content editors who are not developers? (decides CMS vs files in repo)
- Accounts, payments, multi-tenant, i18n, offline/mobile?
- Hard constraints: existing hosting, language the team knows, budget, deadline.
- Must-have features for v1 versus later.
Do not ask about colors, fonts, folder names or library minutiae; decide and state them. If the user already answered, do not ask again.

### 2. Choose the stack
- Start from the reference's options; prefer the simplest one that meets v1 (static before server, one service before many, managed DB before self-hosted).
- Respect what the team or existing infrastructure already uses over fashion.
- State the choice in one short table: layer, choice, reason, alternative. Record it as a decision (`living-docs`).
- Pin runtime and package manager versions (`.nvmrc`/`.tool-versions`/`engines`, lockfile committed).

### 3. Scaffold
- Use the framework's official generator when one exists; never hand-copy boilerplate from memory when a generator is available.
- Repo: `git init`, `.gitignore` for the stack, README with run commands, license if public.
- Env: `.env.example` with every variable name and a comment, no real values; `.env` ignored. Secrets go through `credential-broker`, never into the repo.
- Quality: formatter + linter + typecheck, one test runner with a first passing test, pre-commit hook optional.
- CI: one workflow that installs from lockfile and runs lint, typecheck, test, build on every push/PR.
- Local run: one command to start (`dev` script, Compose file for services) - details in `local-dev-setup`.

### 4. Build in vertical slices
- Order slices so the riskiest assumption is proven first (auth, payment, data import, the core screen).
- Each slice goes end to end: data model/migration, server logic, API, UI, test. It is demoable when it ends.
- Typical order: skeleton layout and routing → core entity CRUD → auth/roles if any → the main user flow → secondary features → polish (empty/loading/error states, responsive, a11y, SEO).
- Real data or explicit empty states only; never fake numbers in the UI.
- Per slice, implement inner layer outward with tests (`plan-then-code` section B); multi-day builds keep a short plan file.
- Large independent slices can go to sub-agents with isolation (`task-delegation`); the main agent integrates.

### 5. Verify
- Run `<LINT_CMD>`, `<TYPECHECK_CMD>`, `<TEST_CMD>`, production build; quote the output.
- Start the built app and click/curl through the main flow; for web, check responsive widths (360, 768, 1440) and keyboard navigation.
- Public pages: run `web-quality-audit` (SEO, performance, a11y).
- Apps with accounts or payments: quick audit via `security-audit-cycle`.
- Close with `definition-of-done`.

### 6. Hand off
- First deploy and later releases: `release-deploy` (choose `<DEPLOY_TARGET>` from the reference).
- If the app exposes an agent/MCP interface: `agent-tool-parity`.
- Record stack decisions, run commands and open items (`living-docs`).

## Fixed rules
- Ask before choosing anything that costs money (paid services, plans) or locks in a vendor.
- No secrets, keys or personal data in code, examples, seeds or commits.
- Licenses: only dependencies whose license fits the project; note copyleft ones.
- Three failed attempts at the same step: stop and report (`definition-of-done`).
- Do not gold-plate: v1 scope is what the user confirmed; list extras as suggestions.

## Report to the user
Result first: what runs, how to start it (one command), what each slice delivered, verification evidence, stack table, decisions taken on their behalf, and the next suggested slice or release step.
