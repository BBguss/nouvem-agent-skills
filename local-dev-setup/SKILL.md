---
name: local-dev-setup
description: Use when the user wants to run a repo locally or fix a broken local environment - "run this locally", "set up dev environment", "it won't start", "port already in use", "npm install fails", "database connection refused", "jalankan lokal", "setup lokal", "nggak bisa jalan di lokal" - on macOS, Linux or Windows (WSL). Detects the stack from files, pins runtime versions, builds env files from examples without inventing secrets, starts databases with Docker Compose, seeds data, and diagnoses common breakages.
---

# Local dev setup and repair (universal)

Origin: onboarding many repos of mixed stacks onto fresh laptops and fixing "works on my machine" breakages. Model-agnostic and harness-agnostic; neutral terms follow `task-delegation` §0.

## When to use / not
- Use: first run of a cloned repo, a new machine, a broken dev environment, adding a local DB/cache, local HTTPS.
- Do not use: production or staging servers (`release-deploy`, `maintenance-window-ops`); a code bug that appears once the app runs (`analyze-problem`, `error-runbook`); a brand-new project (`build-project`, which calls this skill at the end of scaffolding).

## Adapt to the project (fill once, or discover)
| Placeholder | Meaning | Example |
|---|---|---|
| `<RUNTIME>` + version | language runtime and pinned version | Node 20, Python 3.12, PHP 8.3, Go 1.22 |
| `<VERSION_MANAGER>` | tool on this machine | mise, asdf, nvm/fnm, pyenv, rbenv, sdkman |
| `<SERVICES>` | backing services | Postgres, MySQL, Redis, mail catcher, S3 emulator |
| `<DEV_CMD>` | one command that starts the app | `pnpm dev`, `docker compose up`, `make dev` |
| `<SEED_CMD>` | creates sample data | `pnpm db:seed`, `python manage.py loaddata` |
| `<PORTS>` | ports the app and services use | 3000, 5432, 6379 |

## Steps
1. **Read before running.** README, CONTRIBUTING, `Makefile`/`justfile`/`Taskfile`, package scripts, `docker-compose*.yml`, `.devcontainer/`, CI workflow (CI is the most reliable record of real setup steps). Follow the repo's documented path before inventing one.
2. **Detect the stack** from files - see `references/stack-detection.md` for the file → runtime → install/run table and lockfile → package manager rules.
3. **Pin the runtime.** Read `.tool-versions`, `.nvmrc`, `.node-version`, `.python-version`, `engines`, `go.mod`, `rust-toolchain.toml`, `composer.json` platform. Install that exact version with the version manager present; prefer one multi-runtime manager (mise/asdf) when none exists. Never upgrade the project's pinned version just to make it run; report a mismatch instead.
4. **Install dependencies** with the package manager the lockfile implies, in frozen/CI mode (`npm ci`, `pnpm i --frozen-lockfile`, `yarn --immutable`, `pip install -r` in a venv / `uv sync` / `poetry install`, `composer install`, `bundle install`, `go mod download`). Do not delete or regenerate the lockfile unless the user agrees.
5. **Env files.** Copy `.env.example` (or `.env.sample`, `.env.dist`, `config/*.example`) to the file the app reads. Fill only values that are safe defaults for local (localhost URLs, local DB names, `development`). Leave secrets empty and list them for the user; fetch real ones through `credential-broker`. Never invent API keys, never copy production values, never print secrets.
6. **Services.** Use the repo's Compose file if present; otherwise propose a minimal `compose.yaml` with named volumes, health checks and ports bound to `127.0.0.1` (template in `references/stack-detection.md`). Wait for health before migrating.
7. **Database.** Run migrations, then `<SEED_CMD>`; if no seed exists, create a minimal one with clearly fake data. Never point local at a production database.
8. **Start** `<DEV_CMD>` in the background with output to a log file; confirm hot reload by touching one file and seeing the rebuild in the log.
9. **Verify.** Hit the health/home URL (`curl -fsS`), open the main page, run the test suite once. Quote the output.
10. **HTTPS on localhost** only when needed (OAuth callbacks, secure cookies, service workers): a local CA tool (mkcert-style) or the framework's built-in HTTPS flag; never commit the generated keys.
11. **Write down** the exact working commands in the README or a `docs/dev-setup.md` if they were missing (`living-docs`).

## Diagnose breakages
Use `references/troubleshooting.md`: port in use, dependency/lockfile drift, wrong runtime version, DB not reachable, native module build failures, file watcher limits, permission errors, line endings, WSL path and networking quirks, Docker on Apple Silicon. Workflow: reproduce, read the first error (not the last), check the table, apply the smallest fix, rerun. Three failed fixes on the same symptom: stop and switch to `analyze-problem`.

## OS notes
- macOS: Homebrew for system packages; Docker Desktop or a lighter VM runtime; Apple Silicon may need `platform: linux/amd64` for old images.
- Linux: system package manager for build tools (`build-essential`, `python3-dev`, `libpq-dev`); Docker without sudo via group membership.
- Windows: develop inside WSL2 with the repo on the Linux filesystem (`~/code`, not `/mnt/c`) for speed and file watching; Docker Desktop WSL backend; set `git config core.autocrlf input`.

## Fixed rules
- Ask before installing global system packages, changing shell profiles, or deleting volumes/data.
- Never run destructive DB commands (`drop`, `reset`, volume prune) without saying what data is lost and getting a yes.
- Never disable TLS verification or security checks globally to "make it work".
- Keep changes reproducible: anything you did by hand that others will need goes into the repo (script, Compose file, docs).

## Report to the user
What runs and where (URL, ports), the one command to start it next time, what was installed or changed, secrets still needed (names only), and any version mismatch or workaround left in place.
