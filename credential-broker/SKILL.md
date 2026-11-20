---
name: credential-broker
description: Use when an agent needs a password, token, SSH or database credential, must run a command that needs sudo or a secret, or must add, rotate or audit stored credentials. Never print, paste, ask for, or write secrets in chat, docs, code or command lines; inject them into a child process through a credential helper instead.
---

# Credential broker: secrets never pass through chat

Applies to every project that touches a secret: API keys for a SaaS or CMS, database passwords, SSH keys, PaaS deploy tokens (Vercel/Netlify/Fly), app-store or registry tokens, `.env` values on a local dev machine. The principle is the same everywhere: the agent uses a secret without ever seeing or writing it.

## When to use
- Any command needs a password, token, API key, SSH/DB credential, or `sudo`.
- Adding, rotating or auditing credential entries.
- Skip for non-secret data (hostnames, public usernames); those may live in project docs.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<CRED_TOOL>` | credential-manager CLI | encrypted local helper, vault CLI, `pass`, OS keychain wrapper, `op` (1Password), a PaaS CLI's own login |
| `<CRED_STORE>` | store and audit-log location (permissions 600/700) | the OS user's home folder |
| `<ENTRY_LIST>` | how to list entry names without values | `<CRED_TOOL> list` |
| `<ENV_NAMING>` | env variable pattern for injected values | `<PREFIX>_<ENTRY>_<FIELD>` uppercase |
| `<REMOTE_ACCESS>` | how to use the helper from another machine | `ssh <user>@<host> <CRED_TOOL> ...` |

No helper installed: use the OS keychain, a secrets manager, or a git-ignored `.env` the user fills in by hand, and still read the value only from the environment. For projects with no secrets at all (static site, local-only tool), this skill needs no action beyond the absolute rules.

Entry names and values are not written in this skill; get the list from `<ENTRY_LIST>`.

## Absolute rules
1. **Never** print, paste, guess or infer a secret in chat, docs, code, repo `.env` files, commit messages, logs, or command arguments.
2. **Never ask the user to paste a password.** If an entry is missing, ask the user to add it themselves (see "Adding an entry").
3. **OTP, 2FA, captcha and real passwords are always entered by a human.** The agent stops, asks the user to do it, then continues.
4. Do not read secrets from shell history, other tools' history, old note files, or env dumps. If you happen to see a secret there, do not repeat it; suggest rotation.
5. Command arguments show up in process lists and shell history, so a secret must never be an argument.

## Usage patterns
| Need | How |
|---|---|
| Command/script needs a secret | `<CRED_TOOL> exec <entry> -- <command>`; the value enters the child process as env and is not printed |
| Script reads a secret | read from env (`process.env.X`, `os.environ["X"]`, `"$X"`), not from a file or argument |
| Check a credential exists | print length or status only: `test -n "$X" && echo "ok, len=${#X}"` |
| `sudo` needs a password | pipe via stdin: `<CRED_TOOL> exec <entry> -- sh -c 'printf "%s\n" "$X" \| sudo -S -p "" <command>'` |
| SSH/DB from a script | a client library that reads credentials from env (for example `ssh2`, a DB driver), not `sshpass -p` |
| A single value must be read | `get <entry> <field>` only when `exec` is impossible; never copy the result into the answer |
| See the real value | `--reveal` only when the user explicitly asks |

Safe example (fictional entry name):
```bash
<CRED_TOOL> exec example-server -- sh -c 'test -n "$VAR_PASSWORD" && echo "len=${#VAR_PASSWORD}"'
```
Avoid: `sshpass -p '...'`, `mysql -p<password>`, `curl -H "Authorization: Bearer <literal token>"`, `export X=...` in a recorded session.

## Adding an entry
1. The user (or the agent with the user's permission) runs `<CRED_TOOL> set <entry> <field> --stdin`, sending the value via stdin or a hidden prompt. Avoid a `--value` flag: it lands in shell history.
2. Verify with `<ENTRY_LIST>` (field names only) and one `exec` test that prints the value's length.
3. Project docs record only the entry name and its purpose, never the value.

## Rotating and auditing
- **Rotate the store key**: the `<CRED_TOOL>` rotate command re-encrypts the whole store; run it after a suspected leak or a change of people.
- **Rotate a secret**: change it at the source system (server, DB, provider), then `set` the entry again, then test with `exec`. Revoke the old secret.
- **Audit**: view the recent access log (who, when, what; no values) with the `<CRED_TOOL>` audit command. Unknown secret or odd access: report to the user and rotate.
- **Accidental leak** (printed in chat/log/commit): stop, tell the user, treat the secret as exposed, rotate, and clean up traces that can be cleaned.

## Limits to know
- If the encryption key sits in the same folder as the store, protection is file permissions plus encryption at rest, not isolation from other processes of the same OS user. For stricter access, move the key outside the folder and point to it via a store-location variable.
- A child process's output can still leak a secret if the script prints it (`env`, `set -x`, debug mode). Never run those with secrets injected.

## Fixed rules
- Before writing docs, code or a commit: search the diff for secret patterns (`grep -rEi "(password|secret|token|api_?key)\s*[:=]`), and never commit a `.env` with real values; keep it in `.gitignore`.
- Examples in docs use clear placeholders (`<PASSWORD>`), not strings resembling real secrets.
- Sub-agents inherit these rules: put in the brief that secrets go only through `<CRED_TOOL> exec` (`task-delegation`).
- Hardcoded secrets found in code go to audit (`security-audit-cycle`); command-line guards live in `agent-safety-hooks`.

## Report
Short: which commands ran through the helper, their result (no secret values), and, if a human step is needed (OTP, new entry, rotation), say exactly what the user must do.
