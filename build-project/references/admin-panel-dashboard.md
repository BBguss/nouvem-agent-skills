# Admin panel / dashboard

## Typical features
- [ ] Login (SSO or email+password+2FA), role-based menu and route guards
- [ ] Overview dashboard: KPI tiles, trend charts, recent activity, alerts - real data or explicit "No data"
- [ ] Resource tables: server-side pagination, sort, filter, search, column choice, bulk actions, CSV export
- [ ] Detail/edit forms with validation, optimistic or confirmed saves, destructive-action confirmation
- [ ] Date range picker and time zone handling for all metrics
- [ ] Audit log of admin actions; impersonation (with banner and audit) if support needs it
- [ ] Settings, user and role management
- [ ] Empty, loading (skeleton) and error states for every widget; refresh or live updates where needed

## Data model sketch
```
AdminUser { id, email, name, role_id, totp_secret?, last_login_at }
Role { id, name }   Permission { id, key }   RolePermission { role_id, permission_id }
AuditLog { id, actor_id, action, entity, entity_id, before, after, ip, created_at }
SavedView { id, user_id, resource, filters, columns }
MetricRollup { metric, bucket_start, bucket_size(hour|day), dimensions, value }   // pre-aggregated for fast charts
```
Domain entities come from the product being administered; the panel reads through an API or the same DB with least-privilege credentials.

## Recommended stacks
1. **Admin framework on top of an existing API/DB** (React-admin/Refine-style libraries, or a framework admin such as Django admin / Laravel admin packages / Rails admin). Fastest for CRUD-heavy panels.
2. **Custom SPA** (React/Vue/Svelte + component library + a data-table and charting library) + existing or new API, when UX matters or the panel is the product.
3. **Low-code internal tool builder** when only staff use it and speed beats control (see `internal-tool.md`).
Charts: follow a data-visualization guideline; do not invent metrics.

## Security musts
- Every endpoint authorizes by permission server-side; hiding a menu item is not security.
- 2FA for admin accounts, short sessions, re-auth for destructive or financial actions.
- Audit log is append-only; exports respect the same permissions and are logged.
- Server-side filtering/pagination with parameterized queries; whitelist sortable columns.
- No production DB superuser; read replicas for heavy reporting.

## SEO / a11y musts
- Entire panel `noindex`, not in the sitemap.
- Tables: proper `<table>` semantics or ARIA grid, sortable headers announce state, keyboard row actions.
- Charts have a text/table alternative and do not rely on color alone; contrast AA.
- Responsive: tables collapse to cards or scroll in a container at 360 px; no page-level horizontal scroll.

## Definition of done
- Each role sees only its menus and gets 403 from forbidden endpoints (tested).
- KPI numbers match a direct DB query for the same range and time zone (quote both).
- Tables handle 10k+ rows via server pagination without freezing; export matches the filtered view.
- Destructive actions confirm and are audited; responsive check at 360/768/1440.
