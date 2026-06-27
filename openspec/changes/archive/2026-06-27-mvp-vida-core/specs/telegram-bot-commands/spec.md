# `telegram-bot-commands` Specification

## Purpose

The Telegram bot exposes a fixed command surface (`/start`, `/ayuda`, `/help`, `/tareas`, `/habitos`, `/finanzas`, `/resumen`, `/agregar`, `/gasto`, `/ingreso`) plus a free-text AI flow. Commands and the AI flow can trigger a financial transaction confirmation handshake.

## Requirements

### Requirement 1 — Command parsing

The route handler MUST parse messages that start with `/` and dispatch them to `handleCommand(command, args, userId, chat_id)`. Parsing MUST:

- Split the message text on the first whitespace.
- Lowercase the command token.
- Strip an optional `@botname` suffix (e.g. `/tareas@mi_bot` is treated as `/tareas`).
- Pass the remainder of the message as `args`.

- Reference: `src/app/api/telegram/route.ts:531-535`.

### Requirement 2 — Help commands are account-free

`/start`, `/ayuda`, and `/help` MUST each return a Telegram message that lists the available commands, and MUST NOT require a resolved `userId`.

- Reference: `src/app/api/telegram/route.ts:224-240`.

### Requirement 3 — Per-user commands short-circuit on missing account

`/tareas`, `/habitos`, `/finanzas`, `/resumen`, `/agregar`, `/gasto`, `/ingreso` MUST each operate on the resolved user's local data. If `userId` is `null`, the command MUST short-circuit with a localized "no encontré tu cuenta" notice and MUST NOT touch the database.

- Reference: `src/app/api/telegram/route.ts:242-457` (each command's first `if (!userId)` branch).

### Requirement 4 — `/gasto` and `/ingreso` argument shape

`/gasto` and `/ingreso` MUST parse `args` with the regex `/^([\d.,]+)\s*(usd|u\$d|ars|\$)?\s+(.+)$/i`. A missing currency MUST be treated as `ars`. NaN amounts and amounts ≤ 0 MUST be rejected with a usage message. The transaction's `amount` MUST be persisted in ARS (USD inputs are converted via the MEP rate — see `exchange-rate`).

- Reference: `src/app/api/telegram/route.ts:374-456`.

### Requirement 5 — Free-text AI flow + `CONFIRM_TX` marker

Free-text messages (no leading `/`) MUST be routed through `getAIResponse` with the user context. The handler MUST recognize the `CONFIRM_TX: { amount, currency, description, type }` marker on the first line of the reply; the parsed JSON MUST be persisted to `profiles.pending_transaction` and the marker MUST be stripped from the user-visible reply.

- Reference: `src/app/api/telegram/route.ts:656-680`.
- The default currency for AI-interpreted transactions is ARS unless the user explicitly says USD / dólares / u$d.

### Requirement 6 — Confirmation / cancellation handshake

When a `pending_transaction` is present and the next free-text message matches the confirmation set (`si`, `sí`, `confirmar`, `confirmado`, `confirmó`, `dale`, `ok`, `yes`, `de una`, `sisi`, `procede`), the handler MUST commit the transaction and clear `pending_transaction`. When the message matches the cancellation set (`no`, `cancelar`, `cancela`, `cancel`, `nono`, `cancela el gasto`, `cancela la transaccion`), the handler MUST clear `pending_transaction` without committing. Any other free-text message received while a `pending_transaction` exists MUST clear it (avoid stale state).

- Reference: `src/app/api/telegram/route.ts:544-617`.

## Scenarios

### Scenario: `/tareas` lists pending
- GIVEN a resolved `userId` with two pending tasks
- WHEN `/tareas` is processed
- THEN the response lists both tasks with their times (when `due_date` is set).

### Scenario: `/tareas` without an account
- GIVEN `userId` is `null`
- WHEN `/tareas` is processed
- THEN the response is `⚠️ No encontré tu cuenta…` and no database query is issued.

### Scenario: `/gasto` ARS
- GIVEN `/gasto 1500,50 nafta`
- WHEN processed
- THEN a transaction with `amount=1500.50`, `type='expense'`, description `nafta`, and `transaction_date = today` is inserted.

### Scenario: `/gasto` USD with live rate
- GIVEN `/gasto 10 usd netflix` and a live MEP `venta=1200`
- WHEN processed
- THEN the inserted `amount` is `12000.00` ARS, the description includes `(USD 10 @ $1.200)`, and the response shows the rate detail.

### Scenario: `/gasto` invalid format
- GIVEN `/gasto 10` (missing description)
- WHEN processed
- THEN no transaction is inserted and the response shows the usage example.

### Scenario: `CONFIRM_TX` persists
- GIVEN a free-text AI reply contains a `CONFIRM_TX: { amount: 6000, currency: "ARS", description: "nafta", type: "expense" }` first line
- WHEN processed
- THEN `profiles.pending_transaction` is updated to that JSON and the user-facing reply has the `CONFIRM_TX` block stripped.

### Scenario: `CONFIRM_TX` confirms
- GIVEN a pending transaction exists and the user replies `dale`
- WHEN processed
- THEN a row is inserted into `transactions` and `pending_transaction` is cleared.

### Scenario: `CONFIRM_TX` cancels
- GIVEN a pending transaction exists and the user replies `no`
- WHEN processed
- THEN `pending_transaction` is cleared and no row is inserted; the reply is `❌ Registro cancelado.`

### Scenario: `pending_transaction` cleared by a non-yes/no message
- GIVEN a pending transaction exists and the user sends `¿cuánto gasté hoy?`
- WHEN processed
- THEN `pending_transaction` is cleared before the AI reply is generated.

### Scenario: `@botname` suffix ignored
- GIVEN the message `/tareas@mi_bot hola`
- WHEN parsed
- THEN the dispatched command is `/tareas` and `args` is `hola`.

## Out of scope

- Inline-keyboard callback handling (the route only acts on `message` / `edited_message` / `callback_query.message` first message text).
- Per-user rate limiting.
- Multi-language command aliases beyond the existing list.
- Custom user-defined commands.
- A `/cancelar` alias (cancellation is purely free-text).
