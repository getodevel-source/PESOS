# `telegram-ingestion` Specification

## Purpose

Telegram messages enter the Pesos app through a local long-poll loop driven by the Electron main process. The Electron process forwards each `getUpdates` payload to a local Next.js webhook endpoint that authenticates by shared secret, resolves the receiving user, persists the raw payload, and dispatches the message to either a command handler or the AI flow. This is the **only** supported ingestion path; the public `setWebhook` registration is deprecated (see `deltas/telegram-loopback-and-setwebhook-removal`).

## Requirements

### Requirement 1 — Local long-poll is the single source of truth

The Telegram bot MUST be polled by the local Electron process using `getUpdates` with a 30-second long-poll timeout, and MUST call `deleteWebhook` once on startup to clear any previously registered public webhook.

- Reference: `electron.js` `startTelegramPoll()` at lines 64-113.
- The poll loop MUST be guarded by an `isPolling` flag so only one loop runs per process.

### Requirement 2 — Secret-gated ingestion endpoint

The `/api/telegram` POST handler MUST accept requests that include the bot token in the `?secret=` query parameter and MUST reject any request where the secret is missing, empty, or does not match `process.env.TELEGRAM_BOT_TOKEN` with HTTP 401 and body `Unauthorized`.

- Reference: `src/app/api/telegram/route.ts` lines 467-475.

### Requirement 3 — User resolution by `telegram_chat_id` then `telegram_username`

The route handler MUST resolve the receiving `user_id` by:

1. First selecting from `profiles` where `telegram_chat_id = <chat.id>`.
2. If no row is found, selecting from `profiles` where `telegram_username = <from.username>`.
3. If a username match is found, the handler MUST also update the resolved profile's `telegram_chat_id` to the current `chat.id` so future polls resolve by chat_id.

- Reference: `src/app/api/telegram/route.ts` lines 500-522.
- Unknown senders (no chat_id and no username match) MUST produce an `inputs` row with `user_id: null` (the route MUST NOT 4xx in that case — Telegram would retry).

### Requirement 4 — Audit insert on every well-formed update

For every well-formed, authenticated update, the route handler MUST insert a row into `inputs` with `{ user_id, payload, processed: false }` and MUST call `.throwOnError()` so DB failures surface as 500.

- Reference: `src/app/api/telegram/route.ts` line 525.
- The `inputs` audit row is the system-of-record for what arrived from Telegram. The `processed` flag is a forward-compatibility hook (not consumed in v1).

### Requirement 5 — Always 200 for messages Telegram can retry

The route handler MUST return HTTP 200 with `{ok: true}` for any well-formed, authenticated request — including requests for unknown senders and any message that the bot cannot act on — so that Telegram does not retry the same `update_id`.

- Reference: `src/app/api/telegram/route.ts` line 686.
- The handler MUST return 500 only on a thrown `throwOnError` from the `inputs` insert or on a non-`try`/`catch`-recoverable runtime error.

## Scenarios

### Scenario: Secret gate accepts the right token
- GIVEN a POST to `/api/telegram?secret=test_token` with a valid JSON body
- WHEN the handler runs
- THEN it returns HTTP 200 and inserts an `inputs` row.

### Scenario: Secret gate rejects missing or wrong token
- GIVEN a POST with no `?secret=`, or `?secret=wrong_token`
- WHEN the handler runs
- THEN it returns HTTP 401 with body `Unauthorized` and inserts no `inputs` row.

### Scenario: User resolution by `telegram_chat_id`
- GIVEN a profile exists with `telegram_chat_id = 999`
- WHEN a message with `chat.id = 999` arrives
- THEN the handler queries `profiles` by `telegram_chat_id` first, uses the matching profile, and `inputs.user_id` is set to that profile's `id`.

### Scenario: User resolution falls back to `telegram_username` and back-fills `telegram_chat_id`
- GIVEN no profile has `telegram_chat_id = 888` but a profile has `telegram_username = 'user_x'`
- WHEN a message with `chat.id = 888` and `from.username = 'user_x'` arrives
- THEN the handler resolves the user by username, updates that profile's `telegram_chat_id` to `888`, and `inputs.user_id` is set.

### Scenario: Unknown sender does not produce a 4xx
- GIVEN no profile matches by chat_id or username
- WHEN a message arrives
- THEN `inputs.user_id` is `null` and the response is HTTP 200 `{ok: true}` (no Telegram retry storm).

### Scenario: Invalid JSON payload
- GIVEN a POST with malformed JSON body
- WHEN the handler runs
- THEN it returns HTTP 400 `{error: "Invalid JSON payload"}`.

### Scenario: Non-object payload
- GIVEN a POST with JSON body that is not an object (e.g. a string or array)
- WHEN the handler runs
- THEN it returns HTTP 400 `{error: "Payload must be an object"}`.

### Scenario: DB insert failure
- GIVEN the `inputs` insert throws via `.throwOnError()`
- WHEN the handler runs
- THEN it returns HTTP 500 `{error: "Internal Server Error"}`.

## Out of scope

- Public `setWebhook` registration endpoint (`/api/telegram/setup`) — see `deltas/telegram-loopback-and-setwebhook-removal`.
- Multi-tenant user resolution (single-user app; `userId` is always the local profile or `null`).
- Async background processing of `inputs` rows (the `processed` flag is reserved for future use; v1 only writes it as `false`).
- Webhook signature validation (Telegram's `X-Telegram-Bot-Api-Secret-Token` header) — the secret is shared in the query string for v1 simplicity.
- `deleteWebhook` failure handling (best-effort: a logged error is non-fatal).
