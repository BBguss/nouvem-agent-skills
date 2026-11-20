# Internal tool / back-office / ops utility

## Typical features
- [ ] Company SSO or simple auth restricted to staff; network restriction (VPN/private network/IP allow-list) where possible
- [ ] The one workflow it exists for (approve requests, look up a customer, run a report, trigger a job) done in as few clicks as possible
- [ ] Forms over existing data sources (DB, internal APIs, spreadsheets), bulk import/export CSV
- [ ] Audit trail of who did what; confirmation for writes to production data
- [ ] Job runner UI: start, progress, logs, cancel, retry
- [ ] Notifications to chat/email when long jobs finish or need approval

## Data model sketch
Usually reuses existing systems. Own tables only for tool state:
```
ToolUser { id, email, role }   Job { id, type, params, status, started_by, started_at, finished_at, log_ref }
Approval { id, subject, requested_by, approved_by?, status, decided_at }   AuditLog { id, actor, action, target, created_at }
```

## Recommended stacks
1. **Low-code internal tool builder** (hosted or self-hosted) connected to DB/APIs - fastest for CRUD and approvals.
2. **Framework with built-in admin** (Django admin, Laravel admin packages, Rails) - code ownership with little UI work.
3. **Small script UI**: a CLI with good help text, or a lightweight UI (Streamlit/Gradio-style, or a minimal server-rendered app) for data/ops tasks. Often the right answer for a team of a few people.
Local-only tools (run on a laptop) may need no server at all: a CLI or a notebook plus a README is enough.

## Security musts
- Never public without auth; least-privilege DB credentials (read-only unless writes are the point).
- Writes to production data: confirmation, dry-run mode, audit log, and a way to undo or at least an exported backup before bulk changes.
- Secrets through `credential-broker`; no shared admin password.
- Input validated even though users are trusted (mistakes are the main risk).

## SEO / a11y musts
- `noindex` and not linked publicly.
- Keyboard-friendly forms, labeled fields, clear errors; usable on a laptop screen at minimum, responsive if staff use phones.

## Definition of done
- The target workflow completed end to end by a real staff account on staging data.
- Dry-run output matches the real run on a sample; audit entries recorded.
- Access denied for non-staff (tested); README explains how to run, configure and who owns it.
