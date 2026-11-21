---
name: living-docs
description: Use when finishing a unit of work that needs a changelog/checkpoint entry, when a new decision or finding must be routed to the right doc (rules, architecture, knowledge, runbook, known issues), when docs may have drifted or contradict each other, when starting a new session (bootstrap reading order), or when creating/trimming an entrypoint file. Keeps project knowledge short, indexed, and self-healing.
---

# Living docs: documentation that heals itself

Works for any project, from a one-person portfolio site (a single README plus a CHANGELOG is enough) to a multi-service SaaS. Use only the doc files the project actually has; create a missing one only when the user agrees.

## When to use
- Work just finished (write an entry); a new decision or finding appeared; docs seem to contradict each other; a new session starts; an entrypoint is created or trimmed.
- Skip for conversations with no change or new decision. Do not scan all docs every turn; that wastes tokens.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<ENTRYPOINT_FILE>` | the single entry point | `AGENTS.md`, or `README.md` for small projects |
| `<GUARDRAILS_FILE>` | absolute limits | `rules/safety.md` |
| `<PLAN_FILE>` | pending plan | `plan.md` |
| `<CHANGELOG_FILE>` | work entries, newest on top | `CHANGELOG.md`, `checkpoint.md` |
| `<CHANGELOG_ARCHIVE>` | archive of old entries | `CHANGELOG_ARCHIVE.md` |
| `<DOC_ROUTES>` | map of information type to doc | table in section 3 |
| `<DOC_WRITE_MODE>` | `auto` or `offer-first` | auto for the changelog, offer-first for the rest |
| `<PUSH_POLICY>` | who/when commits and pushes | commit after the entry; push only if the project does; commit trailer per project rules; "none" for local-only repos |
| `<ROTATE_AT>` | rotation threshold | about 30 entries |

## 1. Write switch: `<DOC_WRITE_MODE>`
- **auto**: write directly without asking. **offer-first**: offer ("Update `<CHANGELOG_FILE>`?"), write after a yes.
- Safe default: offer-first. A standing user permission ("always log") changes it for the files named, and is recorded in the entrypoint or project memory so new sessions know.
- Session cut off with no answer: assume neither yes nor no; ask again next session.
- Audits and drafts need no permission (read-only); writing to doc files follows the switch.

## 2. Changelog entry after finished work
Applies once `definition-of-done` is met. Prepend at the **very top** of `<CHANGELOG_FILE>`:
```
## Entry #<N+1> - <short title>
- What: <change, main files/components>
- Why: <root cause or goal>
- Tests: <command and short result, or "n/a" + reason>
- Commit: <sha>   Release: <tag/version or "not yet">
- Notes: <leftovers, risks, PARTIAL if something failed>
```
- Numbers are sequential and never reused. Read the top entry first to get the next number.
- Then commit (and push) per `<PUSH_POLICY>`: only this job's files, never another session's work. An entry not yet committed is not done.
- A plan in `<PLAN_FILE>` that is fully carried out: empty it.
- Past `<ROTATE_AT>`: move old entries to `<CHANGELOG_ARCHIVE>`, keep the newest.
- Never write secrets, credentials or sensitive internal paths in entries.

## 3. Routing decisions and findings (match from the top, stop at the first match)
| Type of information | Destination |
|---|---|
| Hard prohibition/obligation about agent behavior | rules / guardrails |
| Binding design decision for application code (deploy pattern, schema, auth) | knowledge / technical decisions |
| Structural fact: ports, paths, versions, module map | architecture |
| Known error with its solution | runbook (`error-runbook`) |
| Unfixed bug/limitation with a concrete action | known-issues |
| Deliberately deferred security finding | deferred ledger (`security-audit-cycle`) |
| Operations/release procedure | ops (`release-deploy`, `safe-hotfix`) |
| History of what was done | `<CHANGELOG_FILE>` |
| Specific to one AI tool only | that tool's overlay file |
- Unsure between decision and known-issue: a remaining action means known-issues; a final pattern means decision. Both relevant: record in both, cross-referenced.
- A pattern that applies across modules must not live only in the changelog (it will vanish into the archive); make it a decision entry.
- Moved entries carry a source tag `*(source: <origin>)*` and are noted in a "Migration history" section of the target doc; that log is never deleted.
- "Must/never" wording binds in any folder, but relocate it to rules so it is not missed.
- Small projects: collapse these destinations into README sections (Decisions, Known issues, Ops); the routing logic stays.

## 4. Drift audit (read-only; on request or at signs of drift)
1. Numbers/status that differ in two places within one file.
2. The same block in an overlay and a canonical file (one is certainly stale).
3. Orphan information: present only in one non-canonical file.
4. Old known-issues that may be fixed by a newer entry: flag for verification, do not strike automatically.
5. Rules in the wrong place; dead links; an index missing existing files.
Report as a list and do not fix in the same turn; fixes follow the switch in section 1.

## 5. Single entrypoint and session bootstrap
- Only `<ENTRYPOINT_FILE>` may say "read me first". Other files do not repeat that; on conflict the entrypoint wins. Per-tool overlays stay thin and point to the entrypoint.
- The entrypoint holds an index: one line per doc (purpose plus when to read it).
- New session bootstrap, once at the start: (1) entrypoint, (2) `<GUARDRAILS_FILE>`, (3) `<PLAN_FILE>` (any pending plan?), (4) only the top entry of `<CHANGELOG_FILE>`. Read the rest when relevant. Context feels full: repeat steps 2-4 only.
- Then determine the mode (`mode-gates`).

## 6. Keep docs short
Link, do not copy: one source of truth per fact. A file over about 300 lines: split or archive. Write decisions and their reasons, not session narrative.

## 7. Doc trail: plan, checkpoint, runbook
Every skill in this pack leaves the same three files, so the user always knows where to look and the next session can resume without asking.

| Moment | File (default name) | What goes in | Template |
|---|---|---|---|
| A plan is approved | `plan.md` | goal, checkbox steps with their checks, approvals needed, tests, rollback | [`templates/plan.md`](templates/plan.md) |
| Work is finished (or stopped PARTIAL) | `checkpoint.md` | numbered entry, newest on top | [`templates/checkpoint.md`](templates/checkpoint.md) |
| An error is understood | `docs/error-runbook.md` | exact error text, side, root cause, fix, status | [`templates/error-runbook.md`](templates/error-runbook.md) |

- The project's own names win: if it already has `CHANGELOG.md`, `docs/decisions/`, an issue tracker or a runbook elsewhere, use those and do not create duplicates.
- A missing file is created from the template the first time it is needed, and the report says so in one line.
- These three files are written in `auto` mode unless the project set `offer-first` for them; other docs keep the switch in section 1.
- Order inside one job: `plan.md` (before work) → work → `docs/error-runbook.md` (each error the moment it is understood) → `checkpoint.md` (last, referencing plan and runbook entries) → clear the finished plan.
- Tick plan steps as they are done, so an interrupted job shows exactly where it stopped.
- Small jobs (one obvious change) skip `plan.md`; they still get a checkpoint entry.
- A skill that says "Doc trail" lists only what it adds to these files; the rules above still apply.

## Report
One line: which doc was written or offered, the entry number, commit/push done or not. Drift findings as a numbered list with proposed fixes.
