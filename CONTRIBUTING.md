# Contributing

Thanks for helping. Keep changes small and tested.

- **New skill:** copy `_TEMPLATE.md` to `<name>/SKILL.md`, add `<name>/triggers.json`, keep the skill free of project-specific paths, hosts, secrets and approval words (use placeholders in the *Project adaptation* table), and write it in English. Trigger phrases may be in any language.
- **Triggers:** test them with `node hooks/skill-router.mjs --explain "<prompt>"` on a few real prompts, including ones that must *not* match. Prefer patterns for sentence shapes and `negative` for known false positives over adding more keywords.
- **Router or installer changes:** zero runtime dependencies, Node >= 18, POSIX `sh` only (test on BusyBox `ash` or `dash` too). The router must never block or fail a prompt.
- **Before a pull request:** `node --test tests/*.test.mjs` and `node scripts/gen-index.mjs --check` must pass.
- **No secrets** in skills, tests, fixtures or examples.

By contributing you agree that your work is released under the MIT License of this repository.
