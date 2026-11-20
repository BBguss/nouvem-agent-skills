---
name: idea-shaping
description: Use when an idea, feature or design is still vague and needs shaping before any plan or code - "brainstorm", "I have an idea", "what's the best way to", "which approach", "help me design", "pros and cons", "should I use X or Y", "ide", "enaknya gimana", "bagusnya pakai apa", "rancang fitur", "mau bikin ... tapi bingung". Clarifies goal and constraints one question at a time, offers 2-3 approaches with trade-offs and a recommendation, writes a short approved design brief, then hands off to build-project, plan-then-code or code-change. Writes no code.
---

# Idea shaping: from a vague idea to an approved design brief

Origin: requests that arrive as a half-formed idea ("mau bikin fitur X, enaknya gimana?") where agents jumped straight to a plan or to code and built the wrong thing. Model-agnostic and harness-agnostic; neutral terms follow `task-delegation`.

## When to use / not
- Use: the goal, scope or approach is still open; the user asks for options, a comparison, or "the best way"; a new feature or project whose shape is not decided yet; a non-software idea (an event, a business flow, a document structure) that needs the same treatment.
- Do not use:
  - The design is already clear and only the file map is missing: `plan-then-code`.
  - A small, obvious change: `code-change`.
  - Something is broken and the cause is unknown: `analyze-problem`.
  - The user explicitly says "just build it" / "langsung saja": skip to the next skill and state the assumptions in one line.
- If the harness already has a dedicated brainstorming skill installed (for example a superpowers `brainstorming` skill), use that one instead and treat this file as a fallback, so the two do not run twice.

## Project adaptation
| Placeholder | Meaning | Example |
|---|---|---|
| `<BRIEF_FILE>` | where an approved brief is saved | `docs/briefs/<yyyy-mm-dd>-<topic>.md`, `plan.md`, or the harness's project memory |
| `<PROJECT_RULES>` | constraints that every option must respect | AGENTS.md / CLAUDE.md, design system, security rules, budget |
| `<LANG>` | language for the conversation | the user's language |

## Hard gate
No code, no scaffolding, no file changes outside `<BRIEF_FILE>` until the user has approved the brief. This holds even when the idea looks simple: simple ideas are where unchecked assumptions waste the most work. A simple idea gets a short brief (a few lines), not no brief.

## Steps
1. **Read the context first.** Project rules, the relevant part of the codebase or docs, recent changelog entries. Never ask a question the files already answer.
2. **Check the size.** If the request is really several independent pieces (for example "a platform with chat, billing, analytics and a marketplace"), say so, split it into sub-projects, and shape only the first one now. Each piece gets its own brief later.
3. **Restate the goal** in two or three lines: who it is for, what problem it solves, what "done" looks like. Ask the user to correct it if needed.
4. **Ask clarifying questions, one at a time.**
   - Only questions whose answer changes the design: users and roles, scale, data that must be kept, integrations, deadline, budget, hard constraints.
   - Prefer multiple choice with a recommended option marked; open questions only when choices would be guesses.
   - Stop asking once the remaining unknowns would not change the recommendation. Three to five questions is typical; more needs a reason.
5. **Offer 2-3 approaches.** For each: a short description, what it is good at, what it costs (time, complexity, money, lock-in, maintenance), and the main risk. Lead with the recommended one and say why in one sentence. Respect `<PROJECT_RULES>`; an option that breaks them is not offered, or is offered with the conflict named.
6. **Cut scope (YAGNI).** List what is deliberately left out of the first version, so it is a decision, not an omission.
7. **Present the design in sections,** scaled to the idea: a few sentences for small ones, up to a short paragraph each for big ones. Typical sections: what it does, main parts and how they talk to each other, data, error and edge cases, how it will be tested or verified. Ask after each section whether it looks right; revise before moving on.
8. **Write the brief** to `<BRIEF_FILE>` after approval (format below). Then self-check it once: no "TBD" or placeholders, no section contradicting another, scope small enough for one plan, every requirement unambiguous. Fix in place.
9. **Ask the user to review the brief.** Changes requested: edit and re-check. Approved: go to step 10.
10. **Hand off** to exactly one next skill:
    - new project or app: `build-project`
    - multi-file or risky change in an existing repo: `plan-then-code`
    - small change: `code-change`
    - the idea needs facts first (performance, a library's limits, a bug): `analyze-problem`, then come back.

## Brief format
```
# <Topic> - design brief (<date>)
Goal: <who, problem, success in one or two lines>
Constraints: <hard limits from the user and project rules>
Chosen approach: <name> - <why, one sentence>
Rejected: <approach> - <why>; <approach> - <why>
Design: <sections from step 7, short>
Out of scope (v1): <list>
Open questions: <none, or what must be answered before planning>
Next: <build-project | plan-then-code | code-change>
```

## Fixed rules
- One question per message. Several questions at once get half-answered.
- Always 2-3 real options; a single option is a decision presented as a choice. Never more than three.
- Always one recommendation, with its reason.
- Facts about the codebase come from reading it, not from memory or guessing.
- Read-only words in the request ("analyse", "just ideas", "cuma diskusi") mean: stop after step 5 or 7 and do not write the brief file unless asked (`mode-gates`).
- Secrets are never part of a brief (`credential-broker`).

## Report
In the user's language, short: the chosen approach and why, where the brief was saved, what was left out, and the next skill.
