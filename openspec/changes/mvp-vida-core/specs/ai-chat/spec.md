# `ai-chat` Specification

## Purpose

The web chat panel streams a conversational reply from the configured AI provider. The reply uses a Spanish-Argentine "Pesito" persona and is enriched with the user's local context (tasks, habits, transactions last 30 days, upcoming reminders, monthly budget). The assistant never invents numbers and never writes code.

## Requirements

### Requirement 1 — Server-Sent Events stream

`POST /api/ai-chat` MUST return a `text/event-stream` whose chunks are `data: {"text":"..."}\n\n` lines, terminated by `data: [DONE]\n\n`. The response MUST set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`.

- Reference: `src/app/api/ai-chat/route.ts:267-356`.

### Requirement 2 — Provider is explicit

The route MUST require an explicit `provider` in the request body, value `gemini` or `opencode`. Any other value MUST return HTTP 400 `{error: "Proveedor de IA no soportado."}`.

- Reference: `src/app/api/ai-chat/route.ts:211, 358`.

### Requirement 3 — Persona + guardrails in the system prompt

The system prompt MUST include:

- The "Pesito" persona, Spanish-Argentine informal voice, concision, and motivation.
- An explicit no-code guardrail: the assistant MUST decline to write HTML, CSS, JS, Python, React, or any other code and MUST limit its scope to Pesos productivity data.
- The user's most recent context block (built by `buildUserContext`) — when a `userId` is supplied.

- Reference: `src/app/api/ai-chat/route.ts:249-265` + `buildUserContext` at 33-205.

### Requirement 4 — Provider routing

- When `provider === 'gemini'`, the route MUST use the `@google/generative-ai` SDK with the key from `x-google-api-key` header (preferred) or `process.env.GOOGLE_AI_API_KEY` (fallback).
- When `provider === 'opencode'`, the route MUST use the `openai` SDK against `https://opencode.ai/zen/go/v1` with the key from `x-opencode-api-key` (preferred) or `process.env.OPENCODE_GO_API_KEY` (fallback).

- Reference: `src/app/api/ai-chat/route.ts:218-303, 305-355`.

### Requirement 5 — Monthly-budget alerts in context

When `monthlyBudgetLimit > 0` and the user has consumed ≥75% of that limit, the system prompt MUST include a `⚠️ ADVERTENCIA: …` line. When consumption is ≥100%, it MUST be replaced with `⚠️ ALERTA CRÍTICA: …`.

- Reference: `src/app/api/ai-chat/route.ts:179-191`.

### Requirement 6 — 401 hard-fail (no silent fallback)

A 401 from the chosen provider's SDK MUST surface to the client (HTTP 500 with the SDK message). The route MUST NOT catch the 401 and silently retry with the other provider's key. (See `ai-provider-config` for the shared contract.)

## Scenarios

### Scenario: Gemini streams a reply
- GIVEN a valid Gemini key
- WHEN `/api/ai-chat` is POSTed with `provider: 'gemini'`
- THEN the response is `text/event-stream` containing `data: {"text":"..."}` chunks followed by `data: [DONE]`.

### Scenario: OpenCode streams a reply
- GIVEN a valid OpenCode key
- WHEN `/api/ai-chat` is POSTed with `provider: 'opencode'`
- THEN the response is `text/event-stream` with the same chunk format.

### Scenario: Unsupported provider
- GIVEN `provider: 'claude'`
- WHEN called
- THEN the route returns HTTP 400 `{error: "Proveedor de IA no soportado."}`.

### Scenario: Missing key
- GIVEN `provider: 'gemini'` and no key (header or env)
- WHEN called
- THEN the route returns HTTP 400 `{error: "API key de Google no configurada…"}`.

### Scenario: Context block included
- GIVEN a `userId` with two tasks and one habit
- WHEN called
- THEN the system prompt includes those tasks and the habit under the labeled sections (`TAREAS PENDIENTES DE HOY`, `HÁBITOS DEL DÍA`).

### Scenario: Budget critical alert
- GIVEN `monthlyBudgetLimit=1000` and 100% spent
- WHEN called
- THEN the system prompt contains `⚠️ ALERTA CRÍTICA`.

### Scenario: Budget warning alert
- GIVEN `monthlyBudgetLimit=1000` and 80% spent
- WHEN called
- THEN the system prompt contains `⚠️ ADVERTENCIA` and not `ALERTA CRÍTICA`.

### Scenario: 401 hard-fail
- GIVEN Gemini returns 401
- WHEN called
- THEN the response is HTTP 500 with the SDK error and the OpenCode key is NOT tried.

## Out of scope

- Image input, function calling, structured output, MCP, or any other tool/feature beyond text streaming.
- Multi-user identity (the `userId` is a string forwarded by the client; the route does not own authentication — see `dashboard-auth`).
- Persistent chat history (the client keeps the message list in React state in `src/components/ChatBot.tsx`).
- Per-user model fine-tuning.
- Token-counting / cost tracking.
