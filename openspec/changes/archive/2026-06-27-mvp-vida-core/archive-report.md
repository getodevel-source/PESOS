# Archive Report — `mvp-vida-core`

**Change**: `mvp-vida-core` — Endurecer el MVP local-first
**Archived**: 2026-06-27
**Verdict**: PASS WITH WARNINGS — 0 CRITICAL, 2 WARNING, 3 SUGGESTION
**Mode**: Strict TDD (enforced during apply)

---

## Change summary

`mvp-vida-core` declares the v1 contract for the local-first Pesos desktop
app and ships the four gap-closure deltas that turn a working prototype
into a shippable v1. **Δ1** drops public `setWebhook` registration and
binds `/api/telegram` to loopback (with `TELEGRAM_ALLOW_REMOTE=1`
opt-in). **Δ2** gates every dashboard route behind an HttpOnly session
cookie issued by a new `/api/auth/handshake` endpoint and verified by
Next.js 16 `proxy.ts`. **Δ3** replaces env-var-order provider selection
with an explicit user-chosen default in
`~/.config/pesos/.ai-config.json` (401 is a hard-fail). **Δ4** adds a
re-applyable reverse SQL file
(`supabase/migrations/00000000009999_rollback_strategy.sql`) for the
seven originals. No new features, no schema additions, no infra.

## What changed (file plan + final state)

| Path | Action | Spec / Δ | Final state |
|------|--------|----------|-------------|
| `src/proxy.ts` | **NEW** | Δ2 | Created. Next.js 16 `proxy` (not `middleware.ts`); gates `/dashboard/*` via session cookie; allow-lists `/_next/`, `/api/auth/handshake`, `/favicon.ico`, `/logo.png`. |
| `src/app/api/auth/handshake/route.ts` | **NEW** | Δ2 | Created. Loopback-only POST; reads `~/.config/pesos/.auth-secret` (HMAC key, 0o600); sets `session` HttpOnly cookie (24h, SameSite=Lax). |
| `src/lib/auth-gate.ts` | **NEW** | Δ2 | Created. `signSession()` / `verifySession()` use `crypto.timingSafeEqual` (constant-time). |
| `src/lib/ai-config.ts` | **NEW** | Δ3 | Created. `getDefaultProvider()` reads `~/.config/pesos/.ai-config.json`; never throws; defaults to `{provider:'gemini'}`. |
| `src/components/AuthGate.tsx` | **NEW** | Δ2 | Created. Client belt-and-suspenders handshake fetch (covers dev mode where Electron handshake didn't fire). |
| `supabase/migrations/00000000009999_rollback_strategy.sql` | **NEW** | Δ4 | Created. 69 lines. Re-apply header lists 7 originals in chronological order; reverse DROP statements in dependency order; CASCADE on every DROP TABLE. |
| `src/app/api/telegram/route.ts` | **MODIFIED** | Δ1 | Loopback guard added at top of `POST` (before line 473); 403 unless `127.0.0.1`/`::1`/`localhost` or `TELEGRAM_ALLOW_REMOTE=1`. URL-host fallback for dev tests. |
| `src/app/api/telegram/setup/route.ts` | **MODIFIED** | Δ1 | `setWebhook` fetch (lines 31-37) removed; endpoint now returns `{deprecated: true, message, username, name}`. |
| `src/app/api/ai-chat/route.ts` | **MODIFIED** | Δ3 | `provider = 'gemini'` body default replaced with `bodyProvider ?? cfg.provider` (line 220). |
| `src/app/api/ai-chat/validate/route.ts` | **MODIFIED** | Δ3 | 1-line comment added asserting 401 hard-fail (no cross-provider retry). |
| `src/components/Dashboard.tsx` | **MODIFIED** | Δ2 | Wrapped in `<AuthGate>` (lines 388, 964). `AuthForm` was never imported by the current Dashboard — no-op deviation. |
| `electron.js` | **MODIFIED** | Δ2 | `attemptHandshake()` added (3×1s retry); called via `setTimeout(..., 4000)` after `app.on('ready')`. |
| `src/app/api/telegram/route.test.ts` | **MODIFIED** | Δ1 | +2 tests: `loopback host accepted` (200), `remote host rejected` (403). |
| `src/test/rollback.test.ts` | **NEW** | Δ4 | 143 lines. Reads rollback + 7 originals; uses `buildDropRegex()` to verify a matching DROP for every CREATE/ALTER. Stricter than the design's original sketch (handles `CREATE OR REPLACE FUNCTION`, `CREATE POLICY "name"`). |
| `src/app/api/telegram/setup/route.test.ts` | **NEW** | Δ1 | Mocks `fetch`; asserts `setWebhook` is not called and the response shape is `{deprecated, message, username, name}`. |
| `src/lib/ai-config.test.ts` | **NEW** | Δ3 | 2 tests: explicit override honored + missing-file default. |
| `src/app/api/auth/handshake/route.test.ts` | **NEW** | Δ2 | 1 smoke. Asserts 200 + Set-Cookie attributes (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=86400`). |
| `src/proxy.test.ts` | **NEW** | Δ2 | 2 tests: redirect to `/setup` without cookie, pass-through with valid cookie (assertion quality noted as SUGGESTION S1). |

**Total**: 9 new files (5 source + 4 test), 5 modified, 0 deleted (legacy `sdd/` migration handled separately as a rename, not a delete).

**Test count**: 13 → 22 (above the 20-test floor; +9 new tests, 5 baseline untouched).

## What is now stable

The 10 capability specs are promoted to the canonical
`openspec/specs/{capability}/spec.md` tree as the v1 source of truth:

- `ai-chat` — Spanish-Argentine "Pesito" persona, no-code guardrail, monthly-budget alerts.
- `ai-provider-config` — explicit user-chosen default persisted in `~/.config/pesos/.ai-config.json`; 401 hard-fail.
- `dashboard-auth` — local-only single-user auth via Electron IPC handshake + HttpOnly cookie; lockout recovery by `rm .auth-secret + restart`.
- `data-model-rls` — Postgres schema + RLS + SQLite mirror + rollback file; 7 originals + 1 reverse.
- `desktop-runtime` — Electron main, Next.js child, tray, auto-update, handshake trigger.
- `exchange-rate` — Dólar MEP fetch from `dolarapi.com`.
- `rpg-progression` — XP / levels / streaks / achievements with XP hooks.
- `telegram-bot-commands` — `/start`, `/ayuda`, `/tareas`, `/habitos`, `/finanzas`, `/resumen`, `/agregar`, `/gasto`, `/ingreso`, free-text.
- `telegram-ingestion` — local-poll only; loopback-bound route; `setWebhook` deprecated.
- `telegram-voice-transcription` — Gemini multimodal path; voice forces Gemini (per Δ3 deviation).

The change-dir copies under
`openspec/changes/archive/2026-06-27-mvp-vida-core/specs/` are retained
as the change audit trail. The 4 gap-closure deltas in
`specs/deltas.md` are preserved as the v1 contract history.

## Verification

Copied verbatim from `verify-report.md`:

> **Verdict**: PASS WITH WARNINGS
> Reason: All 4 deltas are implemented to spec; 22/22 tests pass;
> `tsc --noEmit` is clean; the 0 critical issues + 2 warnings + 3
> suggestions are all defense-in-depth improvements, not blocking
> defects. The implementation correctly closes the 4 hard-gaps called
> out in the proposal (RLS rollback, Telegram loopback, explicit AI
> provider, dashboard auth gate).

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 0 | — |
| WARNING  | 2 | W1 `TELEGRAM_ALLOW_REMOTE=1` opt-in has no dedicated test · W2 Dashboard handshake's "remote → 403" scenario not tested |
| SUGGESTION | 3 | S1 `proxy.test.ts` "passes through" assertion is negative-only · S2 No E2E smoke for the Electron → handshake → cookie → dashboard flow · S3 AuthGate `useEffect` triggers cascading renders (React lint error) |

The 2 WARNINGs and 3 SUGGESTIONs are **non-blocking** and are tracked
as follow-ups below. They are NOT remediated in this archive.

## Open follow-ups

### Pre-existing bugs flagged by sdd-spec (NOT addressed by this change)

1. **`/api/sqlite` dead path** — `src/lib/supabase-client.ts:63, :106`
   call `fetch('/api/sqlite', ...)` but
   `src/app/api/sqlite/route.ts` does NOT exist. Every component
   using `createClient()` (`Dashboard`, `HabitList`, `TaskList`,
   `DietLog`, `JournalReflection`, `TransactionSummary`, `ChatBot`)
   hits a 404. Components still render because the mock chain's
   `.then` swallows the error. Tracked for v1.1.
2. **`habits.title` vs `habits.name` column drift** — code reads
   `name` (`src/app/api/ai-chat/route.ts:51`,
   `src/app/api/telegram/route.ts:58, :278`) but schema and SQLite
   adapter both use `title`. Pre-existing, NOT addressed.
3. **Webhook secret in query string** — `electron.js:99` sends the
   bot token via `?secret=` to `route.ts:470`. Should use
   Telegram's `X-Telegram-Bot-Api-Secret-Token` header. Tracked in
   `telegram-ingestion` spec's "Out of scope".

### Verify WARNINGs (defense-in-depth gaps)

4. **W1** — Add a unit test that explicitly verifies
   `TELEGRAM_ALLOW_REMOTE=1` lifts the loopback guard on
   `/api/telegram`. The implementation is correct; a regression that
   broke the opt-in would not be caught today.
5. **W2** — Add a unit test for the handshake route's remote → 403
   path. Only the success case is tested; the rejection path is
   silent.

### Verify SUGGESTIONs (style / future hardening)

6. **S1** — Strengthen `proxy.test.ts:35-50` "passes through"
   assertion from `location ?? '' not.toContain('/setup')` to
   `response.status === 200` or assert `NextResponse.next()`.
7. **S2** — Add an end-to-end smoke for the Electron → handshake →
   cookie → dashboard flow (Playwright or Electron harness).
8. **S3** — Fix `src/components/AuthGate.tsx:31` (move `setReady(true)`
   into the effect body or use `useLayoutEffect`) to clear the
   `react-hooks/set-state-in-effect` lint error.

### Proposal's out-of-scope follow-ups (deferred)

9. Migration to real Supabase / Auth (separate change after v1).
10. Multi-device sync, mobile, multi-tenant.
11. New AI features (image, function calling, MCP, structured output).
12. New installer / distribution (Flatpak, Snap, MSIX).
13. CI test workflow (`.github/workflows/test.yml`).
14. `vite-tsconfig-paths` → native `resolve.tsconfigPaths: true`
    (cosmetic; vitest still prints deprecation notice on every run).
15. `?force=1` escape hatch for `setWebhook` (deferred per Δ1 edge
    cases).
16. `psql --dry-run` harness for the rollback file (would need a
    Postgres test container).

## Commit graph

```
0fe88eb docs: mvp-vida-core apply-progress (22/22, 4 phases complete)
7fe9105 feat(Δ2): dashboard auth gate via Next.js 16 proxy + handshake (22/22)
adb2992 feat(Δ3): explicit AI provider config + 401 hard-fail (19/19)
7a67ee6 feat(Δ1): Telegram loopback guard + drop setWebhook (17/17)
26cfd85 feat(Δ4): RLS rollback SQL + parse-completeness test (14/14)
f1b6bd9 fix(tests): scope vitest to src/ and stub AI client modules
```

(Archive commits added by `sdd-archive` are appended below this
graph — they are NOT part of the change's runtime contract.)

## SDD cycle complete

The change has been fully:

- **Planned** (proposal, 10 capability specs, 4 gap-closure deltas, design, 15 tasks).
- **Implemented** (9 new files, 5 modified, strict TDD across 4 phases; 22/22 tests passing; `tsc --noEmit` clean).
- **Verified** (independent review by `sdd-verify`; 0 CRITICAL, 2 WARNING, 3 SUGGESTION; all design decisions followed; 3 design-accepted deviations explicitly disclosed in `apply-progress.md`).
- **Archived** (canonical `openspec/specs/` baseline promoted; change folder moved to `openspec/changes/archive/2026-06-27-mvp-vida-core/`; this report + the Engram record `sdd/mvp-vida-core/archive-report` close the cycle).

Ready for the next change.
