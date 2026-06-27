# `exchange-rate` Specification

## Purpose

A small, cached endpoint that exposes the Dólar MEP `compra` and `venta` for ARS↔USD conversion in the Telegram bot and dashboard. The bot uses a direct (uncached, fail-fast) helper for the same rate; the dashboard uses the cached endpoint.

## Requirements

### Requirement 1 — Cached endpoint shape

`GET /api/exchange-rate` MUST return JSON with `compra: number`, `venta: number`, `fechaActualizacion: string`, and a `cached: boolean` flag. The shape MUST match the `dolarapi.com` response (`{ compra, venta, moneda, casa, fechaActualizacion }`) with `moneda` / `casa` fields elided.

- Reference: `src/app/api/exchange-rate/route.ts:1-50`.

### Requirement 2 — Upstream + cache TTL

The endpoint MUST fetch from `https://dolarapi.com/v1/dolares/mep` with `Accept: application/json` and MUST cache the result in-process for 5 minutes (TTL). The cache is module-scoped and survives across requests within the same Node process.

- Reference: `src/app/api/exchange-rate/route.ts:6-7, 18-21, 30-36`.

### Requirement 3 — Failure modes

- On upstream failure with no cached value, the route MUST return HTTP 503 `{error: "No se pudo obtener el tipo de cambio MEP. Intentá de nuevo."}`.
- On upstream failure with a cached value, the route MUST return the cached value with `cached: true, stale: true` and HTTP 200.

- Reference: `src/app/api/exchange-rate/route.ts:38-50`.

### Requirement 4 — Telegram helper

The shared helper `getMepRate()` in `src/app/api/telegram/route.ts` MUST return `{ compra, venta } | null` (no caching, no stale fallback) for the bot's USD conversion path. A `null` return MUST cause the bot to reply with the localized "no se pudo obtener la cotización del dólar MEP" error.

- Reference: `src/app/api/telegram/route.ts:188-200`.

### Requirement 5 — USD conversion semantics

The Telegram `gasto` / `ingreso` flow MUST use `venta` for expenses and `compra` for incomes when converting USD → ARS. The free-text AI confirmation handshake MUST use the same rule (`type === 'expense'` → `venta`, otherwise `compra`).

- Reference: `src/app/api/telegram/route.ts:411-419, 561-570`.

## Scenarios

### Scenario: Fresh fetch on empty cache
- GIVEN the in-process cache is empty
- WHEN `/api/exchange-rate` is called
- THEN the response is `{compra, venta, fechaActualizacion, cached: false}` and the cache is populated.

### Scenario: Cache hit within TTL
- GIVEN the cache was populated < 5 minutes ago
- WHEN `/api/exchange-rate` is called
- THEN the response is `{..., cached: true}` and no upstream call is made.

### Scenario: Upstream 5xx with empty cache
- GIVEN the cache is empty and `dolarapi.com` returns 5xx
- WHEN `/api/exchange-rate` is called
- THEN the response is HTTP 503 with the localized error.

### Scenario: Upstream 5xx with cache
- GIVEN the cache is populated and `dolarapi.com` returns 5xx
- WHEN `/api/exchange-rate` is called
- THEN the response is HTTP 200 with the cached values and `stale: true`.

### Scenario: `getMepRate` returns null on failure
- GIVEN `dolarapi.com` is unreachable
- WHEN the Telegram bot converts a USD amount
- THEN `getMepRate()` returns `null` and the bot replies with the localized "no se pudo obtener la cotización" error.

### Scenario: USD expense uses `venta`
- GIVEN a USD expense and `venta=1200`
- WHEN converted
- THEN the stored `amount` is `usd_amount * 1200` and the description includes `(USD <usd> @ $1.200)`.

### Scenario: USD income uses `compra`
- GIVEN a USD income and `compra=1180`
- WHEN converted
- THEN the stored `amount` is `usd_amount * 1180`.

## Out of scope

- Other dollar quotes (blue, oficial, contado con liqui) — MEP only.
- Crypto / euro / other currencies.
- Persisting the rate to disk between process restarts.
- Historical rate queries.
- A change-detection / push channel (the endpoint is pull-only).
