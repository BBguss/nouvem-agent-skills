---
name: <kebab-case-name>
description: Use when <concrete triggers in English: situations, the user's words, symptoms, e.g. "deploy this", "kenapa error">. <One sentence on what the skill produces.>
---

# <Skill title>

Origin: <the real workflow this pattern was distilled from, one line>. Model-agnostic and harness-agnostic; neutral terms (sub-agent, background, heartbeat, follow-up message, isolation) follow `task-delegation`.

## When to use / not
- Use when ...
- Do not use when ... (name the skill to use instead)

## Project adaptation
Values the project defines once in AGENTS.md / CLAUDE.md / GEMINI.md or its rules folder. The skill reads them there and asks only when one is missing; it never guesses.

| Placeholder | Meaning | Examples |
|---|---|---|
| `<PROD_DIR>` | ... | ... |

## Steps
1. ...
2. ...

## Fixed rules
- ...

## Report
Short, in the user's language, result first: ...

<!--
Also add <kebab-case-name>/triggers.json next to this file so the router can pick the skill
from plain words and sentences, any language. Delete this comment in the real skill.

{
  "keywords": ["deploy", "go live", "rilis ke produksi", "desplegar"],
  "patterns": ["\\b(deploy|release|rilis)\\b.{0,20}\\b(prod|production|produksi)\\b"],
  "files": ["Dockerfile", "vercel.json"],
  "negative": ["\\b(do not|don't|jangan) deploy\\b"],
  "slash": ["/deploy"],
  "priority": 1
}

keywords  case-insensitive whole words/phrases (score 2 each)
patterns  JS regexes, case-insensitive, for sentence shapes (score 3 each)
files     names in the working directory that raise relevance after a text hit
negative  regexes that suppress the skill
slash     optional exact aliases; nobody has to type them
priority  tie-break; 0 = fallback skill
Check with: node hooks/skill-router.mjs --explain "a real prompt"
-->
