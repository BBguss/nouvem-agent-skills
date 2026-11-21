---
name: data-migration
description: Use when the shape of stored data changes - database schema change (add/rename/drop column or table, index, constraint), "write a migration", "schema differs between dev and prod", "column not found after deploy", data backfill or cleanup, moving data to another database, local SQLite or IndexedDB schema in a desktop or offline app, config or save-file format changes between app versions, CMS content model changes, "migrasi database", "ubah skema", "tambah kolom". Diffs schemas, writes forward and backward migrations, backs up, rehearses on a copy, and runs additive changes any time but destructive ones only in a window with approval.
---

# Data migration

Origin: a hosting panel's rule "verify the schema between dev and prod before every deploy" plus its expand-then-contract migrations, dumps kept before any change, and night-window rules for anything that can break live users. Model-agnostic, any database or file format.

## When to use / not
- Use whenever stored data, its schema or its file format changes, in any environment that holds data someone cares about.
- Do not use for moving a whole app to a new host (`zero-downtime-migration`) or for a slow query with no schema change (`analyze-problem`).

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<STORE>` | what holds the data | MySQL/Postgres, SQLite file, IndexedDB, JSON config, CMS content |
| `<MIGRATION_TOOL>` | how migrations run | Prisma, Knex, Alembic, Flyway, Django, `user_version` + SQL files, custom `migrate()` on app start |
| `<MIGRATIONS_DIR>` | where migration files live | `migrations/`, `prisma/migrations/` |
| `<ENVIRONMENTS>` | copies of the data | dev, staging, prod; or "user machines" for desktop apps |
| `<BACKUP_CMD>` | how to back up | `mysqldump`, `pg_dump -Fc`, copy the SQLite file, export content |
| `<WINDOW>` | when destructive changes may run | `23:00-04:00 local`, "next release only" |

## Steps
1. **Diff.** Compare the schema the code expects with each environment: tables, columns, types, defaults, indexes, constraints. Write the differences down. A difference you did not plan is a finding: report it before changing anything.
2. **Classify each change.**
   - **Additive** (new table, new nullable column, new index built online, new optional config key): safe while the app runs.
   - **Destructive or locking** (drop or rename, type change, NOT NULL on a big table, large backfill, rewriting user files): needs the expand-contract pattern and `<WINDOW>`.
3. **Expand-contract for destructive changes.**
   1. Expand: add the new shape next to the old one.
   2. Code writes both, reads new with fallback to old. Release.
   3. Backfill in batches (with a progress log; resumable).
   4. Switch reads to the new shape. Release.
   5. Contract: drop the old shape in a later release, after a backup.
4. **Write migrations** in `<MIGRATIONS_DIR>` with `<MIGRATION_TOOL>`: one forward and one backward step each, idempotent where possible, versioned, never edited after they ran anywhere shared.
5. **Back up** with `<BACKUP_CMD>` right before running on any environment with real data. Check the backup is not empty and can be restored (restore into a scratch database or folder once).
6. **Rehearse on a copy** of real-shaped data: run forward, run the app's tests and a `real-ui-verify` smoke, run backward, run forward again. Time it; long runs need the window.
7. **Approval** (`hitl-approvals`): additive on prod = ask; destructive, backfill on real data, or anything on user machines = typed-confirm.
8. **Run** in order dev → staging → prod. Watch errors and slow queries during and after. Keep the old code path working until the contract step.
9. **Verify** the schema diff is now empty and row counts or checksums match what the plan expected.

### Same skill, three kinds of project
| | Portfolio / static site | Desktop app | SaaS / web app |
|---|---|---|---|
| `<STORE>` | front-matter fields, CMS content model, JSON data files | local SQLite, settings JSON, save files on each user's machine | central SQL database, caches, search index |
| How it runs | a script over content files, committed with the site | on app start: read `user_version`, migrate step by step, keep a `.bak` of the file first | migration tool in the deploy pipeline |
| Risky part | renaming a field breaks old pages silently | users skip versions; every older version must migrate forward; no way to fix data by hand | locks on big tables; old and new code run together during deploy |
| Rollback | revert the commit | ship a fix release; the `.bak` lets the app restore | backward migration or restore from the backup |

## Doc trail
Follows `living-docs` section 7.
- `plan.md` (owner skill `data-migration`): the schema diff, each change with its class, expand-contract phases as steps, backup and restore check, approval lines, rollback.
- `checkpoint.md`: migration ids, environments run, backup location (no secrets), timings, row counts or checksums before and after.
- `docs/error-runbook.md` part B: migration failures with the exact error (`Unknown column 'x' in 'field list'`, `duplicate key`, `database is locked`), cause and fix; part A: messages users saw during the change.

## Fixed rules
- No destructive change without a fresh, restorable backup and an approval.
- Never edit a migration that already ran in a shared environment; add a new one.
- Additive first; contract only in a later release.
- Never run a migration against production from a laptop with ad-hoc SQL; use the tool and the pipeline.
- Keep dumps and old data until the user agrees they can go.

## Report
Result first: schema diff before and after, migrations run per environment, backup location, verification counts, anything held for the window or for approval.
