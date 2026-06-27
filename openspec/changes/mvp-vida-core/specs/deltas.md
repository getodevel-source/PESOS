# Deltas — `mvp-vida-core`

This file captures the four gap-closure deltas called out in the proposal's "What changes" section. Each section is a self-contained `## ADDED Requirements` block. Scenarios are written for strict TDD: each one is the contract a vitest test will assert in the apply phase.

---

## Delta 1 — `telegram-loopback-and-setwebhook-removal`

**Scope**: `src/app/api/telegram/setup/route.ts` (Modified — drop `setWebhook`), `src/app/api/telegram/route.ts` (Modified — add loopback guard).

**BEFORE**: `/api/telegram` accepts any request that includes the correct `?secret=` token, including from a public hostname. `/api/telegram/setup` calls `setWebhook` to register a public webhook.

**AFTER**: `/api/telegram` is loopback-only (binds to `127.0.0.1`); the public `setWebhook` registration is removed.

### ADDED Requirements

#### Requirement: Loopback guard on `/api/telegram`

The `/api/telegram` route handler MUST reject requests whose remote address is not `127.0.0.1` (or `::1`) with HTTP 403, unless the env override `TELEGRAM_ALLOW_REMOTE=1` is set. The loopback check MUST run before the secret check.

- Reference: `src/app/api/telegram/route.ts:469` (current `secret !== token` check) is preceded by a new `ip` check.
- Reference: proposal Assumption 1 ("Loopback guard on `/api/telegram`").
- The check MUST be opt-out (env var), not opt-in (config flag).

#### Requirement: Public `setWebhook` registration is removed

`src/app/api/telegram/setup/route.ts` MUST NOT call `https://api.telegram.org/bot{token}/setWebhook`. The endpoint MUST still validate the bot token via `getMe`, but on success it MUST return a deprecation note directing users to the local-poll flow (`electron.js` `startTelegramPoll`).

- Reference: `src/app/api/telegram/setup/route.ts:31-37` (current `setWebhook` call) is replaced with a deprecation response.
- Reference: proposal Assumption 1 ("drop `setWebhook` registration").

#### Requirement: Electron clears any stale public webhook on startup

`electron.js` `startTelegramPoll` MUST continue to call `https://api.telegram.org/bot{token}/deleteWebhook` once on startup so any previously registered public webhook is cleared before the first `getUpdates` call.

- Reference: `electron.js:74-83` (existing `deleteWebhook` call). No new behavior; the call is required to keep working as the migration completes.

#### Requirement: Opt-in escape hatch

The loopback guard MUST be disable-able via `TELEGRAM_ALLOW_REMOTE=1` (the proposal's documented override). When the env var is set, the secret check (and only the secret check) is applied.

- Reference: proposal Risks table ("Loopback guard on `/api/telegram` breaks ngrok/cloudflared tunnels").

### Scenarios

#### Scenario: Loopback request accepted
- GIVEN the route binds to `127.0.0.1` and the request comes from `127.0.0.1` with the correct `?secret=`
- WHEN the handler runs
- THEN it returns HTTP 200 and proceeds with the normal Telegram ingestion flow.

#### Scenario: Remote request rejected
- GIVEN a request comes from a non-loopback address
- WHEN the handler runs
- THEN it returns HTTP 403 (regardless of `?secret=`).

#### Scenario: `TELEGRAM_ALLOW_REMOTE=1` opt-in
- GIVEN the env var is set and the request comes from a remote address
- WHEN the handler runs
- THEN the loopback check is skipped and the secret check (and only the secret check) is applied.

#### Scenario: `setWebhook` not called from setup route
- GIVEN a POST to `/api/telegram/setup` with any payload
- WHEN the handler runs
- THEN it does NOT call Telegram's `setWebhook` and the response includes a deprecation note pointing to the local-poll flow.

#### Scenario: Electron clears stale webhook
- GIVEN a previous public webhook was registered
- WHEN `startTelegramPoll` starts
- THEN it calls `deleteWebhook` before the first `getUpdates` call.

---

## Delta 2 — `dashboard-auth-gate`

**Scope**: new `src/app/api/auth/handshake/route.ts`, new `src/middleware.ts`, new `src/lib/auth-gate.ts`, new `src/components/AuthGate.tsx`, modified `electron.js` (call handshake on window-ready), removed `src/components/AuthForm.tsx` from the dashboard tree.

**BEFORE**: The dashboard is reachable on `http://localhost:3000` without any session check. The legacy `AuthForm.tsx` (email/password) is rendered for some routes but the dashboard itself is not gated.

**AFTER**: The dashboard requires a short-lived HttpOnly session cookie issued by `/api/auth/handshake`. The handshake endpoint is bound to loopback. The Electron main process triggers the handshake on app-ready.

### ADDED Requirements

#### Requirement: Handshake endpoint issues an HttpOnly session cookie

A new `POST /api/auth/handshake` route MUST validate a locally-known shared secret, set an HttpOnly session cookie scoped to the dashboard origin, and return HTTP 200 on success. The endpoint MUST reject any non-loopback caller with HTTP 403 unless `TELEGRAM_ALLOW_REMOTE=1` is set.

- Reference: new file `src/app/api/auth/handshake/route.ts` (per proposal "Affected areas").
- The shared secret MUST be read from `~/.config/pesos/.auth-secret` (or generated on first launch and persisted to that file).

#### Requirement: Middleware-enforced dashboard gate

A new `src/middleware.ts` MUST verify the session cookie on every dashboard route and MUST redirect unauthenticated requests to the login page via HTTP 307. The middleware MUST NOT block the handshake endpoint itself, static assets, or Next.js internals (`/_next/*`).

- Reference: new file `src/middleware.ts` (per proposal "Affected areas").

#### Requirement: Electron triggers the handshake on app-ready

`electron.js` MUST call the handshake endpoint after `startNextServer()` resolves on `app.on('ready')`, so the dashboard is reachable without manual login. The call MUST target `http://127.0.0.1:3000/api/auth/handshake`.

- Reference: `electron.js:213-218` (existing `app.on('ready')` block) — add a `fetch(... handshake ...)` after the next server boots.

#### Requirement: Legacy email/password AuthForm is removed from the dashboard tree

The legacy `src/components/AuthForm.tsx` (email + password `signUp` / `signInWithPassword`) MUST be removed or hidden from the dashboard tree, since the new gate is loopback-only and single-user.

- Reference: `src/components/AuthForm.tsx` is imported by `Dashboard.tsx`; the import + usage MUST be removed or the component MUST be replaced by `AuthGate.tsx`.

#### Requirement: Documented lockout recovery

The system MUST support a lockout-recovery flow that requires no tooling beyond `rm` and an app restart: deleting `~/.config/pesos/.auth-cookie` and restarting the app MUST re-enable dashboard access on the next handshake.

### Scenarios

#### Scenario: Unauthenticated dashboard request redirects
- GIVEN no session cookie
- WHEN a request hits `/dashboard`
- THEN the middleware responds with HTTP 307 to the login page.

#### Scenario: Authenticated dashboard request passes through
- GIVEN a valid session cookie
- WHEN a request hits `/dashboard`
- THEN the middleware forwards the request to the route handler unchanged.

#### Scenario: Handshake loopback-only
- GIVEN a remote caller
- WHEN `/api/auth/handshake` is called
- THEN it returns HTTP 403 and sets no cookie.

#### Scenario: Handshake success on loopback
- GIVEN a loopback caller with the shared secret
- WHEN `/api/auth/handshake` is called
- THEN the response sets an HttpOnly cookie and returns HTTP 200.

#### Scenario: Electron triggers handshake on ready
- GIVEN the app is packaged and the Next.js server is reachable on `127.0.0.1:3000`
- WHEN `app.on('ready')` resolves
- THEN a `fetch('http://127.0.0.1:3000/api/auth/handshake', ...)` call is observed and a 200 response is received.

#### Scenario: Lockout recovery
- GIVEN `~/.config/pesos/.auth-cookie` has been deleted
- WHEN the app restarts
- THEN the handshake on next launch issues a fresh cookie and the dashboard loads.

#### Scenario: Legacy `AuthForm` is not in the tree
- GIVEN a request to `/dashboard`
- WHEN SSR runs
- THEN the email/password `signUp` / `signInWithPassword` form is not rendered.

---

## Delta 3 — `ai-provider-config-and-key-validation`

**Scope**: new `src/lib/ai-config.ts`; modified `src/app/api/ai-chat/route.ts`, `src/app/api/telegram/route.ts`; modified `src/app/api/ai-chat/validate/route.ts` (already validates only the chosen provider; the new behavior is the 401 hard-fail).

**BEFORE**: Provider selection is implicit (env-var order: `GOOGLE_AI_API_KEY` first, then `OPENCODE_GO_API_KEY`). `/api/ai-chat/validate` validates the chosen provider only. There is no persistent user-level provider default.

**AFTER**: A new `src/lib/ai-config.ts` reads `~/.config/pesos/.ai-config.json` for the explicit default. `/api/ai-chat` and `/api/telegram` use that default. 401 is a hard-fail (no silent fallback).

### ADDED Requirements

#### Requirement: Persistent explicit default in `.ai-config.json`

A new `src/lib/ai-config.ts` MUST export a function that returns the user's explicit default provider from `~/.config/pesos/.ai-config.json`. The function MUST default to `{ provider: 'gemini' }` (no key) only when the file is missing or unparseable, and MUST NOT throw.

- Reference: new file `src/lib/ai-config.ts` (per proposal "Affected areas").
- Reference: proposal Assumption 3 ("AI provider default is explicit, not env-var order").

#### Requirement: `/api/ai-chat` uses the explicit default

`src/app/api/ai-chat/route.ts` MUST use the chosen default from `src/lib/ai-config.ts` when the request body does not specify `provider`. Per-request `provider` overrides (e.g. from the Setup Wizard "test connection" flow) MUST still be honored.

- Reference: `src/app/api/ai-chat/route.ts:211` — the current code uses `provider = 'gemini'` as the body default. This default MUST be replaced with the `ai-config` value.

#### Requirement: `/api/telegram` uses the explicit default

`src/app/api/telegram/route.ts` `getAIResponse` MUST accept the explicit default and MUST consult `src/lib/ai-config.ts` when the function is called without an explicit provider override. The same model selection MUST apply to both routes.

- Reference: `src/app/api/telegram/route.ts:124-163`.

#### Requirement: Validate-only-the-chosen-provider (no cross-provider retry)

`POST /api/ai-chat/validate` MUST validate only the chosen provider's key. On a failure, the route MUST return `{ valid: false, error }` and MUST NOT attempt the other provider. The behavior is already implemented (`src/app/api/ai-chat/validate/route.ts:6-69`); the new requirement is that the behavior MUST remain unchanged even if a future refactor suggests "try the other key on failure".

- Reference: `src/app/api/ai-chat/validate/route.ts:6-69`.

#### Requirement: 401 is a hard-fail in both chat routes

When a 401 comes back from the chosen provider's SDK, the route handler MUST surface the error to the caller (HTTP 500 with the SDK message). The handler MUST NOT catch the 401 and silently retry with the other provider's key. The same rule applies to `/api/telegram` `getAIResponse` (which currently picks Gemini-then-OpenCode — that fallback chain is removed for the 401 case).

- Reference: `src/app/api/ai-chat/route.ts:277, 326`; `src/app/api/telegram/route.ts:128-145`.

### Scenarios

#### Scenario: Explicit default honored
- GIVEN `.ai-config.json` says `provider: "opencode"`
- WHEN `/api/ai-chat` is called without a body `provider` field
- THEN the request is routed to OpenCode even if `GOOGLE_AI_API_KEY` is set in the env.

#### Scenario: Missing config file → graceful default
- GIVEN the config file does not exist
- WHEN `ai-config` is read
- THEN it returns `{ provider: 'gemini' }` (no key) without throwing.

#### Scenario: Validate-only-chosen-provider
- GIVEN `provider: 'opencode'` and a bad key
- WHEN `/api/ai-chat/validate` is called
- THEN the response is `{ valid: false, error }` and the Gemini key is not touched.

#### Scenario: 401 hard-fail in `/api/ai-chat`
- GIVEN the chosen provider returns 401
- WHEN `/api/ai-chat` runs
- THEN the client receives HTTP 500 with the SDK error and the other provider is NOT tried.

#### Scenario: 401 hard-fail in `/api/telegram`
- GIVEN the chosen provider returns 401 on a free-text AI call
- WHEN the route runs
- THEN the user receives a localized error and the other provider is NOT tried.

#### Scenario: Telegram free-text uses explicit default
- GIVEN the default is `opencode`
- WHEN a free-text message is received
- THEN the system prompt is built and the call goes to OpenCode (not Gemini).

---

## Delta 4 — `rls-rollback-strategy`

**Scope**: new `supabase/migrations/00000000009999_rollback_strategy.sql`; new test `supabase/migrations/rollback.test.ts` (or equivalent test file under `src/`).

**BEFORE**: There is no documented SQL rollback for the RLS policies and table changes introduced by `20260616000000` through `20260626000005`. `rules.proposal` requires a rollback plan for any migration touching RLS or auth tables.

**AFTER**: A new `supabase/migrations/00000000009999_rollback_strategy.sql` is added that reverses every CREATE / ALTER / POLICY in dependency order and is parseable SQL.

### ADDED Requirements

#### Requirement: Rollback file exists and is parseable SQL

The file `supabase/migrations/00000000009999_rollback_strategy.sql` MUST exist and MUST be syntactically valid SQL (verified by `psql --dry-run` or an equivalent test).

- Reference: new file under `supabase/migrations/` (per proposal "Affected areas").
- Reference: proposal Assumption 4 ("RLS rollback = documented SQL file").

#### Requirement: Every CREATE / ALTER / POLICY has a matching DROP

The rollback file MUST contain, in dependency order, a `DROP` for every `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE TRIGGER`, and `CREATE FUNCTION` introduced by migrations `20260616000000` through `20260626000005`. The reverse order MUST respect foreign-key dependencies (e.g. `DROP TABLE tasks` precedes `DROP TABLE profiles`).

#### Requirement: Re-apply script header present

The file MUST include a comment block at the top listing the original migrations in chronological order so the operator knows how to re-apply them.

#### Requirement: Test parses the rollback and asserts completeness

The corresponding test (`supabase/migrations/rollback.test.ts` per proposal "Affected areas", or `src/test/rollback.test.ts` depending on `vitest.config.ts` scope) MUST:

- Read the rollback file.
- Assert it is non-empty.
- Assert it starts with a comment block.
- Iterate the original migrations and assert every `CREATE` / `CREATE POLICY` / `CREATE TRIGGER` has a matching `DROP` line in the rollback.

### Scenarios

#### Scenario: File exists and parses
- GIVEN the migration directory
- WHEN the test harness reads the file
- THEN it is non-empty and the SQL parser reports no syntax errors.

#### Scenario: Every CREATE has a matching DROP
- GIVEN the original migrations `20260616000000..20260626000005`
- WHEN the test iterates the file
- THEN every created object has a corresponding `DROP`.

#### Scenario: Dependency order respected
- GIVEN the original migrations create `profiles` before `tasks` (FK)
- WHEN the rollback is read
- THEN `DROP TABLE tasks` precedes `DROP TABLE profiles`.

#### Scenario: Re-apply header present
- GIVEN the file is read
- WHEN the harness checks the first 10 lines
- THEN a comment block lists the migration timestamps in chronological order.

#### Scenario: Rollback policy is dropped
- GIVEN migration `20260616000000` creates the `profiles` RLS policy `Users can manage their own profile`
- WHEN the rollback is run
- THEN `DROP POLICY "Users can manage their own profile" on public.profiles;` appears before `DROP TABLE profiles`.
