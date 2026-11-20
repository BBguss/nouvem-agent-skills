# Local environment troubleshooting

Method: reproduce once with full output saved to a file; read the **first** error; match below; apply the smallest fix; rerun. Note what fixed it.

## Port already in use (`EADDRINUSE`, "address already in use")
- Find the owner: macOS/Linux `lsof -nP -iTCP:<port> -sTCP:LISTEN` or `ss -ltnp | grep :<port>`; Windows `netstat -ano | findstr :<port>` then `tasklist /fi "pid eq <pid>"`.
- If it is an old dev server of this project: stop it. If it is something else (another project, a system service, a container): change this app's port via env (`PORT=3001`) rather than killing it. Ask before killing anything you did not start.
- Containers: `docker ps --format '{{.Names}} {{.Ports}}'`.

## Dependency / lockfile drift
Symptoms: "Cannot find module", peer dependency conflicts, different versions than teammates, install succeeds but build fails.
- Confirm one lockfile and the right package manager (see `stack-detection.md`).
- Clean reinstall: remove `node_modules` (and `.next`, `.turbo`, `dist`, `.vite` caches) then frozen install. Python: recreate the venv. PHP: remove `vendor`. Keep the lockfile.
- Lockfile out of sync with manifest: run a normal install, review the lockfile diff, and ask before committing it.
- Native modules (`node-gyp`, `bcrypt`, `sharp`, `psycopg2`, `mysqlclient`) fail to build: install build tools (Xcode CLT, `build-essential`, Python headers, DB client headers) or use the binary variant (`psycopg[binary]`).

## Wrong runtime version
Symptoms: syntax errors on modern syntax, "engine incompatible", "unsupported class file major version", ABI mismatch after a Node upgrade.
- `which <runtime>` and `<runtime> --version`; compare with the pinned version file.
- Shell not picking up the manager: version manager not activated in this shell (rc file hook missing) or a system install earlier in PATH.
- After switching versions, rebuild native deps (clean reinstall).

## Database not reachable (`ECONNREFUSED`, "could not connect", "Access denied")
- Is it running and healthy? `docker compose ps`; `pg_isready -h 127.0.0.1 -p 5432`; `mysqladmin ping -h 127.0.0.1`.
- Host: inside Compose, apps reach services by service name (`db`), not `localhost`; from the host, use `127.0.0.1` and the published port. `localhost` resolving to IPv6 `::1` while the DB listens on IPv4 only: use `127.0.0.1`.
- Port conflict with a locally installed DB server: change the published port.
- Credentials mismatch: the DB container only applies `POSTGRES_*`/`MYSQL_*` env on first init; an old volume keeps old credentials. Recreating the volume deletes local data - ask first.
- Migrations failing: check DB exists, user has rights, extension needed (e.g. `uuid-ossp`, `pgcrypto`).

## Hot reload not working
- Linux inotify limit: `fs.inotify.max_user_watches` too low - raise it (needs sudo, ask).
- WSL with repo under `/mnt/c`: move repo into the Linux filesystem, or enable polling (`CHOKIDAR_USEPOLLING=1`, `WATCHPACK_POLLING=true`).
- Docker bind mounts on macOS/Windows: enable polling or use the runtime's file sync feature.

## Environment variables
- App reads a different file than you wrote (`.env.local` vs `.env`, `.env.development`): check the framework's load order.
- Client-side variables need the framework's public prefix (e.g. `NEXT_PUBLIC_`, `VITE_`); never expose secrets that way.
- Restart the dev server after changing env; most do not reload it.

## Permissions and line endings
- `EACCES` on global installs: use a version manager, never `sudo npm i -g`.
- Files created by containers owned by root: run the container with the host UID/GID.
- `/bin/sh^M: bad interpreter` or shell scripts failing on Windows checkouts: CRLF line endings - `git config core.autocrlf input`, add `.gitattributes` (`*.sh text eol=lf`), re-checkout.

## Docker specifics
- Apple Silicon "no matching manifest" or crashes: use multi-arch images or `platform: linux/amd64` (slower).
- "Cannot connect to the Docker daemon": runtime not started, or user not in the docker group (Linux).
- Out of disk: `docker system df`; prune only build cache and dangling images after asking; never prune volumes without consent.

## HTTPS / certificates
- Self-signed warnings: install a local CA (mkcert-style) and generate a cert for `localhost`; do not disable verification globally.
- Corporate proxy TLS interception: configure the runtime's CA bundle env (`NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`).

## Still stuck
Collect: OS, runtime and package manager versions, the exact command, first error block, what was tried. Switch to `analyze-problem`.
