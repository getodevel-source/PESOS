# `ai-provider-config` Specification

## Purpose

The user explicitly picks the default AI provider (Gemini or OpenCode Go) and the API key persists in `~/.config/pesos/.ai-config.json`. The `/api/ai-chat` and `/api/telegram` routes read the explicit default — env-var order is no longer authoritative. A 401 from the chosen provider is a hard-fail; the route MUST NOT silently substitute the other provider's key.

## Requirements

### Requirement 1 — Persistent explicit default

The system MUST persist the user's default AI provider choice and API key in `~/.config/pesos/.ai-config.json` with at minimum the shape:

```json
{ "provider": "gemini" | "opencode", "googleApiKey"?: string, "opencodeApiKey"?: string, "model": string }
```

- Reference: new module `src/lib/ai-config.ts` (per proposal "Affected areas").
- The file MUST be created in the user's config directory (`~/.config/pesos/`) — never inside the AppImage's read-only mount.

### Requirement 2 — Explicit default is the source of truth

`src/lib/ai-config.ts` MUST export a function that returns the user's explicit default provider. The function MUST default to `gemini` only when no config file exists, and MUST NOT consult `process.env.GOOGLE_AI_API_KEY` / `process.env.OPENCODE_GO_API_KEY` ordering to pick the provider.

- Reference: proposal Assumption 3 ("AI provider default is explicit, not env-var order").

### Requirement 3 — `/api/ai-chat` uses the explicit default

`src/app/api/ai-chat/route.ts` MUST use the chosen default from `src/lib/ai-config.ts` when the request does not specify a `provider` in the body. Per-request `provider` overrides (e.g. from the Setup Wizard "test connection" flow) MUST still be honored.

- Reference: `src/app/api/ai-chat/route.ts:211` — the current code uses `provider = 'gemini'` as the body default. This default MUST be replaced with the `ai-config` value.

### Requirement 4 — `/api/telegram` uses the explicit default

`src/app/api/telegram/route.ts` MUST use the chosen default from `src/lib/ai-config.ts` for the free-text AI flow and the `/resumen` command. The same model selection MUST apply to both routes.

- Reference: `src/app/api/telegram/route.ts:124-163` (`getAIResponse`).

### Requirement 5 — Validate-only-the-chosen-provider

`POST /api/ai-chat/validate` MUST validate only the chosen provider's key. On a failure, the route MUST return `{ valid: false, error }` and MUST NOT attempt the other provider.

- Reference: `src/app/api/ai-chat/validate/route.ts:6-69`.

### Requirement 6 — 401 is a hard-fail (no silent fallback)

When a 401 comes back from the chosen provider's SDK, the route handler MUST surface the error to the caller (HTTP 500 with the SDK message). The handler MUST NOT catch the 401 and silently retry with the other provider's key.

- Reference: `src/app/api/ai-chat/route.ts:277, 326` (the two `await ... create(...)` call sites).

## Scenarios

### Scenario: Missing config file → graceful default
- GIVEN no `~/.config/pesos/.ai-config.json`
- WHEN `ai-config` is read
- THEN it returns `{ provider: 'gemini' }` (no key) without throwing.

### Scenario: Explicit default honored over env order
- GIVEN the config file says `provider: "opencode"`
- WHEN `/api/ai-chat` is called without a body `provider` field
- THEN the request is routed to OpenCode even if `GOOGLE_AI_API_KEY` is set in the env.

### Scenario: Validate gemini with bad key
- GIVEN the chosen provider is `gemini` and the configured key fails Google auth
- WHEN `validate` is called
- THEN the response is `{ valid: false, error: "..." }` and the route does not attempt the OpenCode key.

### Scenario: Validate opencode with bad key
- GIVEN the chosen provider is `opencode` and the configured key fails OpenCode auth
- WHEN `validate` is called
- THEN the response is `{ valid: false, error: "..." }` and the route does not attempt the Gemini key.

### Scenario: Validate gemini with good key
- GIVEN the chosen provider is `gemini` and the configured key passes Google auth
- WHEN `validate` is called
- THEN the response is `{ valid: true }`.

### Scenario: Validate opencode with good key
- GIVEN the chosen provider is `opencode` and the configured key passes `openai.models.list`
- WHEN `validate` is called
- THEN the response is `{ valid: true }`.

### Scenario: 401 hard-fail on `/api/ai-chat`
- GIVEN the chosen provider returns 401
- WHEN `/api/ai-chat` runs
- THEN the response is HTTP 500 with the SDK error and the other provider is NOT tried.

## Out of scope

- Env-var-driven implicit provider selection (Gemini-first-then-OpenCode fallback chain) — explicitly REMOVED in v1.
- Server-side silent retry on 5xx (only the 401 hard-fail is mandated; transient 5xx retry policy is unchanged).
- Persisting the choice in Supabase / cloud storage.
- Per-user model override (the default applies to the single user).
- Migration of the legacy `.env.local`-only key storage (the Setup Wizard continues to write `.env.local`; `.ai-config.json` is the new authoritative file for the default).
