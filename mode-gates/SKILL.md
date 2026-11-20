---
name: mode-gates
description: Use when a user message mixes mode signals (a read-only word such as "analyse" or "find out" plus a command like /code), when a slash command like /plan, /code, /ask or /deploy is given, or when a read-only investigation uncovers a needed fix. Resolves which instruction wins, enforces read-only vs write permission, and requires asking before moving from findings to fixes.
---

# Mode gates: which instruction wins

Decides whether the agent may write or act when one message carries several mode signals. Works in any project type; where there is no production or no slash commands, the same priority logic applies to plain-language wording.

## When to use
- A message contains more than one mode signal, a mode command, or a read-only investigation finds something that needs fixing.
- Skip for single-direction requests with no mode signal (just follow `definition-of-done`).

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<READONLY_KEYWORDS>` | words that force read-only | analyse, investigate, find out, explain why; multilingual: "analisis", "cari tahu", "analiza" |
| `<READONLY_EXCEPTIONS>` | phrases that change the rule, with their SOP | "analyse error" runs `error-runbook` (look up, fix, document) |
| `<MODE_COMMANDS>` | command-to-mode map | `/plan` read-only, `/code` implement, `/ask` Q&A, `/deploy` locked |
| `<DEPLOY_GATE>` | explicit confirmation phrase before release | the exact word "Deploy" |
| `<MODE_LABELS>` | label at the start of each reply | `[READ-ONLY]`, `[PLAN]`, `[CODE]` |
| `<RELEASE_TARGET>` | what "deploy" means here | production server, PaaS push (Vercel/Netlify/Fly), store upload, package publish, or none for local-only projects |

## Priority (lower number wins)
| P | Signal | Effect |
|---|---|---|
| **1** | A `<READONLY_KEYWORDS>` word in the user message | **Force read-only**, beating any command in the same message. An override, not an addition. Except `<READONLY_EXCEPTIONS>` |
| **2** | An explicit mode command | Decides whether writing/executing is allowed (table below), unless P1 forced read-only |
| **3** | `definition-of-done` | Always active, in every mode |

Example: "/code analyse why the build fails" - P1 wins. Treat it as a read-only investigation despite `/code`.

## Command map (default; the project adjusts it via `<MODE_COMMANDS>`)
| Mode | Allowed | Forbidden | Follow-on skill |
|---|---|---|---|
| `/plan` | read, search, read-only commands, write the plan file | change code, config or data; mutating commands | `plan-then-code` |
| `/ask` | evidence-backed answers from actual sources | write anything (files, mutating commands, DB writes) | answer with file and line references |
| `/code` | implement, test, edit files | out-of-scope actions, release | `plan-then-code`, `definition-of-done` |
| `/deploy` | release to `<RELEASE_TARGET>`, only after `/code` is done and `<DEPLOY_GATE>` is given | releasing without the gate, bundling unrequested changes | `release-deploy`, `safe-hotfix` |

- `/plan` and `/code` exclude each other in one message: pick the safer (`/plan`) and ask.
- Complex or destructive-risk tasks default to `/plan` first.
- Formal security audits follow `security-audit-cycle`; a free-form bug or security question without a command is a read-only review.
- Start each reply with the mode label (`<MODE_LABELS>`). When P1 overrides, use the read-only label whatever the command.
- No slash commands in this harness: infer the mode from the wording using the same priorities, and state the inferred mode in the label.
- No production or release target (local-only project): `/deploy` does not apply; "ship" means commit or package, and only when asked.

## When read-only finds something to fix
1. Stop at the findings. **Do not fix in the same turn.**
2. Report: finding, evidence (file:line or command output), proposed fix, risk, impact (impact analysis in `definition-of-done`).
3. Ask explicit permission to switch to `/code`; execute only in a later turn after the user agrees.
4. A configured exception (for example the "analyse error" SOP) may fix directly per its SOP, since the project configuration already grants it.

## Fixed rules
- Permission from an earlier message does not carry over to a new message with a read-only keyword.
- Unsure between two modes: take the more restrictive one, then ask.
- Read-only mode may write only the plan or notes files that mode explicitly allows; otherwise zero changes to repo, config, data and servers.
- A standing user permission ("just fix any bug you find") is valid but does not beat P1 and covers only the scope it names.

## Report
Open with the mode label. On a signal conflict, one sentence: which signal won and why. When stopping at findings: findings, proposal, and the question asking permission to continue.
