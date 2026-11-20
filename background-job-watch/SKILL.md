---
name: background-job-watch
description: Use whenever an agent starts or depends on something that keeps running - a background shell, long build/test/install, dev server, sub-agent, log tail or monitor - or when the user asks "check the shell", "is it still running", "why is it stuck", "monitor this", "re-arm the monitor", "cek shell", "pantau proses", "masih jalan?", or the host load spikes after a command. Starts long work bounded (timeout, own log, PID), checks it on a 60-120 s heartbeat, flags stalls over 3 minutes, re-arms expired monitors, and cleans up orphans so nothing keeps eating CPU after the session.
---

# Background job watch

Origin: a long-running agent session on a small shared server where expired monitors left `tail`/`node` processes behind, a whole-disk `find` ran orphaned for ten minutes, and a CLI test run started MCP servers that pushed the host into a load alarm. Model-agnostic and harness-agnostic; neutral terms (sub-agent, background, heartbeat, monitor) follow `task-delegation`.

## When to use / not
- Use when: starting anything that may run longer than about 30 s; a background shell, monitor or sub-agent is active; the user asks whether something is still running or why it hangs; a monitor expired or exited; host load or temperature alarms appear after your own commands.
- Not for: watching production application logs and triaging their errors (`prod-log-watch`); splitting work across sub-agents (`task-delegation`, which uses this skill for its heartbeat); moving heavy work to another machine (`remote-offload`).

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<SCRATCH_DIR>` | where job logs and helper scripts go | session tmp folder, `./.tmp/jobs` |
| `<MONITOR_TTL>` | max lifetime of one monitor process, a little under the harness monitor limit | `1790` s for a 30 min limit |
| `<HEARTBEAT>` | check interval | 60-120 s |
| `<STALL_AFTER>` | silence that counts as a stall | 3 min |
| `<LOAD_LIMIT>` | host load or temperature that means stop adding work | load1 > cores x 2, or a guard's threshold |
| `<PROTECTED_PROCS>` | processes never to kill | init, sshd, database, web server master, other users' jobs |
| `<PS_CMD>` | process listing that works on this host | `ps -eo pid,ppid,etime,pcpu,args`; BusyBox: `/bin/ps` or `ps w`; Windows: `Get-Process`, `tasklist` |

## Steps

### 1. Start bounded
- Every long command gets: `timeout <seconds>` (or the harness's own timeout), output to one log file in `<SCRATCH_DIR>` per job, and its PID recorded. Example: `timeout 900 npm test > <SCRATCH_DIR>/test.log 2>&1 & echo $! > <SCRATCH_DIR>/test.pid`.
- Never start an unbounded search over a whole filesystem (`find /`, recursive grep from root). Narrow the path, add `-maxdepth`, and a timeout.
- Before running a CLI or tool you have not run here before, check what it spawns (config of MCP servers, plugins, watchers, dev servers). Start it with a timeout and check for leftover children afterwards (step 4).
- Check host load first when the machine is small or shared; above `<LOAD_LIMIT>`, queue the job or offload it (`remote-offload`).

### 2. Monitors
- A monitor is a long command whose output lines become notifications (log tail, poll loop). Wrap it in `timeout <MONITOR_TTL>` so it dies before the harness limit; an expired harness monitor often leaves its children running.
- Filter to lines you would act on, flush per line (`grep --line-buffered`), and match failure states as well as success; silence must not look like success.
- On expiry or exit (for example exit 143 = SIGTERM, 124 = timeout), re-arm it if the watch is still needed, with the same command, and say so in one line. If it keeps dying within minutes, find what kills it (a load guard, a log rotation, a cron cleanup) before re-arming again.
- Keep exactly one copy of each monitor. Before re-arming, make sure the old process is gone.

### 3. Heartbeat
- Every `<HEARTBEAT>`, for each running job: is the PID alive, last log line, idle time (log mtime vs now), elapsed time. Read the tail of the log, never the whole file.
- Silent longer than `<STALL_AFTER>` with no visible reason: inspect the process (CPU, children, open files), tell the user what it is doing or that it hangs.
- Stuck: stop it (TERM, then KILL after a few seconds), keep the log, then retry with a fix or do the work another way. Three failures on the same step: stop and report (`definition-of-done`).
- Never report the result of a job that has not finished; say "still running" with the last line instead.

### 4. Clean up
- When a job ends, times out or is cancelled: check for children and orphans it left (`<PS_CMD>`, look for parent PID 1 or the command name). Kill only your own leftovers; never `<PROTECTED_PROCS>` or other users' processes.
- After a load or temperature alarm, list the top CPU processes first. If your own commands are among them, stop them and say so; if not, report what is there.
- Remove temp files of finished jobs unless they are evidence for a report.

### 5. Record
- A job that failed, hung, or overloaded the host is an incident: record its signature, cause and fix through `error-runbook` (part C for agent and tooling errors) so the next session avoids it.

## Fixed rules
- No unbounded background process: every one has a timeout, a log and a known PID.
- One copy per monitor; re-arm on expiry while the watch is still needed.
- Stalls over `<STALL_AFTER>` are reported, not waited out silently.
- Clean up your own orphans before saying a task is done.
- Never kill processes you did not start unless the user asks.

## Report
One line per job, result first: `done (exit 0, 2m10s)`, `running 4m, last line: ...`, `stuck 5m on ..., stopped`, `monitor re-armed (expired)`. Mention any orphans removed and any load alarm your commands caused.
