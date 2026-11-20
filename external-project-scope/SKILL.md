---
name: external-project-scope
description: Use when the user asks to work on a path, repo, sibling project or system outside the current project ("out of scope", "project lain", "folder di luar", external repo, another app on the same servers). Labels the work as out-of-scope, reuses the current project's infra map, conventions and sub-agents, keeps history isolated, and keeps production locks intact.
---

# Work outside the current project's scope

Applies to any project type: a monorepo neighbor, a sibling repo on the same machine, a client site, a library you depend on, another app on shared infrastructure.

## When to use
- The target lives outside the current project root (other path, other repo, other app on the same infra) and the user asks for it explicitly.
- Skip when the work is part of this project, or when the target has a team or infra this project knows nothing about (ask the user first).
- Multi-part work: split with `task-delegation`; one sub-agent per target if independent.

## Project adaptation
The project defines these in AGENTS.md/CLAUDE.md/GEMINI.md or its rules files. The skill reads them and does not guess.
| Placeholder | Meaning | Example |
|---|---|---|
| `<PROJECT_ROOT>` | current project root (scope boundary) | `<WORKSPACE>/<project>` |
| `<INFRA_MAP>` | file mapping servers/nodes/ports/DBs, if the project has one | `docs/infra.md`; none for local-only projects |
| `<CONVENTIONS>` | engineering standards carried to the target | security, UI, file verification |
| `<EXTERNAL_TARGETS>` | known external targets and their type | name, path, runtime |
| `<PROD_LOCKS>` | locked production paths/services; empty if the project has no prod | prod folder, prod process, PaaS production environment |
| `<STATUS_LOG>` | this project's changelog/history | `CHANGELOG.md`, git history |
| `<EXPLORER_AGENTS>` | read-only exploration sub-agents per node/target | optional |

## Steps
1. **Identify the target.** Look for `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`/README at the target root. If present, it wins for that target (bootstrap order, mode, prohibitions): read it first and cite it in the report. If absent, use this project's `<CONVENTIONS>`.
2. **Label** every response `[OUT-OF-SCOPE - <TARGET_NAME>]` at the start, so the user and other agents know this is not main-project work.
3. **Reuse what is mature:** the infra map (`<INFRA_MAP>`: nodes, mounts, proxies, runtimes) if one exists, security habits (parameterized queries, input validation, no credentials in output), file verification after big edits, and exploration sub-agents (`<EXPLORER_AGENTS>`) for remote investigation.
4. **Start read-only.** Map structure, processes, ports, DB, and how the target runs before changing anything. Change only what was asked.
5. **Do the work** within the requested scope. Record target changes in the target's own repo/log when it has one; credentials only via `credential-broker`.
6. **Verify** with real evidence (commands, exit codes, responses) per `definition-of-done`.
7. **Report** in the format below. Offer (without pushing) a note in `<STATUS_LOG>` only when the work is an integration with this project.

## Fixed rules
- **History isolation:** do not record target file changes in `<STATUS_LOG>` or this project's git commits unless the change is an integration (API, webhook, shared config) with this project. Do not touch the target's git repo unless asked.
- `<PROD_LOCKS>` stay locked. This project's production rules apply to shared infra; an external target does not unlock them. Production apps not owned by the target are never stopped.
- Shared infra: proxy, port or DB changes can affect this project. Check this project's services after any batch touching shared infra (see `remote-offload` for shared nodes).
- The target's own rules (its AGENTS.md) win over this project's habits on conflict, except the safety prohibitions above.
- Moving or migrating an app out of the target: follow `zero-downtime-migration`.
- Target status docs go into the target's docs, not `<STATUS_LOG>` (`living-docs`).

## Standard response format
```
[OUT-OF-SCOPE - <TARGET_NAME>]
Summary: <what was asked, target path/project>
Result: <findings/changes + verification evidence>
Files & paths: <path> - <role>
Target rules used: <path to the target's AGENTS.md, or "none">
Next step: <short suggestion>
```

## Report
Use the format above; result first, one line on isolation ("not logged in this project's history" or "logged because it is an integration"), and mention anything waiting for permission.
