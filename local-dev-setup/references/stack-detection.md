# Stack detection and run commands

## File → stack
| File(s) present | Stack | Install | Typical run |
|---|---|---|---|
| `package.json` + `pnpm-lock.yaml` | Node, pnpm | `corepack enable && pnpm i --frozen-lockfile` | `pnpm dev` |
| `package.json` + `yarn.lock` | Node, Yarn (check `.yarnrc.yml` for Berry) | `corepack enable && yarn install --immutable` | `yarn dev` |
| `package.json` + `package-lock.json` | Node, npm | `npm ci` | `npm run dev` |
| `bun.lockb` / `bun.lock` | Bun | `bun install --frozen-lockfile` | `bun dev` |
| `deno.json` | Deno | (none) | `deno task dev` |
| `pyproject.toml` + `uv.lock` | Python, uv | `uv sync` | `uv run <entry>` |
| `pyproject.toml` + `poetry.lock` | Python, Poetry | `poetry install` | `poetry run <entry>` |
| `requirements*.txt` | Python, pip | `python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt` | `python manage.py runserver` / `uvicorn app:app --reload` / `flask run` |
| `composer.json` | PHP | `composer install` | `php artisan serve` / `symfony serve` / `php -S localhost:8000 -t public` |
| `Gemfile` | Ruby | `bundle install` | `bin/rails server` / `bin/dev` |
| `go.mod` | Go | `go mod download` | `go run ./cmd/<app>` (hot reload: air) |
| `Cargo.toml` | Rust | `cargo build` | `cargo run` (hot reload: cargo-watch) |
| `pom.xml` / `build.gradle(.kts)` | Java/Kotlin | `./mvnw -q -DskipTests package` / `./gradlew build -x test` | `./mvnw spring-boot:run` / `./gradlew bootRun` |
| `*.csproj` / `*.sln` | .NET | `dotnet restore` | `dotnet watch run` |
| `mix.exs` | Elixir | `mix deps.get` | `mix phx.server` |
| `pubspec.yaml` | Dart/Flutter | `flutter pub get` | `flutter run` |
| `Dockerfile` / `compose.yaml` / `docker-compose.yml` | containerized | `docker compose build` | `docker compose up` |
| `.devcontainer/` | dev container | open in a dev-container-capable editor or CLI | per its config |
| `Makefile` / `justfile` / `Taskfile.yml` | task runner wraps the above | `make setup` / `just setup` | `make dev` / `just dev` |
| `hugo.toml`, `astro.config.*`, `.eleventy.js`, `_config.yml` (Jekyll) | static site | per generator | `hugo server`, `astro dev`, `eleventy --serve`, `bundle exec jekyll serve` |

Rules:
- Only one lockfile should exist; two lockfiles means drift - ask which one is authoritative.
- `packageManager` field in `package.json` wins; use corepack to get that exact version.
- Monorepo markers: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, workspaces in `package.json`. Install at the root, run the target app with a filter (`pnpm --filter <app> dev`).

## Version files
`.tool-versions` (asdf/mise), `mise.toml`, `.nvmrc`/`.node-version`, `.python-version`, `.ruby-version`, `go.mod` `go` line / `toolchain`, `rust-toolchain.toml`, `global.json` (.NET), `engines` in `package.json`, `composer.json` `config.platform.php`.

## Minimal Compose template (local only)
```yaml
services:
  db:
    image: postgres:16            # or mysql:8.4 / mariadb:11
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app       # local throwaway only
      POSTGRES_DB: app_dev
    ports: ["127.0.0.1:5432:5432"]
    volumes: [db-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10
  cache:
    image: redis:7
    ports: ["127.0.0.1:6379:6379"]
  mail:
    image: axllent/mailpit         # catches outgoing mail, UI on 8025
    ports: ["127.0.0.1:1025:1025", "127.0.0.1:8025:8025"]
volumes:
  db-data:
```
Wait for health: `docker compose up -d --wait` (or poll the healthcheck) before migrations.

## Seed data rules
- Fake but realistic (faker libraries), deterministic seed for reproducible tests.
- One admin/test user with a printed local-only password generated at seed time, or documented as local-only.
- No real customer data, no production dumps unless anonymized and the owner agrees.
