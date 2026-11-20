# REST / GraphQL API, backend service

## Typical features
- [ ] Resource design: nouns, consistent naming, versioning strategy (`/v1` or header), pagination (cursor preferred), filtering, sorting
- [ ] Contract first: OpenAPI spec (REST) or schema SDL (GraphQL), generated docs and client types
- [ ] Auth: API keys for machines, OAuth2/OIDC or session/JWT for users; scopes
- [ ] Validation at the boundary with a schema library; consistent error format (e.g. problem+json) with stable error codes
- [ ] Idempotency keys for POSTs that create payments/orders; ETags or `updated_at` for concurrency
- [ ] Rate limiting and quotas per key/user; request size limits; timeouts
- [ ] Health (`/healthz` liveness, `/readyz` readiness), structured logs with request ID, metrics, tracing
- [ ] Background jobs and webhooks out (signed, retried with backoff)
- [ ] GraphQL extras: depth/complexity limits, persisted queries, DataLoader against N+1, disable introspection in prod if private

## Data model sketch
```
ApiClient { id, name, key_hash, scopes[], rate_limit, owner_id, revoked_at }
<Resource> { id (UUID/ULID), ..., created_at, updated_at, deleted_at? }
IdempotencyKey { key, client_id, request_hash, response, created_at }
WebhookSubscription { id, client_id, url, events[], secret_hash }   WebhookDelivery { id, sub_id, event, status, attempts, next_retry_at }
```
Migrations versioned in the repo; never edit an applied migration.

## Recommended stacks
1. **Node/TypeScript**: Fastify/NestJS/Hono + Postgres + Prisma/Drizzle/Kysely + Zod/TypeBox; GraphQL via a schema-first or code-first server.
2. **Python**: FastAPI (typed, auto OpenAPI) + SQLAlchemy/SQLModel + Alembic; or Django REST Framework for admin-heavy backends.
3. **Go** (net/http or a light router + sqlc/pgx) for high throughput and small containers; alternatives: Laravel/Rails API mode, Spring Boot, .NET minimal APIs, depending on the team.
Serverless functions are fine for low, spiky traffic; containers for steady load and long requests.

## Security musts
- OWASP API Top 10: object-level authorization on every resource lookup (no BOLA/IDOR), property-level filtering (no mass assignment, no over-exposure), function-level authorization.
- Parameterized queries only; validate and bound every input (sizes, enums, pagination limits).
- Secrets via env/secret manager; keys hashed; TLS everywhere; CORS allow-list for browser clients.
- Webhooks in: verify signatures and timestamps; webhooks out: sign payloads.
- SSRF guard on any user-supplied URL fetch; no stack traces in responses.
- For agent/MCP exposure follow `agent-tool-parity`; for formal testing `security-audit-cycle`.

## SEO / a11y musts
- Not applicable to the API itself; public docs page follows web a11y basics and is indexable if the API is public.

## Definition of done
- Spec/schema matches implementation (contract tests or generated types compile against it).
- Integration tests per endpoint: success, validation error, unauthenticated, forbidden (other owner's ID), not found.
- Rate limit and payload limit verified; health endpoints respond; logs carry request IDs.
- Migrations run up (and down where supported) on a clean DB; seed works; docs published.
