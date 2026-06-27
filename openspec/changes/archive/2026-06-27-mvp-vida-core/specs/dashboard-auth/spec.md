# `dashboard-auth` Specification

## Purpose

Single-user, local-only access gate for the web dashboard. A short-lived HttpOnly session cookie is issued by a local IPC handshake endpoint and verified by Next.js middleware on every dashboard request. There is no Supabase Auth, no password, and no OAuth. Lockout recovery is a documented local filesystem operation.

## Requirements

### Requirement 1 — Loopback-only handshake endpoint

A new `POST /api/auth/handshake` route MUST validate a locally-known shared secret, set an HttpOnly session cookie scoped to the dashboard origin, and return HTTP 200 on success. The endpoint MUST reject any non-loopback caller (`127.0.0.1` / `::1`) with HTTP 403 unless the env override `TELEGRAM_ALLOW_REMOTE=1` is set.

- Reference (to be created): `src/app/api/auth/handshake/route.ts`.
- Reference (loopback pattern): `src/app/api/telegram/route.ts:469` — bind to loopback as a hard requirement, not a recommendation.

### Requirement 2 — Middleware-enforced dashboard gate

A new `src/middleware.ts` MUST verify the session cookie on every `/dashboard/*` (and any other protected) route and MUST redirect unauthenticated requests to the SetupWizard or login page via HTTP 307.

- The middleware MUST NOT block the handshake endpoint itself or static assets.

### Requirement 3 — Session cookie semantics

The session cookie MUST be:

- `HttpOnly` (not readable from JavaScript).
- `SameSite=Lax` (or stricter).
- `Path=/` so it covers all dashboard routes.
- Short-lived (e.g. 8-24 hours; the exact TTL is an `apply` decision).

### Requirement 4 — Electron triggers the handshake on app-ready

`electron.js` MUST call the handshake endpoint after `startNextServer()` resolves on `app.on('ready')`, so the dashboard is reachable without manual login.

- The call MUST target `http://127.0.0.1:3000/api/auth/handshake` (loopback).
- The call MUST be retried up to N times (N is an `apply` decision) with a short backoff to ride out the Next.js boot delay.

### Requirement 5 — Documented lockout recovery

The system MUST support a lockout-recovery flow that requires no tooling beyond `rm` and an app restart:

- The user deletes `~/.config/pesos/.auth-cookie`.
- The user restarts the app.
- The handshake on next launch issues a fresh cookie and the dashboard loads.

- Reference (state-location pattern): `~/.config/pesos/.update-pending` is the existing precedent (`electron.js:193`).

## Scenarios

### Scenario: Handshake success on loopback
- GIVEN Electron posts to `/api/auth/handshake` from `127.0.0.1` with the local shared secret
- WHEN the handler runs
- THEN it sets an HttpOnly session cookie and returns HTTP 200.

### Scenario: Handshake rejected from non-loopback
- GIVEN a remote IP address
- WHEN `/api/auth/handshake` is called
- THEN it returns HTTP 403 and sets no cookie.

### Scenario: Middleware redirects unauthenticated dashboard request
- GIVEN a request to `/dashboard` (or any protected route) with no valid session cookie
- WHEN the middleware runs
- THEN it responds with HTTP 307 to the login/setup page.

### Scenario: Middleware passes an authenticated request
- GIVEN a request to `/dashboard` with a valid session cookie
- WHEN the middleware runs
- THEN the request is forwarded to the route handler unchanged.

### Scenario: Lockout recovery
- GIVEN `~/.config/pesos/.auth-cookie` has been deleted
- WHEN the app restarts
- THEN the handshake on next launch issues a fresh cookie and the dashboard loads.

### Scenario: Electron triggers handshake on ready
- GIVEN `app.on('ready')` fires
- WHEN `startNextServer` finishes booting
- THEN the handshake call is made to `http://127.0.0.1:3000/api/auth/handshake` and a 200 response is observed.

## Out of scope

- Supabase Auth integration (the entire `signUp` / `signInWithPassword` flow in `src/components/AuthForm.tsx` is replaced or hidden by the new gate).
- Password, OAuth, passkey, or magic-link authentication.
- Multi-user / role-based access control.
- Cross-device session sharing.
- Session revocation UI (lockout is a filesystem operation).
- Rate-limiting the handshake endpoint (loopback-only; non-loopback returns 403 outright).
