---
name: task-delegation
description: Use in any project, with any model or agent harness, whenever a session holds more than one job or context (several unrelated requests, a side request while another task runs, alerts arriving mid-task), or one job heavy enough to hand off. Routes each job by complexity - inline, or a background sub-agent on a model tier matched to its weight - runs independent jobs in parallel, and keeps them watched with a heartbeat.
---

# Task delegation by complexity

Different jobs in one session must not wait on each other. Rate each job's weight, then do it inline or hand it to a sub-agent on a matching model tier. Works with any model and any agent harness. Project rules (AGENTS.md, CLAUDE.md, GEMINI.md, project skills) win on project-specific matters such as who may push or deploy.

## When to use
- The session holds several jobs or contexts (multiple requests, a side request, an alert or notification arriving mid-task).
- One job is heavy enough that handing it off protects the main context.
- Skip when there is exactly one non-heavy job: do it inline. Delegation is a means (parallelism, context hygiene), not a goal.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<MODEL_LIST>` | models actually available in the harness | model menu, `--model` help, config |
| `<ISOLATION_CMD>` | how to get an isolated repo copy | `git worktree add`, temporary clone |
| `<STATUS_DOC>` | project status/changelog the main agent owns | see `living-docs` |
| `<RELEASE_OWNER>` | who may push and deploy | the main agent only |

## Neutral terms
| Term | Meaning | Examples |
|---|---|---|
| **sub-agent** | separate agent with its own context running one job | Claude Code `Agent`; opencode `task`; Codex, Gemini CLI or others: a subagent if available, else a second CLI process in the background (`<cli> -p "<brief>" > out.log &`) |
| **background** | runs without blocking the main agent | `run_in_background`, `&` plus a log file, tmux/screen |
| **heartbeat** | periodic status check of running jobs | monitor, schedule or cron, or a `sleep 90` loop printing the last log line |
| **follow-up message** | add instructions to a live sub-agent | `SendMessage`, resume the CLI session, an inbox file the sub-agent reads |
| **isolation** | separate repo copy so parallel edits do not collide | git worktree, temporary clone |

## Steps
### 1. Split the session into jobs
At each new request, and whenever new context arrives, list the jobs in play. One job = one goal with a self-checkable result.
- **Independent** (different files, services, sites, hosts; neither needs the other's result): may run in parallel.
- **Dependent** or touching the same files/config: run in sequence.

### 2. Rate complexity, pick a tier
| Class | Traits | Examples | How | Tier | Effort |
|---|---|---|---|---|---|
| **Trivial** | 1-3 commands, direct answer, or waiting on one step | status check, one small edit, run an existing script | inline | - | - |
| **Light** | read a few files, write notes or a summary, no technical decision | write notes, summarize logs, list versions | sub-agent if other work is running, else inline | **T1 fast** | low-medium |
| **Medium** | fix 1-3 files, triage logs, tests, verification | small bug plus test, verify a release, config audit | sub-agent | **T2 balanced** | medium |
| **Heavy** | cross-module, design, migration, incident, many risky steps | new feature, migration, cross-service bug, outage | sub-agent | **T3 frontier** | medium, raise for hard design |

- Unsure between two classes: pick the heavier. A sub-agent that fails because the job was heavier: retry one tier up with a better brief.
- A half-finished job with context that is hard to transfer: finish it inline.

### 3. Map tiers to models
Model names change fast. At session start read `<MODEL_LIST>` and place each vendor's models by position in its line: **T1** = cheapest/fastest (lite, flash, mini, nano, haiku, small, turbo), **T2** = mid or daily default (pro, plus, sonnet, standard), **T3** = strongest available (flagship, opus, ultra, max, top reasoning).

| Vendor | T1 fast | T2 balanced | T3 frontier |
|---|---|---|---|
| Anthropic Claude | Haiku | Sonnet | Opus / newest flagship |
| Google Gemini | Flash-Lite / Flash | Flash (thinking) or Pro | top Pro / Deep Think |
| OpenAI GPT | mini / nano | standard model | top reasoning model |
| DeepSeek | chat (non-reasoning) | latest chat | reasoner |
| Qwen | Turbo / Flash / small | Plus | Max / largest Coder |
| Moonshot Kimi | small / turbo | standard K-series | largest thinking K-series |
| Others (GLM, Mistral, Llama, Grok) | small variant | mid variant | largest variant |

New or code-named models: place by the vendor's own description (flagship = T3, default = T2, cheap/fast = T1). Unsure: T2 for medium, T3 for heavy. Single-model harness: ignore tiers but keep job splitting, parallelism and heartbeat. Mixed-vendor harness: any vendor may fill a tier if cheaper or better suited.

### 4. Spawn
- Launch all independent sub-agents at once (one message with several calls, or several background processes), each on its tier.
- Repo-changing jobs get isolation (`<ISOLATION_CMD>`). The sub-agent commits on its own branch without pushing and reports the SHA; the main agent integrates, pushes, deploys.
- Ops-only jobs (servers, DBs, services, cloud dashboards) need no repo isolation. Sub-agents do not commit, push, or write `<STATUS_DOC>`.
- The brief must be self-contained (sub-agents do not see the conversation): goal and definition of done; verified facts (IDs, paths, decisions); binding rules as links to project rule files, not copies; limits (production, credentials, destructive actions, time windows); where to put scratch scripts; "stop after 3 failures on the same step and report"; report format (result, evidence, SHA, leftovers, decisions needed).
- Background CLI processes: one log file per job, record the PID, wrap in `timeout` to avoid orphans.

### 5. Watch (mandatory)
- Start a heartbeat every 60-120 s: per job, print the last log line and idle time (output file mtime). Do not read full sub-agent transcripts.
- Silent over 3 minutes without a visible reason: inspect the process and log, report to the user. Stuck: stop it, then do the job inline or retry with a better brief.
- Re-arm the heartbeat whenever it expires while sub-agents still run. Never guess the result of an unfinished sub-agent.

### 6. Main agent role
- Keeps: talking to the user, user decisions, incoming alerts, commit/push/deploy per `<RELEASE_OWNER>`, `<STATUS_DOC>`.
- New context mid-session: rate it. Trivial: inline. Medium/heavy and independent: new sub-agent. Related to a delegated job: send a follow-up message to that sub-agent, do not duplicate the work.
- Verify sub-agent results yourself (tests, typecheck, live check) before claiming done. A sub-agent's claim is not evidence (`definition-of-done`).
- No sub-agent support at all: still split and rate, work sequentially starting with the biggest blocker, run long processes in the background with output to files, and check them periodically.

## Fixed rules
- Ambiguity goes to the heavier class; failure goes one tier up.
- Never run dependent jobs in parallel or let two agents edit the same files.
- Sub-agents inherit safety rules (no secrets in briefs, no production changes unless the brief allows them).

## Report
One summary per job: done / running / needs a decision, with evidence for the done ones.
