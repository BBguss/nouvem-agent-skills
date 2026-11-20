# SaaS application

## Typical features
- [ ] **Auth**: email+password with verification, password reset, OAuth/SSO optional, magic link optional, 2FA (TOTP) for admins at least, session management and logout everywhere
- [ ] **Multi-tenancy**: organization/workspace, invite members by email, switch workspace
- [ ] **Roles/permissions**: owner, admin, member (+ read-only); permission checks in one policy layer
- [ ] **Billing**: plans, trial, checkout via a payment provider, webhooks for subscription state, customer portal, invoices, usage limits/quotas, dunning on failed payment, grace period
- [ ] **Onboarding**: signup → create workspace → first key action in under a few minutes; empty states that teach; checklist
- [ ] **Emails**: transactional (verify, reset, invite, receipt, payment failed) with a template system, plain-text part, unsubscribe for non-transactional
- [ ] Settings: profile, workspace, members, billing, API keys, audit log
- [ ] Admin/back-office for the operator (see `admin-panel-dashboard.md`)
- [ ] Marketing site + docs (see `landing-page.md`, `cms-blog.md`)
- [ ] Observability: error tracking, structured logs, uptime check, basic product analytics with consent

## Data model sketch
```
User { id, email(unique), name, password_hash?, email_verified_at, totp_secret?, created_at }
Organization { id, name, slug, plan_id, billing_customer_id, trial_ends_at, created_at }
Membership { user_id, org_id, role(owner|admin|member|viewer), invited_by, joined_at }   // unique(user_id, org_id)
Invitation { id, org_id, email, role, token_hash, expires_at, accepted_at }
Subscription { id, org_id, provider_sub_id, status(trialing|active|past_due|canceled), plan_id, current_period_end }
Plan { id, name, price, interval, limits{seats, projects, ...} }
<DomainEntity> { id, org_id (FK, indexed, NOT NULL), ... }   // every tenant row carries org_id
AuditLog { id, org_id, actor_id, action, target, meta, ip, created_at }
ApiKey { id, org_id, name, key_hash, last_used_at, revoked_at }
WebhookEvent { id, provider_event_id(unique), type, processed_at }   // idempotency
```
Tenancy model choice: shared tables with `org_id` (default), schema-per-tenant, or DB-per-tenant (only for strict isolation needs).

## Recommended stacks
1. **Full-stack TypeScript**: Next.js/Remix/SvelteKit + Postgres + an ORM (Prisma/Drizzle) + an auth library + a payment provider SDK + a transactional email provider. Default for small teams.
2. **Batteries-included backend framework**: Laravel, Rails or Django (built-in auth, queues, mail, admin) + server-rendered UI or an SPA. Fastest path when the team knows it.
3. **SPA + API**: React/Vue front end + a separate API (see `api-backend.md`) when there are mobile clients or a public API from day one.
Background jobs: a queue (Redis-backed or DB-backed) for emails, webhooks and heavy work.

## Security musts
- Tenant isolation enforced in one place (query scope/middleware/row-level security); a test proves user A cannot read org B by changing an ID (IDOR test).
- Authorization on every route server-side; never trust role from the client.
- Passwords hashed with a slow KDF (argon2/bcrypt); rate-limit login, reset and invite; generic error messages.
- Payment webhooks: verify signature, idempotent by provider event ID, subscription state from webhooks not from the redirect.
- Secrets in env/secret manager (`credential-broker`); API keys stored hashed, shown once.
- CSRF protection for cookie sessions; secure, httpOnly, SameSite cookies; CORS allow-list.
- Audit log for sensitive actions; data export and deletion path (privacy law readiness).
- Run `security-audit-cycle` before launch.

## SEO / a11y musts
- Marketing pages public and prerendered; app pages `noindex`.
- App UI: keyboard navigable, focus management in modals, labeled form fields, error messages tied to inputs, contrast AA, responsive down to 360 px.
- Emails: readable without images, real text, accessible link text.

## Definition of done
- Signup → verify → create org → invite member → member accepts → role limits enforced, all tested end to end.
- Checkout in provider test mode → webhook → plan active; failed payment → past_due → access policy applied; cancel works.
- Cross-tenant access test fails as expected; auth endpoints rate limited.
- Every transactional email renders and arrives in a test inbox.
- CI green (lint, typecheck, tests, build); error tracking receives a test error; backups and restore tested once.
