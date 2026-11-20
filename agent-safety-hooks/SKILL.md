---
name: agent-safety-hooks
description: Use when setting up, testing or debugging lifecycle guards (hooks) for a coding agent - blocking writes or commands that touch protected production paths or dangerous commands (manual web-server reload, recursive delete on data, force push, mass process kill, secrets in command lines), checking big files written to network storage for truncation or corruption, or stopping heavy jobs when machine load stays high. Applies to any project and any agent harness.
---

# Agent safety hooks

Model- and harness-agnostic. Neutral terms follow `task-delegation`.

Principle: rules in documents can be forgotten by the model; hooks are executed by the harness and cannot be. Anything that must be absolute is guarded by a hook, not only by text.

## When to use
- Use when installing, changing, testing or diagnosing hooks/guards, or when an incident shows text rules are not enough.
- Do not use hooks for style preferences or suggestions; hooks are for boundaries that hurt when crossed.

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<PROTECTED_PATHS>` | folders the agent must not write or mutate outside the official route | production folder, credential store |
| `<APPROVED_ROUTE>` | the only official way to change protected things | a specific deploy/hotfix script |
| `<DANGEROUS_PATTERNS>` | command regexes that are blocked or need confirmation | table below |
| `<HOOK_DIR>` | hook scripts folder (under version control) | `.agents/hooks/scripts/` |
| `<NETSTORE_PATHS>` | paths on network storage prone to truncated writes | NFS/SMB share |
| `<LOAD_LIMIT>` / `<LOAD_WINDOW>` | load threshold and duration before acting | load1 > 10 for 2 minutes |
| `<SAFE_CMD_ALLOWLIST>` | commands still allowed under high load | `ps`, `top`, `kill`, `uptime` |

## Three core guards

### 1. PreToolUse: protected-path gate
Runs before a tool writes a file or runs a command. Verdict: `allow`, `deny`, or `ask`.
- deny when a write target is in `<PROTECTED_PATHS>`, or a command mutates those paths outside `<APPROVED_ROUTE>`.
- deny when a command matches `<DANGEROUS_PATTERNS>`:

| Class | Example pattern | Verdict |
|---|---|---|
| manual web-server reload without config test | `nginx -s reload`, `systemctl reload` with no prior `-t` | deny; use the official route |
| recursive delete of data | `rm -rf` on root, home, data folders | deny |
| force push | `git push --force`, `-f`, `--force-with-lease` to a shared branch | deny/ask |
| mass process kill | `killall <runtime>`, `pkill -f <runtime>`, `<process-manager> kill`, `rm -rf` of a daemon folder | deny |
| kill a specific PID | `kill <pid>` | ask, show the real process name |
| secret in arguments | `sshpass -p`, `-p<password>`, tokens in URLs | deny, point to `credential-broker` |

Write patterns as tight as possible so legitimate work is not blocked; allowlist the official route by full script name, not a loose substring.

### 2. PostToolUse: file-corruption check
On network storage (NFS/SMB) large writes are sometimes truncated or collapsed into one line. After a tool writes a file under `<NETSTORE_PATHS>`:
- size over about 5 KB but line count at most 1: warn "possibly corrupt, rewrite multi-line";
- file ends abnormally or is smaller than what was written (truncation);
- contains NUL bytes (`tr -d '\000' < f | cmp - f`);
- if the write tool reports a line count, compare with `wc -l`.
This hook warns (does not block); the agent must rewrite and check again. For important files also run `wc -l` manually after saving.

### 3. Load guard
Heavy work (big greps on huge files, full test suites, builds) can make the machine unresponsive.
- A light daemon (cron/systemd timer, every minute): if load1 > `<LOAD_LIMIT>` for `<LOAD_WINDOW>`, stop (SIGSTOP/SIGTERM) a few top-CPU processes owned by the agent's user. Protect init, sshd, the web-server master, databases and system services; log every action.
- Companion PreToolUse hook: while load is high, deny new commands except `<SAFE_CMD_ALLOWLIST>`, so the agent stops adding load and looks for the cause.
- On machines without `ps -e` (BusyBox) use `top -b -n1`.
- Move heavy work to another machine or a worker sub-agent (`task-delegation`, `remote-offload`); do not fight the guard by disabling it.

## Hook format (common style; match your harness docs)
A hook is a command that receives JSON on stdin and answers via stdout/exit code.
```json
{"tool_name":"Write","tool_input":{"file_path":"<PROTECTED_PATHS>/app.js"}}
```
Typical deny answer: `{"decision":"deny","reason":"<short reason>"}` (some harnesses use exit code 2 with the reason on stderr, or `permissionDecision`). Always write a reason that names the official route.

Script principles: fail closed for dangerous targets, but allow when the JSON is unreadable so the harness never stalls; short timeout (15 s or less); no side effects other than logging.

## Testing a hook
Pipe sample payloads into the script and check the verdict:
```bash
echo '{"tool_name":"Write","tool_input":{"file_path":"<PROTECTED_PATHS>/x"}}' | node <HOOK_DIR>/gate.js   # must deny
echo '{"tool_name":"Write","tool_input":{"file_path":"<DEV_DIR>/x"}}'        | node <HOOK_DIR>/gate.js   # must allow
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf <DATA_DIR>"}}'      | node <HOOK_DIR>/gate.js   # must deny
echo 'not json' | node <HOOK_DIR>/gate.js; echo "exit=$?"                                              # must be safe
```
Test three classes: blocked, allowed (including the official route), and malformed input. After changing patterns, rerun all three; a hook that over-blocks is as broken as one that leaks. Also trigger a forbidden action in a sandbox on the real harness at least once.

## Cross-harness equivalents
| Harness | How to install |
|---|---|
| Claude Code | `hooks` block in settings (`PreToolUse`/`PostToolUse` + `matcher` tool name, e.g. Bash, Write, Edit) |
| Antigravity CLI (`agy`) | named hook in `~/.gemini/config/hooks.json` (or `<project>/.agents/hooks.json`): `{"<name>": {"PreToolUse": [{"type": "command", "command": "...", "timeout": 10}]}}`; also `PostToolUse`, `PreInvocation` |
| Codex, opencode, others | use the hook/plugin feature if present; otherwise a wrapper |
| No hooks at all | shell wrappers (alias or PATH shim for `git`, `rm`, deploy commands that check patterns then `exec` the real one), git hooks (`pre-commit`, `pre-push` rejecting force push and secrets), read-only permissions on `<PROTECTED_PATHS>`, a separate OS user without write access |

One logic script, many thin adapters: keep the logic in `<HOOK_DIR>` and have each harness call it, so rules do not fork.

## Fixed rules
- Never disable, edit or work around a hook to finish a task; if a hook blocks a legitimate action, report to the user and ask permission or use `<APPROVED_ROUTE>`.
- Hook scripts are security code: version-controlled, reviewed and tested before enabling.
- Hooks do not replace text rules; write both, with the hook as enforcer.
- Secret guards and credential sandboxes: `credential-broker`; auditing patterns that slip through: `security-audit-cycle`; official production change routes: `safe-hotfix`, `release-deploy`.

## Report
Short: which guards were installed or changed, the three-class test results (blocked/allowed/malformed), and remaining limits (actions not yet guarded).
