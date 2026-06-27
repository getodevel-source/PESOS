# Tasks: mvp-vida-core — Endurecer el MVP local-first

> **Strict TDD**: RED first, GREEN next. `npm test` per phase. Floor 13 → 22.
> **Sequence**: **Δ4 → Δ1 → Δ3 → Δ2**.

## Forecast

| Field | Value |
|-------|-------|
| Budget | 800 lines |
| Diff | ~470 (6 new + 5 mod) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

**Σ: 1 PR, +9 tests (13→22).** Per-delta: Δ4 ~80/+1, Δ1 ~110/+3, Δ3 ~90/+2, Δ2 ~190/+3.

## Phase 1 — Δ4 RLS rollback

- [x] **1.1 [RED]** New `src/test/rollback.test.ts`: file exists/non-empty/starts-with-`--`; every `CREATE|ALTER` in 7 originals matches a `DROP` regex. **Fails.**
- [x] **1.2 [GREEN]** New `supabase/migrations/00000000009999_rollback_strategy.sql`: re-apply header + reverse statements dep-order. **Passes.**
- [x] **1.3 [VERIFY]** `npm test` = 14 pass. Refactor SQL on regex miss.

## Phase 2 — Δ1 Telegram loopback + setWebhook removal

- [ ] **2.1 [RED]** New `src/app/api/telegram/setup/route.test.ts`: returns `{deprecated, message, username, name}`; `setWebhook` never called (mock `fetch`). **Fails.**
- [ ] **2.2 [GREEN]** Drop `setWebhook` fetch (lines 31-37) + `webhookUrl` in `setup/route.ts`; return deprecation JSON. **Passes.**
- [ ] **2.3 [RED]** Add 2 tests to `telegram/route.test.ts`: `loopback host accepted` (`Host: 127.0.0.1:3000` → 200) + `remote host rejected` (`Host: evil.example.com` → 403). **Fails.**
- [ ] **2.4 [GREEN]** Insert loopback guard at top of `telegram/route.ts` `POST` (before line 473): read `host` + `x-forwarded-for`; 403 unless loopback or `TELEGRAM_ALLOW_REMOTE=1`. `npm test` telegram = 10 pass.

## Phase 3 — Δ3 AI provider config

- [ ] **3.1 [RED]** New `src/lib/ai-config.test.ts` (2 tests): T1 write `{provider:'opencode'}` to tmp + `vi.spyOn(os, 'homedir')` → assert `provider==='opencode'`. T2 missing file → default `{provider:'gemini'}`, no throw. **Fails.**
- [ ] **3.2 [GREEN]** New `src/lib/ai-config.ts`: pure `getDefaultProvider(): AIConfig` reads `~/.config/pesos/.ai-config.json`; default on missing/bad/wrong-provider; never throws. **Passes.**
- [ ] **3.3 [GREEN]** Replace `provider = 'gemini'` at `ai-chat/route.ts:211` with `const cfg = getDefaultProvider(); const provider = bodyProvider ?? cfg.provider`. Add comment to `ai-chat/validate/route.ts`: "Δ3: 401 hard-fail; no cross-provider retry". `npm test` = 16 pass.
- [ ] **3.4 [GREEN]** Modify `telegram/route.ts:getAIResponse` (lines 124-163): accept `providerOverride?: AIProvider`; voice forces `gemini`; else `getDefaultProvider()` when no override.

## Phase 4 — Δ2 Dashboard auth gate

- [ ] **4.1 [RED]** New `src/app/api/auth/handshake/route.test.ts` (1 smoke): mock `auth-gate`; `Host: 127.0.0.1:3000` → 200 + `Set-Cookie: session=…; HttpOnly; SameSite=Lax`. **Fails.**
- [ ] **4.2 [GREEN]** New `src/lib/auth-gate.ts` (HMAC; secret at `~/.config/pesos/.auth-secret` `0o600`) + new `src/app/api/auth/handshake/route.ts` (loopback guard; cookie: `httpOnly:true, sameSite:'lax', path:'/', maxAge:86400`). **Passes.**
- [ ] **4.3 [RED]** New `src/proxy.test.ts` (2 tests): T1 no cookie + `/dashboard` → 307 to `/setup`. T2 valid cookie + `/dashboard` → `NextResponse.next()`. Allow-list `/_next/`, `/api/auth/handshake`, `/favicon.ico`, `/logo.png`. **Fails.**
- [ ] **4.4 [GREEN]** New `src/proxy.ts` (Next.js 16 `proxy` per `proxy.md:11` — NOT `middleware.ts`) + new `src/components/AuthGate.tsx` (client: on-mount POST to `/api/auth/handshake`). Modify `Dashboard.tsx` (drop `import AuthForm`, render `<AuthGate/>`). Modify `electron.js` (after `app.on('ready')`: `fetch('http://127.0.0.1:3000/api/auth/handshake', {method:'POST'})` with 3×1s retry). `npm test` = 22 pass.

## Out-of-scope follow-ups

1. `/api/sqlite` dead path (`supabase-client.ts:63, :106`) — v1.1.
2. `habits.title` vs `habits.name` drift — pre-existing.
3. Webhook secret in query string — fix with `X-Telegram-Bot-Api-Secret-Token` header.
4. Supabase Auth; multi-device/mobile/multi-tenant; new AI features; new installer; `test.yml` CI; `vite-tsconfig-paths`; `?force=1`; `psql --dry-run`.
