# Error runbook

Every error that was understood, with its fix. Search this file first (`grep -n -i "<exact text>"`) before analysing an error again.

## A. Errors users see
Messages the app shows to its users (form errors, dialogs, deploy or build messages).

| Code | Trigger | Message shown | Fix for the user |
|---|---|---|---|
| `<CODE>` | <when it happens> | <exact text> | <what the user should do> |

## B. Errors in the app, server, build or tools

### B-1 <exact error text that can be grepped>
- **Side:** user | app | server | build | agent tooling
- **Root cause:** <one or two lines>
- **Fix:** <files, command or commit>
- **Status:** fixed in <version/commit> | workaround | open
- **Checkpoint:** #<n>
