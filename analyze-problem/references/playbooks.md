# Problem-type playbooks

Short checklists. Gather the listed evidence first, then fill the hypothesis table.

## Bug / wrong output
- Exact input, account/role, environment, and output; minimal reproduction (smallest input that fails).
- Trace the data path end to end; log or debug intermediate values (local only).
- Look for: null/undefined paths, type coercion, time zones and DST, locale/number formats, off-by-one, caching (stale), race conditions, wrong environment config, permission branches.
- Write the failing test first; it becomes the regression test after the fix.

## Performance - frontend (slow page)
- Lab: Lighthouse/DevTools performance trace on a mobile profile; record LCP, INP, CLS, TBT, total JS.
- Network waterfall: blocking scripts/CSS, large images, many requests, slow TTFB (then it is backend), third-party scripts.
- Bundle analysis: biggest modules, duplicated libraries, code not split by route.
- Rendering: long tasks, unnecessary re-renders, layout thrash, huge DOM.
- Hand off improvements to `web-quality-audit`.

## Performance - backend (slow endpoint/job)
- Measure: p50/p95/p99 latency, throughput, error rate; one slow request traced end to end (timings per span or manual timestamps).
- DB first: slow query log, `EXPLAIN (ANALYZE)`, missing indexes, N+1, locks, connection pool exhaustion.
- Then: external API calls without timeouts, synchronous work that belongs in a queue, CPU-heavy serialization, memory/GC pressure, cold starts.
- Compare with data size and traffic at the time; reproduce with a load tool on staging only.

## Failing build / CI
- Exact failing step and first error; does it fail locally with the same command and versions?
- Diff since last green run: code, lockfile, CI image/runner, runtime version, env/secrets, external services, cache.
- Common: lockfile drift, unpinned tool versions, missing env in CI, case-sensitive paths (works on macOS, fails on Linux), out-of-memory, network fetch at build time, expired tokens.
- Clear CI cache once to rule it out (it is a test, record the result).

## Flaky test
- Run it many times in isolation and in the full suite (`--repeat`, loop); record failure rate.
- Look for: order dependence and shared state, time/date and time zones, randomness without seed, real network, async waits with fixed sleeps, parallel workers sharing a DB, resource leaks.
- Fix the cause; quarantining is a temporary mitigation with an owner and a date.

## Deploy / infrastructure
- What changed in infra (image, config, secrets, DNS, certificates, proxy rules, resource limits)?
- Health checks, process manager status, container restarts and exit codes, OOM kills, disk full, clock skew.
- Follow-on errors: find the first failure in time; everything after may be noise (`prod-log-watch` triage).
- Any fix that restarts or reloads services: `maintenance-window-ops` rules.

## Data inconsistency
- Identify affected records and the first bad one; compare with audit logs or history tables.
- Look for: missing transactions, retries without idempotency, concurrent updates, partial migrations, timezone conversions, manual edits.
- Read-only queries only; a repair script needs its own plan, dry run and backup.

## Design / architecture question
- Clarify the decision and its constraints (scale now and in a year, team skills, budget, compliance, deadlines).
- Gather facts about the current system (load, data size, pain points) instead of assuming.
- 2-4 options with trade-offs against ranked criteria; prefer reversible decisions and the simplest option that meets the constraints.
- Prototype or spike only to answer the riskiest unknown; time-box it.
- Write a decision record (`templates.md`) and route it with `living-docs`.
