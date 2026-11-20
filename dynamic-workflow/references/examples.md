# Worked chains

Each example: request → classification → chain → notes on re-planning and stops.

## 1. Portfolio website
**Request:** "Bikin website portofolio buat saya, ada halaman project dan kontak, terus online-in."
- Intents: build + ship. Type: portfolio. Stage: idea.
- Chain: `build-project` (ref `portfolio.md`; ask: content editor? custom domain? contact via form or email?) → `local-dev-setup` (one `dev` command) → `definition-of-done` → `web-quality-audit` (Lighthouse >= 90) → `release-deploy` (static host).
- Inline: single job, light-to-medium; no sub-agents needed.
- Stop: approval gate if the domain or host costs money.

## 2. CMS / blog
**Request:** "We need a blog our marketing team can edit, and it must rank on Google."
- Intents: build + audit (SEO). Type: cms-blog. Non-developer editors → headless or full CMS, not Markdown in git.
- Chain: `build-project` (ref `cms-blog.md`; slices: post model + render → editor roles → media → feed/sitemap → redirects) → `security-audit-cycle` quick audit (rich text, uploads, admin login) → `web-quality-audit` → `release-deploy`.
- Re-plan: if they already run a CMS, intent becomes change/migrate → `code-change` or `zero-downtime-migration`.

## 3. SaaS
**Request:** "Build a SaaS for clinics to book appointments, with subscriptions and team accounts."
- Intents: build (heavy). Type: saas + landing-page.
- Chain: `build-project` (ref `saas.md`; riskiest slice first: tenancy + auth, then billing webhooks) → per-slice `plan-then-code` → `definition-of-done` → `security-audit-cycle` (formal cycle before launch) → `agent-tool-parity` if an agent/MCP interface exists → `release-deploy`.
- Delegation: landing page and transactional email templates are independent jobs → sub-agents in parallel with isolation; main agent owns auth/billing core and integration.
- Stops: payment provider and plan pricing need owner decisions; costs need approval.

## 4. Admin dashboard (existing product)
**Request:** "Dashboard admin kita lambat dan angka revenue-nya beda sama laporan finance."
- Intents: analyze (two problems: performance + data correctness). Read-only cap from "kenapa/beda" style wording until permission.
- Chain: `analyze-problem` ×2 in parallel (sub-agents: perf playbook; data inconsistency playbook) → report root causes + options → on approval: `plan-then-code` (rollup table + time zone fix) → `definition-of-done` (KPI equals direct DB query) → `release-deploy` (schema change, not a hotfix).
- Re-plan: if the revenue gap is a time zone boundary only, downgrade to `code-change` + `safe-hotfix`.

## 5. Local-only project
**Request:** "I just cloned this repo, nothing runs, I only need it on my laptop to try something."
- Intents: setup. Stage: developing. No production involved; ship links never added.
- Chain: `local-dev-setup` (detect stack, pin runtime, env from example, Compose DB, seed) → if stuck after three fixes: `analyze-problem` (failing build playbook) → `living-docs` (write the working steps into README if missing).
- Stop: secrets needed → list names, fetch via `credential-broker` or ask the owner; never invent.

## 6. Mixed request mid-session
**Request:** "Fix the login error from the log, also add a dark mode toggle, and deploy tonight."
- Intents: fix + change + ship. Jobs: (a) login error, (b) dark mode, (c) release.
- Chain: (a) `error-runbook` → `definition-of-done`; (b) `code-change` → `definition-of-done`; (a) and (b) run in parallel via `task-delegation` (different files; isolation) → (c) `release-deploy` after both verified; if the release can drop connections → `maintenance-window-ops` for timing.
- Re-plan: if (a) turns out to be an infrastructure issue, switch it to `prod-log-watch` triage and keep (b) running.

## 7. Internal tool, quick
**Request:** "Buatkan tool kecil buat import CSV pelanggan ke database staging."
- Intents: build (light). Type: internal-tool, local-only CLI.
- Chain: `build-project` (ref `internal-tool.md`, stack option 3: CLI with dry-run) → `definition-of-done` (dry run vs real run on a sample) → `living-docs` (README usage). No deploy.
- Stop: writing to any database other than staging needs approval and a backup.
