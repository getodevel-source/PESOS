# Proposal: mvp-vida-core — Endurecer el MVP local-first

## Intent
Pesos v1 is a local-first personal OS (hábitos, finanzas, productividad, Telegram bot) running as a working Electron 42 + Next.js 16 + better-sqlite3 + Gemini/OpenCode stack. The product is real but **the definition of "v1" is not written down**. This change declares the source of truth (code as-built + specs that close the gaps) and ships the smallest set of hardening work that turns a working prototype into a shippable v1. No new features.

## Direction (a) — Ship the local-first MVP
- **What it means:** Declare the v1 contract: what is stable, what is supported, what is explicitly out of scope. Close the four hard-gaps that block a v1 cut.
- **What it does NOT mean:** Migration to real Supabase, multi-device sync, mobile, multi-tenant, new installer flow, new distribution channel. Deferred.

## Assumptions (sensible defaults — user can flip at review)

1. **Telegram single source of truth = local poll (Electron-driven).**
   - **Default:** Keep `electron.js` `startTelegramPoll()` and remove the `setWebhook` registration from `src/app/api/telegram/setup/route.ts`. `/api/telegram` route handler binds to loopback only; public `setWebhook` is deprecated.
   - **Override:** Keep `setWebhook` as the supported path (requires public hostname + HTTPS — heavier infra).
2. **Dashboard auth gate = local-only, single-user, via Electron IPC handshake.**
   - **Default:** New `/api/auth/handshake` route exchanges a local secret for a short-lived HttpOnly cookie. No Supabase Auth, no password, no OAuth.
   - **Override:** Add a real password flow / Supabase Auth.
3. **AI provider selection = user-chosen default in settings UI; fall-back only on hard 4xx/5xx (NOT on 401).**
   - **Default:** Settings UI persists provider choice + key to `~/.config/pesos/.ai-config.json`. `src/app/api/ai-chat/route.ts` and `src/app/api/telegram/route.ts` read the explicit default. 401 is a hard-fail (no silent fallback that hides wrong-key bugs).
   - **Override:** Keep current env-driven implicit selection (Gemini first, OpenCode fallback).
4. **RLS rollback = documented SQL file `supabase/migrations/00000000009999_rollback_strategy.sql`.**
   - **Default:** Reverse migrations for every policy in `20260616000000` through `20260626000005`, plus a re-apply script. Required by `rules.proposal`.
   - **Override:** Skip (not recommended — would violate `openspec/config.yaml`).
5. **Test floor = ≥ 20 tests under strict TDD.**
   - **Default:** Add ~7 tests: 2 Telegram ingestion (local-poll entry + loopback guard), 2 dual-AI provider selection, 1 Electron IPC handshake smoke, 1 AI key validation error path, 1 RLS rollback SQL parse. All RED→GREEN.
   - **Override:** Keep at 13 (would weaken the v1 bar).

## What changes (v1 deltas, by area)
- **Telegram ingestion** — `src/app/api/telegram/setup/route.ts`: drop `setWebhook` registration. `src/app/api/telegram/route.ts`: bind to `127.0.0.1` (loopback guard).
- **Dashboard auth** — new `src/app/api/auth/handshake/route.ts`, `src/middleware.ts`, `src/lib/auth-gate.ts`, `src/components/AuthGate.tsx`. `electron.js` calls handshake on window-ready.
- **AI provider config** — new `src/lib/ai-config.ts`. `src/app/api/ai-chat/route.ts` and `src/app/api/telegram/route.ts` use the explicit default. `src/app/api/ai-chat/validate/route.ts` validates the chosen provider only.
- **RLS rollback** — new `supabase/migrations/00000000009999_rollback_strategy.sql` (or `.md` companion).
- **Test floor** — 7 new tests across existing + new test files.
- **Specs** — write `openspec/specs/*/spec.md` documenting the as-built surface (see Capabilities).

## What does NOT change (explicit non-goals)
- Multi-device sync, real cloud Supabase, mobile, multi-tenant
- Public Telegram webhook (deprecated by this change — see Assumption 1)
- New installer / distribution channel — `install.sh` + electron-builder GitHub Releases stay
- New AI features (image upload, function calling, MCP, etc.)
- Schema additions to the data model

## Scope / first slice (priority order)
1. RLS rollback SQL + tests (unblocks the rest per `rules.proposal`).
2. Telegram single-source-of-truth + loopback guard + tests.
3. AI provider config + key validation + tests.
4. Dashboard auth gate + handshake + tests.
5. Specs for the as-built surface (pure documentation).
6. Test floor raise to ≥ 20 (rolled in with each item; do not bundle).

## Approach
- Keep the local-first architecture. Do not add infra.
- Drive every change under strict TDD (`apply.tdd: true`, `npm test` green before merge).
- Specs are written **after** the as-built surface is captured in code comments / type signatures, then deltas document the gap closures. Specs mirror reality.
- All artifacts go through `npm test` + `npm run lint`; no new CI in this slice.

## Capabilities (contract with sdd-spec)
`openspec/specs/` is empty; every capability listed is **new** (full spec). One delta capability captures the gap-closure deltas.

### New Capabilities
- `telegram-ingestion`: local-poll-only ingestion, user resolution by `telegram_chat_id` / `telegram_username`, loopback guard, command dispatch.
- `dashboard-auth`: local-only single-user auth gate via Electron IPC handshake, HttpOnly session cookie, lockout recovery.
- `ai-provider-config`: explicit user-chosen default, persistent storage in `~/.config/pesos/.ai-config.json`, key validation, no silent 401 fallback.
- `telegram-bot-commands`: `/start`, `/ayuda`, `/tareas`, `/habitos`, `/finanzas`, `/resumen`, `/agregar`, `/gasto`, `/ingreso`, free-text AI flow with `CONFIRM_TX` handshake.
- `ai-chat`: streaming chat (Gemini / OpenCode Go), Spanish-Argentine system prompt, user-context enrichment, no-code guardrail.
- `telegram-voice-transcription`: Gemini multimodal path for voice notes, base64 download from Telegram, prompt instruction.
- `exchange-rate`: Dólar MEP fetch from `dolarapi.com`, ARS ↔ USD conversion for transactions.
- `rpg-progression`: XP, levels, streaks, achievements (`checkAndUnlockAchievements`), XP hooks on `habit_logs` / `journal_entries` / `tasks`.
- `data-model-rls`: Postgres schema (`profiles`, `tasks`, `habits`, `habit_logs`, `transactions`, `journal_entries`, `user_stats`, `achievements`, `user_achievements`, `inputs`) + RLS policies + SQLite mirror + `00000000009999_rollback_strategy.sql`.
- `desktop-runtime`: Electron main process, Next.js child process, tray icon, auto-update via `updater.js`, update trigger file watcher.

### Modified Capabilities
- None. `openspec/specs/` is empty, so all changes are captured in the new capability specs above. The Telegram single-source-of-truth and AI provider default changes are delta facts inside the new specs, not in a separate `MODIFIED` block.

## Affected areas (forward-looking)

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/telegram/setup/route.ts` | Modified | Drop `setWebhook` registration; return deprecation note. |
| `src/app/api/telegram/route.ts` | Modified | Loopback guard (reject non-`127.0.0.1` requests). |
| `src/app/api/auth/handshake/route.ts` | New | IPC handshake endpoint. |
| `src/middleware.ts` | New | Auth gate for dashboard routes. |
| `src/lib/auth-gate.ts` | New | Session cookie verification helper. |
| `src/lib/ai-config.ts` | New | Reads `~/.config/pesos/.ai-config.json`. |
| `src/app/api/ai-chat/route.ts` | Modified | Use `ai-config` for provider default. |
| `src/app/api/ai-chat/validate/route.ts` | Modified | Validate the *chosen* provider only. |
| `src/components/AuthGate.tsx` | New | Gate UI. |
| `electron.js` | Modified | Call handshake on window-ready. |
| `supabase/migrations/00000000009999_rollback_strategy.sql` | New | Reverse migrations. |
| `src/app/api/telegram/route.test.ts` | Modified | +2 tests (loopback guard, local-poll entry). |
| `src/app/api/auth/handshake/route.test.ts` | New | 1 smoke test. |
| `src/lib/ai-config.test.ts` | New | 2 tests (default selection, missing-file fallback). |
| `supabase/migrations/rollback.test.ts` | New | 1 SQL parse test. |
| `openspec/specs/*/spec.md` | New (10 files) | Document as-built surface. |
| `openspec/changes/mvp-vida-core/specs/*/spec.md` | New (deltas) | Delta specs for gap closures. |

## Risks and rollback

| Risk | Likelihood | Mitigation / Rollback |
|------|------------|-----------------------|
| **Telegram local-poll deprecation of `setWebhook` breaks dev/web installs** | Medium | Keep `setWebhook` callable via hidden `?force=1` flag; document in README. Rollback: re-enable registration. |
| **RLS migration regression ships to v1 users** | Low (no real Supabase yet) | `00000000009999_rollback_strategy.sql` provides re-applyable reverse script. RLS isn't enforced at runtime (SQLite adapter), so risk is forward-looking. |
| **Auth gate UX locks user out** | Medium | Single-user, single-secret. Lockout recovery: `rm ~/.config/pesos/.auth-cookie && restart`. Covered by unit test. |
| **AI provider key validation surfaces false negatives (transient network)** | Low | Validation hits cheapest endpoint of chosen provider only. 5s timeout. 401 is hard-fail (no silent fallback). |
| **Test floor raise is below 20** | Low | Each gap-closure item is gated on its test. Dropped test ⇒ task not `done`. |
| **Loopback guard on `/api/telegram` breaks ngrok/cloudflared tunnels** | Low | Document in README. Override: `TELEGRAM_ALLOW_REMOTE=1` env var. |

## Dependencies
- Existing Electron + Next.js + better-sqlite3 stack (no new packages).
- No new infra. No new external services.
- Existing test runner (Vitest 4) — no new test framework.

## Success criteria
- [ ] `npm test` exits 0 with **≥ 20 tests, 0 failing** (currently 13/13).
- [ ] `supabase/migrations/00000000009999_rollback_strategy.sql` exists and is parseable.
- [ ] Public `setWebhook` registration is gone (or hidden behind `?force=1`); loopback guard enforced.
- [ ] AI provider default is explicit (read from `ai-config.ts`, not env-var order).
- [ ] Dashboard enforces a local auth gate; loopback access without a session is rejected.
- [ ] `openspec/specs/` contains at least the 10 capability specs listed above.
- [ ] `npm run lint` and `npx tsc --noEmit` exit 0.

## Out of scope follow-ups (deferred)
- Migration to real Supabase (Postgres + Auth) — separate change after v1 ships.
- Multi-device sync, mobile, multi-tenant accounts.
- New AI features (image, function calling, MCP, structured output).
- New installer / distribution (Flatpak, Snap, MSIX).
- CI test workflow (`.github/workflows/test.yml`).
- Migrate `vite-tsconfig-paths` to native `resolve.tsconfigPaths: true` (cosmetic, already non-blocking per `sdd-init/pesos.md`).

## Open questions (orchestrator may route back to user at review)
1. **Auth gate model** — Local IPC handshake (default) vs. password vs. nothing? Affects ~3 files of the slice.
2. **Public `setWebhook` removal** — Remove outright (default) or keep callable with a `?force=1` opt-in? Affects 1 line of the setup route + README.
3. **Test floor** — 20 tests (default) is the floor; user can raise to 30+ if they want stricter coverage before v1.
