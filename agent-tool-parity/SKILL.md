---
name: agent-tool-parity
description: Use when adding or changing a user-facing route, endpoint or feature in an app that also exposes an AI-agent interface (MCP server, tool or function-calling API), or when auditing coverage between the human UI/API and the agent tools. Every route must have a safe agent tool or a reasoned exemption in a coverage file, enforced by an automated test. Fits SaaS, admin panels, dashboards, CMS, e-commerce and API projects.
---

# Agent tool parity

Model- and harness-agnostic. "Tool" means an MCP tool, a function-calling definition, or an equivalent skill API.

## When to use
- Use when creating, changing or deleting a route or feature users can reach, and when creating a new agent tool.
- Do not use for apps with no agent interface, or for purely internal routes (health check, inbound webhook) that are clearly not user features; just record the exemption.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<USER_ROUTE_FILES>` | files holding user-feature routes | `routes/user*.js`, `app/api/**/route.ts`, `urls.py` |
| `<TOOL_DEFS_DIR>` / `<TOOL_HANDLERS_DIR>` | tool definitions and handlers | `mcp/tools/`, `mcp/handlers/` |
| `<COVERAGE_FILE>` | map from route to tool/exemption | `mcp/coverage.json` |
| `<PARITY_TEST>` | enforcing test (runs in tests, CI gate, hotfix) | `tests/parity.test.js` |
| `<DESTRUCTIVE_LIST>` | destructive tools that need confirmation | `toolPolicy` |
| `<BACKLOG_MAX>` | upper bound of parity debt (may only fall) | a constant in the test |
| `<TOOL_NAME_PATTERN>` | tool naming pattern | `<app>_<verb>_<object>` |

## Core rules
1. Every new user route, in the same change, gets one entry in `<COVERAGE_FILE>`:
   - `{"tool": "<tool_name>"}`: the tool uses the same logic; or
   - `{"exempt": "<real reason>"}`: only for the legitimate categories below.
2. The backlog only shrinks. `{"backlog": ...}` entries are old debt. A new route may not go to backlog. When closing one, change it to `tool` and lower `<BACKLOG_MAX>`; never raise it.
3. Removed or renamed routes are removed or renamed in `<COVERAGE_FILE>`; stale entries fail the test.
4. Serve the tool list from the server (e.g. `tools/list`) so clients need no update when tools are added.

### Legitimate exemptions
| Category | Examples |
|---|---|
| account security | login, 2FA, passkeys, sessions, SSO, password/email change, account deletion, token rotation |
| browser handoff | payment pages, binary downloads, share links, web-based DB consoles |
| pure UI state | tours, read-notifications, banners, feedback |
| internal | quotas, wizard helpers, setup of the agent interface itself |
"Lazy", "no time" or "complicated" is not an exemption; that is backlog (and new routes may not enter it).

## Security checklist for a new tool
| # | Required | How |
|---|---|---|
| 1 | Minimum scope | scope `<area>:read\|write\|delete\|exec`; a read tool must not carry a write scope |
| 2 | Ownership | resolve every ID (site, DB, file, order) through a helper using the `userId` from the session/token, never from arguments; never query by ID without an owner filter |
| 3 | Reuse logic | call the same controller/service as the UI, including the middleware chain (feature flags, ownership, subscription); do not duplicate business logic |
| 4 | Destructive actions | delete/overwrite/undo/revoke/restore/reset go in `<DESTRUCTIVE_LIST>`; the executor refuses (`CONFIRMATION_REQUIRED`) until the user approves (`confirm: true`) |
| 5 | Load tier | state-changing tools never sit in a read-only tier; heavy tools (build, deploy, import/export, terminal) get rate limits or queues |
| 6 | No secrets or internals | output has no passwords, tokens, `.env`, private keys, real host paths or architecture detail; credentials a user must see appear in the UI, not via a tool (`credential-broker`) |
| 7 | Validated input | complete `inputSchema` (types, enums, `required` present in `properties`); SQL through a guard, commands through a command policy |
| 8 | Honest errors | human-readable messages, no stack traces or raw SQL |
| 9 | Behaviour tests | at least: another owner is refused, the normal path succeeds, no confirmation is refused (if destructive) |

### Audience: user vs admin
- Each tool has an `audience`: `user` (default) or `admin`. Admin tools require a scope prefixed `admin:`; user tools must not use it (the test rejects both).
- Effective admin role only when the account is admin and the token carries an admin scope. An admin token without the admin scope is treated as a user.
- Tool lists and calls are filtered by role; an admin tool called with a user token answers "not found" before any scope check and before the handler runs.

## Steps to add a tool
1. Definition in `<TOOL_DEFS_DIR>` (name per `<TOOL_NAME_PATTERN>`, a description saying when to use it).
2. Handler in `<TOOL_HANDLERS_DIR>` following the checklist.
3. A `<COVERAGE_FILE>` entry for every route it covers.
4. Behaviour tests for the tool, then run `<PARITY_TEST>` until green.
5. Update the tool count/list in the agent-interface docs (no internal paths or architecture; see fixed rules).

## Enforcing test (required, automatic)
`<PARITY_TEST>` must fail when:
- a user route is missing from `<COVERAGE_FILE>`, or an entry has no route (stale);
- an entry is not exactly one of `tool` / `exempt` / `backlog`, the tool is unregistered, or the exempt reason is empty;
- the backlog count exceeds `<BACKLOG_MAX>`;
- a tool lacks a valid scope, description, consistent schema or handler;
- a destructive tool is unregistered, not flagged destructive, has no `confirm` argument, or its handler runs without confirmation;
- a state-changing tool is in the read-only tier;
- audience and scope disagree, or a user token sees or calls an admin tool.
Wire the test into a gate that cannot be bypassed (local tests, CI, and the hotfix/release path, see `safe-hotfix`, `release-deploy`). If the project has no such test, create it first; a skill without enforcement is just advice.

## Fixed rules
- Never loosen the test, raise `<BACKLOG_MAX>`, or write a sloppy exempt reason to turn the gate green.
- A tool never bypasses authorization the UI enforces; the agent has at most the rights a human has.
- Tool output, docs and examples never reveal internal paths, server config or architecture.
- Review a new tool like a new route: `security-audit-cycle` (authorization, IDOR, injection). Record decisions via `living-docs`; done means `definition-of-done`.

## Report
Short: routes added/changed, tool or exemption chosen (with reason), `<PARITY_TEST>` result, and remaining backlog.
