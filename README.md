# Nouvem agent skills

A model-agnostic, harness-agnostic pack of engineering skills for coding agents (Claude Code, Codex CLI, Antigravity CLI, opencode, and anything that reads `AGENTS.md`). Each skill is a plain Markdown playbook (`SKILL.md`) distilled from workflows that run in production: building and changing projects, analysing problems, releasing and hot-fixing safely, watching production logs, security audits, credential handling and more.

You never need a slash command. A small router reads every prompt and tells the agent which skill fits, from words, whole sentences and project context, in any language (English and Indonesian are covered by every skill; several also carry Spanish and French phrases).

```text
you:   bikin web portofolio pakai next
agent: (router) build-project matches -> reads build-project/SKILL.md, then starts
```

## The problem this solves

Coding agents are strong at writing code and weak at *process*. Left alone they:

- skip the boring steps that prevent outages: no rollback plan, no health check after a deploy, no test before "done", reloading a web server in the middle of the day;
- re-learn the same lesson every session, because the fix for last week's error lives in nobody's context;
- print or ask for secrets, touch production directly, or "fix" while you only asked them to look;
- answer a mixed request ("build X, then audit it, then ship it") as one blob instead of a sequence of checked steps.

Skills are the usual answer: short playbooks the agent reads before acting. But skills only help if they are *loaded*, and in practice they are not. Most harnesses expect the user to type a slash command or hope the model notices a matching description among dozens. People forget the command; models skip the description. A skill that is not loaded at the moment of need is the same as no skill.

This pack attacks both halves: playbooks that encode the process, and a router that loads the right one from the words of the request, with no command to remember.

## Why use it

| | |
|---|---|
| **No slash commands** | Type the request the way you would say it, in English or Indonesian (some skills also know Spanish and French). The router picks the skill; slash aliases still work if you like them. |
| **Any harness, any model** | One pack for Claude Code, Codex CLI, Antigravity CLI and opencode. Skills are plain Markdown, the router is a single Node file. Nothing is tied to one vendor or model. |
| **Cheap on context** | Only the names of up to 3 matching skills and why they matched are injected (about 0.8–1.4 KB per prompt), never the 137 KB of playbooks. The agent opens the one `SKILL.md` it needs. Small talk injects nothing. |
| **Zero dependencies, fast** | No npm install, no network, no model call. Routing takes ~1.4 ms; the whole hook ~165 ms including Node start-up. |
| **Safe to install and remove** | Idempotent installer that backs up every file it edits, validates JSON, never replaces a hook it did not create, and an uninstaller that removes exactly what it added. Errors in the router never block a prompt. |
| **Your rules win** | Every injection reminds the agent that the project's own `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` and same-purpose project skills take precedence. Skills hold placeholders (`<DEPLOY_CMD>`, `<APPROVAL_WORD>`) that the project fills in once. |
| **Not just ops** | Covers the whole loop: build a new project (portfolio, landing page, CMS/blog, SaaS, admin panel, e-commerce, API, internal tool), run it locally, change it, analyse problems, then ship, watch and harden it. |
| **Measured, not claimed** | Routing quality is benchmarked on labelled prompts, including sets written blind by someone who never saw the triggers. The numbers, good and bad, are below and reproducible with one command. |

## Install

Requirements: Node.js 18 or newer and git. No other dependencies. Works on Linux, macOS and Windows.

**Linux / macOS** (also WSL, BusyBox and Git Bash on Windows):

```sh
git clone https://github.com/BBguss/nouvem-agent-skills ~/agent-skills && sh ~/agent-skills/install.sh
```

**Windows, PowerShell:**

```powershell
git clone https://github.com/BBguss/nouvem-agent-skills "$HOME\agent-skills"; & "$HOME\agent-skills\install.ps1"
```

If PowerShell blocks scripts, run `node "$HOME\agent-skills\install.mjs"` instead (same options), or `powershell -ExecutionPolicy Bypass -File "$HOME\agent-skills\install.ps1"`.

**Windows, Command Prompt:**

```bat
git clone https://github.com/BBguss/nouvem-agent-skills "%USERPROFILE%\agent-skills" && "%USERPROFILE%\agent-skills\install.cmd"
```

All four entry points (`install.sh`, `install.ps1`, `install.cmd`, `node install.mjs`) run the same Node installer and take the same options. On Windows the skills are linked with directory junctions, so no administrator rights or Developer Mode are needed. To update later: `git pull` in the pack folder and run the installer again.

| Option | Effect |
|---|---|
| `--dry-run` | Print what would change, change nothing |
| `--harness claude,codex` | Only these harnesses (`claude`, `agents`, `codex`, `antigravity`, `opencode`; `gemini` and `agy` also mean `antigravity`) |
| `--no-hooks` | Link skills and write instruction blocks, but register no hook or plugin |
| `--links-only` | Only link skills (what `link-all.sh` does) |
| `--project DIR` | Install into one project instead of your home: `DIR/.claude/settings.json` hook, `DIR/.agents/hooks.json` (Antigravity) and a managed block in `DIR/AGENTS.md` |
| `--uninstall` | Same as `sh uninstall.sh`; on Windows `install.ps1 --uninstall` or `install.cmd --uninstall` |

The installer is idempotent: run it again after pulling updates or adding a skill. It never deletes a real folder, never replaces a hook it did not create, backs up every file it edits (`<file>.bak-<timestamp>`) and validates JSON before and after writing. `uninstall.sh` removes exactly what was installed: links pointing into the pack, hook entries that run this pack's router, the opencode plugin file and the managed blocks.

What it does per harness:

| Harness | Skills linked into | Automatic activation |
|---|---|---|
| Claude Code | `~/.claude/skills` | `UserPromptSubmit` hook in `~/.claude/settings.json` (appended next to your existing hooks) |
| Codex CLI | `~/.codex/skills` | `UserPromptSubmit` hook in `~/.codex/hooks.json` (approve it once in Codex), plus a managed block in `~/.codex/AGENTS.md` |
| Antigravity CLI (`agy`) | `~/.gemini/config/skills` | `PreInvocation` hook named `skill-pack-router` in `~/.gemini/config/hooks.json`, next to your other named hooks. It injects the note once per user turn as a system message. With `--no-hooks`: an always-on rule in `~/.gemini/config/rules/skill-pack.md`. Leftovers of the older Gemini CLI setup (`~/.gemini/skills` links, `BeforeAgent` hook, `GEMINI.md` block) are removed |
| opencode | `~/.config/opencode/skills` | `chat.message` plugin in `~/.config/opencode/plugins/skill-pack-router.js` when `@opencode-ai/plugin` is present, plus a managed block in `~/.config/opencode/AGENTS.md` |
| Shared `~/.agents` | `~/.agents/skills` | used by tools that read the shared agents directory |

Managed blocks sit between `<!-- skill-pack:begin -->` and `<!-- skill-pack:end -->`; everything outside them is yours and is never touched.

## How auto-triggering works

1. **Triggers.** Each skill folder has a `triggers.json` (see [Writing a skill](#writing-a-skill)). Skills without one fall back to quoted phrases and terms from their `description`.
2. **Router.** `hooks/skill-router.mjs` (zero dependencies) receives the prompt from the harness hook and scores every skill:
   - keyword or phrase hit (Unicode-aware whole words, so `deploy` does not fire on `redeployment`, and `sub agent` also matches `subagent`),
   - regex pattern hit (weighted higher; for sentences such as "why does X fail", "kenapa ... error"),
   - exact slash alias (`/deploy`, `/off-sec`) when someone still types one,
   - files present in the working directory (only add weight when the text already matched),
   - `negative` regexes suppress a skill (for example local setup is suppressed when the prompt is about production),
   - `priority` breaks ties; priority 0 marks a fallback skill such as `dynamic-workflow`,
   - lexical similarity (`hooks/lexical.mjs`): BM25 between the prompt and each skill's description, "When to use" section and keywords, after mapping common Indonesian and inflected words to one English term (`bikin` → build, `lemot` → slow, `rilis` → release). This catches paraphrases that no keyword lists; it adds at most 4 points, so it can confirm or rank a skill but rarely fires one alone.
3. **Output.** Up to three skills above the threshold are injected as extra context: skill name, why it matched, path to its `SKILL.md`, and the reminder that project instructions (`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`) and project-level skills with the same purpose take precedence. When two or more skills match strongly, `dynamic-workflow` is added to sequence them. Nothing is printed when nothing fits.
4. **Safety.** The router never blocks or fails a prompt: every error ends in exit 0 with no output. Parsed triggers are cached in `$XDG_CACHE_HOME/skill-pack/` (or `~/.cache/skill-pack/`) and rebuilt automatically when any `SKILL.md` or `triggers.json` changes. A hook run takes about 165 ms median on a low-power NAS CPU, half of it Node start-up (see [Effectiveness](#how-effective-is-it)).
5. **Harnesses without a prompt hook** get the managed block instead: a compact trigger-to-skill table generated from `triggers.json` that tells the agent to load the matching `SKILL.md` without being asked.

Debug and control:

```sh
node hooks/skill-router.mjs --explain "kenapa build saya error"   # scores and the exact injected text
echo '{"prompt":"deploy ke production","cwd":"."}' | node hooks/skill-router.mjs
SKILL_ROUTER_DEBUG=1 ...      # scores on stderr during real sessions
SKILL_ROUTER_DISABLE=1 ...    # turn the router off for one session
node hooks/skill-router.mjs --table     # the table used in managed blocks
```

The router accepts the payload shapes of Claude Code and Codex (`prompt`), Antigravity CLI `PreInvocation` (`lastUserInput` and `workspacePaths`, answered with `injectSteps` and deduplicated per turn), and generic `user_prompt`, `input`, `message`, `messages[]` or plain text on stdin.

## How effective is it?

All numbers below were measured on this repo, on a low-power NAS CPU (Node 22). Reproduce them with `node eval/run.mjs <file>` (add `--verbose` to see every miss).

**Routing quality.** A prompt counts as correct when the router's first suggestion is one of the skills a human labelled acceptable. "Quiet" is the share of small-talk and general-knowledge prompts ("what is a closure?", "jelasin apa itu docker", "thanks!") where the router injects nothing.

| Prompt set | Who wrote it | Prompts | Top-1 | Top-3 | Quiet on small talk | Wrong extra suggestions per prompt |
|---|---|---|---|---|---|---|
| `eval/prompts.json` | the author, then used to tune triggers | 85 (77 task, 8 small talk) | 100% | 100% | 100% | 0.17 |
| `eval/holdout.json` | written blind from skill names only; used once to calibrate the lexical layer | 80 (66 / 14) | 81.8% | 93.9% | 92.9% | 0.73 |
| **`eval/holdout2.json`** | **written blind afterwards, run once, never tuned on** | **90 (72 / 18)** | **87.5%** | **91.7%** | **100%** | **0.50** |

The last row is the honest number: about **7 in 8 real requests get the right skill first, 11 in 12 get it among the suggestions, and small talk stays silent**. The first row is optimistic by construction.

What each layer contributed, on the same blind sets:

| Router version | holdout top-1 | holdout2 top-1 |
|---|---|---|
| keywords and patterns, tuned on the dev set | 59.1% | 72.2% |
| + BM25 lexical similarity with ID/EN synonyms (current) | 81.8% | 87.5% |

Tuning keywords on a dev set mostly fits that set (98.7% there, 59.1% on the first blind set). The lexical layer is what generalises to phrasing nobody listed.

**Cost.**

| Measurement | Result |
|---|---|
| Routing a prompt (in process) | 1.4 ms median, 2.2 ms p95 |
| Whole hook per prompt (spawn Node, load cached index, route) | 165 ms median, 241 ms p95; bare `node -e 0` is 83 ms on the same CPU |
| Context injected per prompt | 0 bytes for small talk, 0.8–1.4 KB when skills match |
| All 23 playbooks if you pasted them into context instead | 137 KB (`SKILL.md` files only) |
| Runtime dependencies | none |
| Tests | 48 router + 8 installer tests pass |

**Field results.** The playbooks were distilled from the day-to-day workflows of a production hosting-control-panel SaaS, run by coding agents across more than 1,300 logged work checkpoints. Examples of what following them produced there:

- `release-deploy`: every release passes a remote test gate first; the latest ran 3,173 tests with 0 failures before going live.
- `web-quality-audit`: one before/after pass on the app took Lighthouse mobile performance from 60 to 81, accessibility 95 → 100, SEO 92 → 100, desktop performance 93 → 99, and cut first-load JavaScript from 982 KB to 505 KB gzipped. The marketing site went to SEO 100 and mobile performance 72 → 83.
- `error-runbook` + `prod-log-watch`: production errors are looked up in a runbook before anyone debugs, and every new fix is written back, so the same error is solved once.

These are results of one team's workflows, not a controlled study of the pack.

## Does it solve the problem?

**Mostly, yes, for the part that was broken: getting the right playbook in front of the agent without a command.** On prompts written by someone who never saw the triggers, the right skill is first 87.5% of the time and in the list 91.7% of the time, small talk is left alone, and the cost is a fraction of a second and about a kilobyte of context. Once the playbook is loaded, the agent follows a process (evidence before "done", rollback before deploy, runbook before debugging, ask before fixing in read-only mode) instead of improvising one.

What it does **not** solve, plainly:

- **It is lexical, not semantic.** About 1 request in 8 still routes wrong or not at all. The misses are mostly vague or meta requests ("not sure what kind of task this is, handle it"), requests whose key idea is a concept rather than a word (switching a primary database "without taking sites down" should hit maintenance windows), and dependency bumps. A wrong pick costs little because the agent reads the description and can ignore it, but it is not perfect.
- **Suggestions are not enforcement.** The router tells the agent which playbook applies; a model can still ignore it. Hard limits (never touch production paths, never reload a web server by hand) belong in hooks, see `agent-safety-hooks`.
- **Harness support differs.** Claude Code and Antigravity CLI run the hook directly; Codex CLI needs you to approve the hook once; opencode uses a plugin that has been tested offline only; harnesses without hooks get a static trigger table in their instructions file, which works only as well as the model reads it.
- **Languages.** English and Indonesian are covered well; Spanish and French only for a few skills. Other languages fall back to the English terms in your prompt.
- **The playbooks need your values.** Commands, approval words and paths are placeholders the project fills in once; until then the agent asks.

## Skill index

<!-- skill-index:begin -->
23 skills. Generated by `node scripts/gen-index.mjs` from each SKILL.md; do not edit by hand.

### Build & develop

| Skill | Use it when | Aliases |
|---|---|---|
| [`agent-tool-parity`](agent-tool-parity/SKILL.md) | Adding or changing a user-facing route, endpoint or feature in an app that also exposes an AI-agent interface (MCP server, tool or function-calling API), or when... | `/tool-parity` |
| [`build-project`](build-project/SKILL.md) | The user wants to build a new project or app from an idea - "build me a portfolio", "create a SaaS", "make a blog/CMS", "admin dashboard", "online shop",... | `/build` `/new-project` `/scaffold` |
| [`code-change`](code-change/SKILL.md) | Making a small or medium change in an existing codebase of any stack - add a field, endpoint, page, component, option or validation, rename or extract something,... | `/change` `/feature` `/refactor` |
| [`local-dev-setup`](local-dev-setup/SKILL.md) | The user wants to run a repo locally or fix a broken local environment - "run this locally", "set up dev environment", "it won't start", "port already in use", "npm... | `/local` `/dev-setup` `/run-local` |
| [`plan-then-code`](plan-then-code/SKILL.md) | A non-trivial change needs mapping before implementation (/plan), when executing an approved plan or implementing a feature or fix cleanly (/code), or when asked to... | `/plan` `/code` |

### Analyze & plan

| Skill | Use it when | Aliases |
|---|---|---|
| [`analyze-problem`](analyze-problem/SKILL.md) | The user asks why something happens or wants a problem understood before fixing - a bug, slow page or query, failing build or test, flaky behavior, unexpected output,... | `/analyze` `/analyse` `/investigate` `/rca` `/why` |
| [`error-runbook`](error-runbook/SKILL.md) | The user says "analyse error" / "analisis error", pastes an error message, stack trace, log line or failed deploy output, or asks why something failed in production... | `/error` |
| [`external-project-scope`](external-project-scope/SKILL.md) | The user asks to work on a path, repo, sibling project or system outside the current project ("out of scope", "project lain", "folder di luar", external repo, another... | `/outofscope` `/ofs` |
| [`mode-gates`](mode-gates/SKILL.md) | A user message mixes mode signals (a read-only word such as "analyse" or "find out" plus a command like /code), when a slash command like /plan, /code, /ask or... | `/plan` `/code` `/ask` `/deploy` |

### Orchestration

| Skill | Use it when | Aliases |
|---|---|---|
| [`definition-of-done`](definition-of-done/SKILL.md) | About to claim any task finished, fixed, passing, or ready (bug fix, feature, refactor, config change, UI change), when starting a bug or feature that may touch... | `/dod` |
| [`dynamic-workflow`](dynamic-workflow/SKILL.md) | The start of any request that is not clearly covered by one other skill, or that mixes several intents - build, change, fix, analyze, ship, operate, audit, migrate,... | `/workflow` `/do` `/route` `/auto` |
| [`living-docs`](living-docs/SKILL.md) | Finishing a unit of work that needs a changelog/checkpoint entry, when a new decision or finding must be routed to the right doc (rules, architecture, knowledge,... | `/docs` |
| [`task-delegation`](task-delegation/SKILL.md) | Any project, with any model or agent harness, whenever a session holds more than one job or context (several unrelated requests, a side request while another task... | `/delegate` |

### Ship & operate

| Skill | Use it when | Aliases |
|---|---|---|
| [`maintenance-window-ops`](maintenance-window-ops/SKILL.md) | A production change could take sites or services down - web server or proxy restart that drops connections, node or service restart, reboot, storage remount, database... | `/maintenance` |
| [`prod-log-watch`](prod-log-watch/SKILL.md) | Watching production logs, when a monitor/alert line, 5xx burst, health-check DOWN or stack trace from prod arrives, or when asked to "watch prod", "monitor the logs",... | `/watch-prod` `/prod-watch` |
| [`release-deploy`](release-deploy/SKILL.md) | Asked to deploy, release, "push to production" or "go live", or when a fix cannot be a hotfix (frontend, new dependencies, schema migration) | `/deploy` `/release` |
| [`remote-offload`](remote-offload/SKILL.md) | Tests, builds, linters or other CPU/RAM-heavy commands would overload the main or storage host (slow machine, load guard triggering, long suites, "run tests on the... | `/offload` |
| [`safe-hotfix`](safe-hotfix/SKILL.md) | A small, already-tested backend fix must reach production now without a full release - "hotfix prod", "ship this fix", "copy the changed files to prod", "patch... | `/hotfix` |
| [`zero-downtime-migration`](zero-downtime-migration/SKILL.md) | The user asks to migrate or move an app or website from an old host, folder, vhost or process manager into a new place (hosting panel, tenant account, new server, new... | `/migrate-site` |

### Security & agent safety

| Skill | Use it when | Aliases |
|---|---|---|
| [`agent-safety-hooks`](agent-safety-hooks/SKILL.md) | Setting up, testing or debugging lifecycle guards (hooks) for a coding agent - blocking writes or commands that touch protected production paths or dangerous commands... | `/hooks` `/safety-hooks` |
| [`credential-broker`](credential-broker/SKILL.md) | An agent needs a password, token, SSH or database credential, must run a command that needs sudo or a secret, or must add, rotate or audit stored credentials | `/creds` |
| [`security-audit-cycle`](security-audit-cycle/SKILL.md) | The user asks to check security, find bugs, review code or pasted snippets (quick audit), or runs a formal offensive audit (off-sec / red team / OWASP / pentest) and... | `/off-sec` `/def-sec` `/audit` |

### Web quality

| Skill | Use it when | Aliases |
|---|---|---|
| [`web-quality-audit`](web-quality-audit/SKILL.md) | Asked to improve or audit a website's quality - portfolio, landing page, blog/CMS, e-commerce page, SaaS app or dashboard - covering Lighthouse scores, Core Web... | `/seo` `/web-audit` |
<!-- skill-index:end -->

## Writing a skill

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `<skill-name>/SKILL.md` (kebab-case folder, same `name` in the frontmatter).
2. Write the `description` as "Use when ..." with concrete triggers: situations, the user's words, symptoms. It is what agents and the fallback router read.
3. Add `<skill-name>/triggers.json`:

```json
{
  "keywords": ["deploy", "go live", "rilis ke produksi"],
  "patterns": ["\\b(deploy|release|rilis)\\b.{0,20}\\b(prod|production|produksi)\\b"],
  "files": ["Dockerfile", "vercel.json"],
  "negative": ["\\b(do not|jangan) deploy\\b"],
  "slash": ["/deploy"],
  "priority": 1
}
```

| Field | Meaning |
|---|---|
| `keywords` | Case-insensitive whole words or phrases, any language. Score 2 each (+0.5 per extra word), capped. |
| `patterns` | JavaScript regexes, case-insensitive. Score 3 each, capped. Use them for sentence shapes. |
| `files` | File names in the working directory that make the skill more likely. Only add weight after a text hit. |
| `negative` | Regexes that suppress the skill entirely. |
| `slash` | Aliases matched exactly (`/deploy`). Optional: nobody has to type them. |
| `priority` | Tie-break; `0` marks a fallback skill used only when nothing specific matches or as the multi-skill coordinator. |

4. Check it: `node hooks/skill-router.mjs --explain "<a few real prompts>"`, then `node --test tests/*.test.mjs`.
5. Regenerate the index: `node scripts/gen-index.mjs`, and rerun the installer to link the new skill.

## Adapting skills to a project

Skills never hard-code paths, commands or approval words. Each `SKILL.md` has a **Project adaptation** table of placeholders that the project defines once in its own instructions file (`AGENTS.md`, `CLAUDE.md` or `GEMINI.md`) or rules folder. The agent reads the values from there and asks only when one is missing. Example for `release-deploy`:

| Placeholder | Meaning | Example |
|---|---|---|
| `<DEPLOY_CMD>` | one command doing build, sync, reload, purge | `scripts/deploy.sh`, `vercel --prod`, `fly deploy` |
| `<ROLLBACK_CMD>` | return to the previous release | `vercel rollback`, `kubectl rollout undo` |
| `<APPROVAL_WORD>` | exact word the user must type before a big deploy | `Deploy` |
| `<PROCESS_STATUS_CMD>` | production process status | `pm2 list`, `systemctl status app`, `kubectl get pods` |

A project section might look like this:

```markdown
## Skill adaptation
- release-deploy: DEPLOY_CMD=`npm run deploy`, ROLLBACK_CMD=`npm run deploy -- --rollback`, APPROVAL_WORD=`Deploy`
- error-runbook: RUNBOOK_FILE=`docs/runbook.md`, CHANGELOG_FILE=`CHANGELOG.md`
- credential-broker: CRED_HELPER=`pass`, never paste secrets in chat
```

Project rules always win over a skill. If a project ships its own skill for the same job, the agent uses the project's skill.

## Tests

```sh
node --test tests/*.test.mjs                   # router (fixture pack + real pack when triggers exist) and installer
TEST_SH=/bin/ash node --test tests/*.test.mjs  # run the installer tests under another POSIX shell
node scripts/gen-index.mjs --check   # README index in sync
node eval/run.mjs eval/holdout2.json --verbose   # routing benchmark, prints every miss
```

When you change triggers, tune on `eval/prompts.json` only and report the holdout sets untouched; add a fresh blind set when the old ones have been looked at too often.

## License

[MIT](LICENSE) © Nouvem. Contributions welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).
