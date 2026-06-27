# Design: `mvp-vida-core` — Endurecer el MVP local-first

## 1. Architecture overview

Pesos v1 is a single-user, local-first Electron 42 + Next.js 16 desktop app. The
Electron main process (`electron.js`) is the only entry point: it spawns
`next start -H 127.0.0.1 -p 3000` as a child and opens a `BrowserWindow`
pointing at `http://localhost:3000`. Next.js binds to **loopback only**; the
only remote-capable surface is `/api/telegram` (Telegram's `deleteWebhook` +
local long-poll driven by `electron.js:64-113`), gated by an env opt-out
`TELEGRAM_ALLOW_REMOTE=1`. State lives in `~/.config/pesos/`:
`pesos.db` (SQLite mirror via `src/lib/sqlite-db.ts`), `.env.local` (API keys,
per `electron.js:14-33`), `.ai-config.json` (NEW — explicit AI provider
default), `.auth-secret` (NEW — handshake secret), `.update-pending`
(existing, per `electron.js:191-211`). The dual AI surface (`/api/ai-chat`
streaming, `/api/telegram` free-text) is wired against both `@google/generative-ai`
and `openai` SDKs, but **user selection is now explicit via `ai-config.ts` —
not env-var order** (proposal Assumption 3). Single-user; no Supabase Auth;
no password; no multi-tenant runtime. The Postgres schema in
`supabase/migrations/` is forward-looking only — the running app talks to
SQLite. RLS rollback (Delta 4) is the safety net for the day a real Supabase
backend gets cut over.

```
Electron main (electron.js)
  ├─ spawn  next start -H 127.0.0.1 -p 3000          (line 45)
  ├─ poll   getUpdates 30s   → POST /api/telegram?secret=…  (line 99)
  ├─ POST   /api/auth/handshake (NEW)                (after ready, line 213)
  ├─ startUpdateMonitor (.update-pending poll)       (line 192)
  └─ Tray + BrowserWindow (localhost:3000)           (line 115-189)
                       │
                       ▼
Next.js 16 (App Router, loopback-bound)
  ├─ src/proxy.ts           (gates /dashboard/*  via AuthGate cookie)  NEW
  ├─ src/middleware.ts      (DEPRECATED in v16 — see §4 risks)         NOT NEW
  ├─ /api/telegram          (loopback guard + secret check)            MODIFIED
  ├─ /api/telegram/setup    (deprecation note; no setWebhook)          MODIFIED
  ├─ /api/auth/handshake    (loopback, sets HttpOnly session cookie)   NEW
  ├─ /api/ai-chat           (uses ai-config default)                   MODIFIED
  ├─ /api/ai-chat/validate  (chosen provider only — already correct)   (no change)
  └─ /api/exchange-rate     (unchanged)                                —
                       │
                       ▼
  src/lib/ai-config.ts (NEW) → reads ~/.config/pesos/.ai-config.json
  src/lib/auth-gate.ts (NEW) → cookie verify helper
  src/lib/sqlite-db.ts        → MOCK_USER_ID 00000000-… schema mirror
```

## 2. File plan

| Path | Action | Purpose | Spec / Δ | Test plan |
|---|---|---|---|---|
| `src/proxy.ts` | **New** | Next.js 16 `proxy` (renamed from `middleware` — see §4) — gates `/dashboard/*` by session cookie; allow-list `/api/auth/handshake`, `/_next/*`, `/api/telegram` | Δ2 (dashboard-auth) | `src/proxy.test.ts` (NEW) — `redirects unauth`, `passes auth`, `allows handshake` |
| `src/middleware.ts` | **Removed from plan** | Per Next.js 16 docs the `middleware` file convention is deprecated → renamed `proxy` (v16.0.0) | Δ2 | n/a — flag in §4 |
| `src/app/api/auth/handshake/route.ts` | **New** | POST handler — loopback-only; reads/writes `~/.config/pesos/.auth-secret`; sets `session` HttpOnly cookie | Δ2 | `src/app/api/auth/handshake/route.test.ts` (NEW, 1 smoke) |
| `src/lib/auth-gate.ts` | **New** | `verifySession(cookie)` HMAC check vs `.auth-secret`; pure function (no IO) | Δ2 | covered transitively by `src/proxy.test.ts` |
| `src/lib/ai-config.ts` | **New** | `getDefaultProvider()` reads `~/.config/pesos/.ai-config.json`; defaults `{provider:'gemini'}` on missing/unparseable; never throws | Δ3 | `src/lib/ai-config.test.ts` (NEW, 2 tests) |
| `src/components/AuthGate.tsx` | **New** | Client gate: shows "open the app" hint, triggers a client fetch to `/api/auth/handshake` if cookie missing | Δ2 | not unit-tested (covered by E2E shell); smoke is the handshake test |
| `src/components/Dashboard.tsx` | **Modified** | Remove import of `AuthForm.tsx`; render `<AuthGate/>` only | Δ2 | `grep -n AuthForm src/components/Dashboard.tsx` in CI (lint) |
| `src/components/AuthForm.tsx` | **Removed from tree** | Email/password form no longer rendered in dashboard (file kept on disk per proposal for backward-search but not imported) | Δ2 | n/a — verify with import check |
| `electron.js` | **Modified** | After `startNextServer()` resolves + `mainWindow.loadURL` succeeds, call `fetch('http://127.0.0.1:3000/api/auth/handshake', { method:'POST', headers:{'X-Pesos-Secret': SECRET} })` with up-to-3 retries × 1s backoff; reads `.auth-secret` (generate if missing) | Δ2 | smoke in `src/app/api/auth/handshake/route.test.ts`; `electron.js` change is integration-level |
| `src/app/api/telegram/route.ts` | **Modified** | At the top of `POST` (before `secret !== token` at line 473), add `if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && process.env.TELEGRAM_ALLOW_REMOTE !== '1') return 403`. `remoteAddr = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.ip` — but per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-request.md` `request.ip` was **removed in v15.0.0**; so use the loopback-host header or a Next.js-internal `request.headers.get('host')` match against `127.0.0.1:3000` as the practical signal in dev/prod, with `x-forwarded-for` honored only when `TELEGRAM_ALLOW_REMOTE=1` | Δ1 | `src/app/api/telegram/route.test.ts` (+2 tests) |
| `src/app/api/telegram/setup/route.ts` | **Modified** | Replace the `setWebhook` fetch (lines 31-37) with a JSON response `{ deprecated: true, message: "Use electron local-poll (see startTelegramPoll).", botUsername, botFirstName }`; keep `getMe` validation | Δ1 | `src/app/api/telegram/setup/route.test.ts` (NEW, 1 test) |
| `src/app/api/ai-chat/route.ts` | **Modified** | At line 211, replace `provider = 'gemini'` body default with `const cfg = await getDefaultProvider(); const provider = body.provider ?? cfg.provider`. Stream / error paths unchanged. **401 stays a hard-fail** — no try-catch around the SDK call that retries OpenCode on Gemini 401 (matches Δ3 requirement) | Δ3 | covered by `ai-config.test.ts` + existing `route.test.ts` (no real network) |
| `src/app/api/telegram/route.ts` `getAIResponse` (line 124-163) | **Modified** | Accept `providerOverride?: 'gemini'\|'opencode'`; when not provided, resolve via `getDefaultProvider()`. Preserve the voice-data path: if `userMessage` is non-string, **always route to Gemini** (per `telegram-voice-transcription` spec) regardless of default — that's a voice-only exception, documented in the design but not in Δ3 | Δ3 | covered by `ai-config.test.ts` (config) + `route.test.ts` (voice path stays) |
| `src/app/api/ai-chat/validate/route.ts` | **Modified** (no behavior change) | Add a comment block referencing Δ3 requirement: "do not add cross-provider retry on failure" | Δ3 | existing test still green |
| `supabase/migrations/00000000009999_rollback_strategy.sql` | **New** | Reverse every CREATE/ALTER/POLICY/TRIGGER/FUNCTION from `20260616000000..20260626000005` in dependency order. Re-apply header (comment block). See §3 Delta 4 for the wire shape | Δ4 | `supabase/migrations/rollback.test.ts` (NEW, 1 SQL parse) |
| `src/app/api/telegram/route.test.ts` | **Modified** | +2 tests: `loopback request accepted` (host `127.0.0.1:3000`), `remote request rejected` (host `evil.example.com`) | Δ1 | self |
| `src/lib/ai-config.test.ts` | **New** | 2 tests: `reads .ai-config.json provider override`, `missing file → default {provider:'gemini'}` | Δ3 | self |
| `src/app/api/auth/handshake/route.test.ts` | **New** | 1 smoke: `loopback + correct secret → 200 + Set-Cookie` | Δ2 | self |
| `supabase/migrations/rollback.test.ts` | **New** | 1 test: rollback file exists, non-empty, starts with comment, every CREATE in originals has matching DROP | Δ4 | self |
| `src/app/api/telegram/setup/route.test.ts` | **New** | 1 test: POST returns `{ deprecated: true, … }` and does not call `setWebhook` (mock `fetch` with `vi.fn()`) | Δ1 | self |
| `vitest.config.ts` | **Modified** | `include` already scoped to `src/**` (per `f1b6bd9`); no further change unless `rollback.test.ts` is moved under `src/test/` (see Δ4) | — | — |

**Total**: 6 new files (incl. tests), 5 modified, 0 deleted. Test floor: **+7 new tests** (2 Telegram + 1 setup + 1 handshake + 2 ai-config + 1 rollback) bringing the suite from 13 → 20.

## 3. The 4 delta designs

### Δ1 — `telegram-loopback-and-setwebhook-removal`

**Goal**: make `/api/telegram` reject non-loopback callers unless explicitly opted in; remove public `setWebhook` registration.

**Before / after**:
- Before: `src/app/api/telegram/route.ts:467-475` accepts any host with `?secret=<token>`. `src/app/api/telegram/setup/route.ts:31-37` calls `setWebhook` against `<origin>/api/telegram`.
- After: `/api/telegram` returns 403 on non-loopback host (unless `TELEGRAM_ALLOW_REMOTE=1`). `/api/telegram/setup` returns `{deprecated: true, …}`; no `setWebhook` call.

**Implementation outline**:
```ts
// src/app/api/telegram/route.ts — new top of POST (before line 473)
const host = request.headers.get('host') ?? ''
const xff = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
const isLoopback = host.startsWith('127.0.0.1') || host.startsWith('[::1]') || xff === '127.0.0.1' || xff === '::1'
if (!isLoopback && process.env.TELEGRAM_ALLOW_REMOTE !== '1') {
  return new NextResponse('Forbidden: loopback only', { status: 403 })
}
```
> The `host` header is the only reliable loopback signal available after `request.ip` was removed in Next.js v15 (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-request.md` line 119). `x-forwarded-for` is only honored when the operator opts in to remote.

`src/app/api/telegram/setup/route.ts:31-37`:
```ts
// REMOVE: const setWebhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, …)
// REPLACE WITH:
return NextResponse.json({
  deprecated: true,
  message: 'Public setWebhook is disabled. The Telegram bot is polled locally by electron.js (startTelegramPoll). Restart the desktop app to recover.',
  username: botUsername,
  name: botFirstName,
})
```

`electron.js:74-83` already calls `deleteWebhook` once on startup — no change.

**Edge cases**:
- Host header is missing (defensive): treat as not-loopback → 403.
- `x-forwarded-for` is `127.0.0.1` but the actual connection is remote (proxy-spoofed): only relevant when `TELEGRAM_ALLOW_REMOTE=1`; documented.
- `?force=1` opt-in: proposal §1 allows `?force=1` to re-enable `setWebhook`. We do NOT implement this for v1 (out of scope; `?force=1` is an escape hatch for a future change).
- Setup route is called by `SetupWizard.tsx`; that flow must now show the deprecation message and guide the user to restart the desktop app (covered in `SetupWizard.tsx` UI, not in the scope of this design — flag for the apply phase).

**Test scenarios** (from `deltas.md`):
| Given/When/Then | Vitest file | Test name |
|---|---|---|
| Loopback request accepted | `src/app/api/telegram/route.test.ts` | `loopback host accepted` — `host: '127.0.0.1:3000'` → 200 |
| Remote request rejected | same | `remote host rejected` — `host: 'evil.example.com'` → 403 (regardless of secret) |
| `TELEGRAM_ALLOW_REMOTE=1` opt-in | same | `remote allowed with env opt-in` — `host: 'evil.example.com', TELEGRAM_ALLOW_REMOTE=1` → 200 |
| `setWebhook` not called | `src/app/api/telegram/setup/route.test.ts` (NEW) | `setup returns deprecation and never calls setWebhook` — `vi.spyOn(global, 'fetch')` to count calls |
| Electron clears stale webhook | covered by existing code; **no new test** (smoke would require Electron harness) | — |

### Δ2 — `dashboard-auth-gate`

**Goal**: gate every dashboard route behind a local-only IPC handshake that sets an HttpOnly session cookie.

**Before / after**:
- Before: `/dashboard/*` is reachable on `http://localhost:3000` without auth. `src/components/Dashboard.tsx:5` imports and renders `AuthForm.tsx` (email/password). No `src/middleware.ts`.
- After: every request to `/dashboard/*` without a valid `session` cookie redirects (HTTP 307) to `/setup`. The handshake endpoint mints the cookie. Electron's main process calls the handshake after `next start` is up, so the cookie is set before the BrowserWindow loads.

**Implementation outline**:
- `src/proxy.ts` (Next.js 16 — see §4 risk; the proposal's "middleware.ts" must be renamed to `proxy.ts` per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11`):
  ```ts
  import { NextResponse, type NextRequest } from 'next/server'
  import { verifySession } from '@/lib/auth-gate'

  export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    if (
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/api/auth/handshake') ||
      pathname === '/favicon.ico' ||
      pathname === '/logo.png'
    ) return NextResponse.next()

    if (!pathname.startsWith('/dashboard')) return NextResponse.next()

    const cookie = request.cookies.get('session')?.value
    if (cookie && verifySession(cookie)) return NextResponse.next()
    return NextResponse.redirect(new URL('/setup', request.url), 307)
  }

  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
  }
  ```
- `src/lib/auth-gate.ts`:
  ```ts
  import crypto from 'crypto'
  import fs from 'fs'
  import path from 'path'
  import os from 'os'

  const SECRET_PATH = path.join(os.homedir(), '.config', 'pesos', '.auth-secret')

  export function getOrCreateSecret(): string {
    try {
      if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim()
    } catch { /* fall through */ }
    const s = crypto.randomBytes(32).toString('hex')
    fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true })
    fs.writeFileSync(SECRET_PATH, s, { mode: 0o600 })
    return s
  }

  export function signSession(): string {
    return crypto.createHmac('sha256', getOrCreateSecret()).update('pesos-session-v1').digest('hex')
  }

  export function verifySession(cookie: string): boolean {
    try { return crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(signSession())) }
    catch { return false }
  }
  ```
- `src/app/api/auth/handshake/route.ts` (NEW):
  ```ts
  import { NextResponse, type NextRequest } from 'next/server'
  import { signSession } from '@/lib/auth-gate'

  export async function POST(request: NextRequest) {
    const host = request.headers.get('host') ?? ''
    const isLoopback = host.startsWith('127.0.0.1') || host.startsWith('[::1]')
    if (!isLoopback && process.env.TELEGRAM_ALLOW_REMOTE !== '1') {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set('session', signSession(), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24, // 24h
    })
    return res
  }
  ```
  > Per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md:150-194`, cookies are set via `response.cookies.set()` in Route Handlers. `httpOnly: true` is the project AGENTS.md default for session cookies; `SameSite=Lax` is sufficient for the local-only origin (no cross-site).
- `electron.js` change in the `app.on('ready')` block (after `createWindow()` at line 215):
  ```js
  // Call the handshake so the BrowserWindow's first load already has a session cookie.
  const attemptHandshake = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await fetch('http://127.0.0.1:3000/api/auth/handshake', { method: 'POST' })
        if (r.ok) return
      } catch { /* next start not up yet */ }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  if (!isDev) setTimeout(attemptHandshake, 4000)  // after the 3s Next.js boot delay + 1s slack
  ```
- `src/components/Dashboard.tsx`: remove `import AuthForm from './AuthForm'`; remove the conditional render; render `<AuthGate/>` instead.
- `src/components/AuthGate.tsx` (NEW): minimal client component — calls `fetch('/api/auth/handshake', {method:'POST'})` on mount as a belt-and-suspenders for the case where the Electron handshake failed (e.g. dev mode). Renders children when the response is 200.

**Edge cases**:
- Lockout: `rm ~/.config/pesos/.auth-secret && restart` → Electron regenerates a new secret → handshake signs with the new one → cookie is fresh. The `verifySession` HMAC check naturally invalidates the old cookie.
- Multiple `BrowserWindow`s share the cookie store (per Electron docs).
- `TELEGRAM_ALLOW_REMOTE=1` lifts the loopback gate (documented in README) — used for ngrok tunnels during dev.
- `request.ip` was removed in Next.js 15 (per `next-request.md:119`) → `host` header is the loopback signal.
- Set-Cookie during streaming is forbidden per `cookies.md:73`; handshake is non-streaming, safe.
- Cookie `maxAge: 86400` (24h) per the spec's "8-24 hours" guidance.

**Test scenarios**:
| Given/When/Then | Vitest file | Test name |
|---|---|---|
| Unauthenticated dashboard request redirects | `src/proxy.test.ts` (NEW) | `redirects to /setup without session cookie` |
| Authenticated dashboard request passes | same | `passes with valid session cookie` |
| Handshake loopback-only | `src/app/api/auth/handshake/route.test.ts` (NEW) | `loopback + correct host → 200 + Set-Cookie session=…; HttpOnly; SameSite=Lax` |
| Handshake success on loopback | same | (same test, assert 200) |
| Electron triggers handshake on ready | (integration) — flag for sdd-verify; not a vitest case | — |
| Lockout recovery | covered by `getOrCreateSecret` regenerating on missing file; not a separate test (covered by `auth-gate.ts` behavior) | — |
| Legacy `AuthForm` is not in the tree | grep/lint check in CI | — |

### Δ3 — `ai-provider-config-and-key-validation`

**Goal**: replace env-var-order provider selection with an explicit user-chosen default in `~/.config/pesos/.ai-config.json`; 401 stays a hard-fail.

**Before / after**:
- Before: `src/app/api/ai-chat/route.ts:211` defaults `provider = 'gemini'`. `src/app/api/telegram/route.ts:128-145` does `if (GOOGLE_AI_API_KEY) … else if (OPENCODE_GO_API_KEY) …` — implicit order.
- After: `getDefaultProvider()` from `src/lib/ai-config.ts` is the single source of truth (except in the voice path, which is Gemini-only per `telegram-voice-transcription`).

**Implementation outline**:
- `src/lib/ai-config.ts` (NEW):
  ```ts
  import fs from 'fs'
  import path from 'path'
  import os from 'os'

  export type AIProvider = 'gemini' | 'opencode'
  export interface AIConfig { provider: AIProvider; googleApiKey?: string; opencodeApiKey?: string; model?: string }

  const CONFIG_PATH = path.join(os.homedir(), '.config', 'pesos', '.ai-config.json')
  const DEFAULT: AIConfig = { provider: 'gemini' }

  export function getDefaultProvider(): AIConfig {
    try {
      if (!fs.existsSync(CONFIG_PATH)) return DEFAULT
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
      const parsed = JSON.parse(raw) as Partial<AIConfig>
      if (parsed.provider !== 'gemini' && parsed.provider !== 'opencode') return DEFAULT
      return { provider: parsed.provider, googleApiKey: parsed.googleApiKey, opencodeApiKey: parsed.opencodeApiKey, model: parsed.model }
    } catch { return DEFAULT }  // never throws — explicit per spec
  }
  ```
- `src/app/api/ai-chat/route.ts:211`:
  ```ts
  const { messages, userId, provider: bodyProvider, model: modelName, monthlyBudgetLimit } = await request.json()
  const cfg = getDefaultProvider()
  const provider = bodyProvider ?? cfg.provider
  // …unchanged validation, unchanged streaming
  ```
- `src/app/api/telegram/route.ts:124-163` `getAIResponse`: accept `providerOverride?: AIProvider`. When `userMessage` is non-string (voice), force Gemini. When `providerOverride` is undefined, resolve via `getDefaultProvider()`. The 401 surface is unchanged: any `throw` from `generateContent` / `chat.completions.create` propagates up to the outer `try/catch` at line 687, which returns 500. No silent retry to the other provider.
- `src/app/api/ai-chat/validate/route.ts`: no behavior change. Add a code comment: `// Per spec: do NOT add cross-provider retry on 401. The 401 hard-fails here so wrong-key bugs surface.` The existing test (8 tests in `route.test.ts`) covers this; we add a 1-line comment.

**Edge cases**:
- File exists but `provider` is `'claude'` (unsupported): `getDefaultProvider` returns the default `{provider:'gemini'}`. The `/api/ai-chat` route then validates `provider === 'gemini'|'opencode'` and returns 400 (existing behavior, line 358).
- File exists but JSON is malformed: `try/catch` returns the default.
- File exists but the chosen provider's key is missing: the route already returns 400 ("API key no configurada") — no change.
- `/api/telegram` `getAIResponse` is called from BOTH the command path (`/resumen`) and the free-text path. Both must use the explicit default.
- 401 from Gemini must not silently retry with OpenCode key — explicitly removed in this delta.

**Test scenarios**:
| Given/When/Then | Vitest file | Test name |
|---|---|---|
| Explicit default honored | `src/lib/ai-config.test.ts` (NEW) | `reads provider override from .ai-config.json` — write `{provider:'opencode'}` to a temp HOME, assert `getDefaultProvider().provider === 'opencode'` |
| Missing config file → graceful default | same | `missing file returns {provider:'gemini'}` |
| Validate-only-chosen-provider | covered by existing `route.test.ts` (no change) | — |
| 401 hard-fail in `/api/ai-chat` | covered by existing test; new comment asserts intent | — |
| 401 hard-fail in `/api/telegram` | covered by existing `route.test.ts` (Gemini mock throws) | — |
| Telegram free-text uses explicit default | covered transitively by `ai-config.test.ts` | — |

> **TDD note**: `getDefaultProvider()` is a pure function parameterized by `os.homedir()`. The test must monkey-patch `os.homedir()` (via `vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)`) or use `process.env.HOME` indirection. Follow the pattern in the existing `src/app/api/telegram/route.test.ts` (`vi.resetAllMocks()` in `beforeEach`).

### Δ4 — `rls-rollback-strategy`

**Goal**: a re-applyable reverse SQL file + 1 test that asserts completeness.

**Before / after**:
- Before: 6 migrations exist (`20260616000000..20260626000005`). No rollback path. `rules.proposal` requires it.
- After: `supabase/migrations/00000000009999_rollback_strategy.sql` reverses every CREATE/ALTER/POLICY/TRIGGER/FUNCTION in dependency order, with a re-apply header.

**Implementation outline** — the file structure (not full content; generated by `sdd-apply`):
```sql
-- ─── ROLLBACK STRATEGY — mvp-vida-core ───────────────────────────────────────
-- Re-apply order (chronological): 20260616000000, 20260626000000,
--   20260626000001, 20260626000002, 20260626000003, 20260626000004, 20260626000005
-- Run on a Supabase project where those migrations have been applied.
-- This file DROPs in reverse dependency order; re-run the originals to re-apply.

-- 20260626000005 — drop journal_entries.metadata
ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS metadata;

-- 20260626000004 — drop check_and_unlock_achievements
DROP FUNCTION IF EXISTS public.check_and_unlock_achievements(uuid) CASCADE;
-- 20260626000004 — drop monthly_budget
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_budget;

-- 20260626000003 — drop triggers and helper functions
DROP TRIGGER IF EXISTS trigger_journal_xp_delete ON public.journal_entries;
DROP TRIGGER IF EXISTS trigger_journal_xp_insert ON public.journal_entries;
DROP FUNCTION IF EXISTS public.on_journal_entry_delete() CASCADE;
DROP FUNCTION IF EXISTS public.on_journal_entry_insert() CASCADE;
-- ('Primera Reflexión' / 'Cuerpo Consciente' / 'Racha de 7 días' / 'Mes en Verde' re-seeds
--  from 20260626000001 will be cleaned up by the user_achievements CASCADE in 20260626000001 rollback)

-- 20260626000002 — drop triggers and xp function
DROP TRIGGER IF EXISTS trigger_habit_log_xp ON public.habit_logs;
DROP TRIGGER IF EXISTS trigger_task_xp ON public.tasks;
DROP FUNCTION IF EXISTS public.on_habit_log_change() CASCADE;
DROP FUNCTION IF EXISTS public.on_task_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.add_user_xp(uuid, integer) CASCADE;

-- 20260626000001 — drop rpg_system (achievements, user_achievements, user_stats, policies)
DROP POLICY IF EXISTS "Users can read/write their achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Anyone can read achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.user_stats;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;

-- 20260626000000 — drop pending_transaction
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pending_transaction;

-- 20260616000000 — drop init_schema
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage their own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage their own inputs" ON public.inputs;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- DROP TABLE order respects FK: child tables first
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.inputs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
```

The test (`supabase/migrations/rollback.test.ts`):
```ts
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const ROLLBACK = path.join(__dirname, '00000000009999_rollback_strategy.sql')
const ORIGINALS = [
  '20260616000000_init_schema.sql',
  '20260626000000_add_pending_transaction.sql',
  '20260626000001_rpg_system.sql',
  '20260626000002_rpg_triggers.sql',
  '20260626000003_journal_xp_and_achievements.sql',
  '20260626000004_budget_and_achievements_check.sql',
  '20260626000005_add_journal_metadata.sql',
].map((f) => path.join(__dirname, f))

describe('rls rollback strategy', () => {
  it('exists, is non-empty, has a re-apply header, and drops everything originals create', () => {
    const text = fs.readFileSync(ROLLBACK, 'utf8')
    expect(text.trim().length).toBeGreaterThan(0)
    expect(text.startsWith('--')).toBe(true)                                     // re-apply header
    const originals = ORIGINALS.flatMap((p) => fs.readFileSync(p, 'utf8').split('\n'))
    const creates = originals.filter((l) => /^\s*(create|alter)\s+/i.test(l))
    for (const stmt of creates) {
      const head = stmt.match(/^\s*(create|alter)\s+(\w+)\s+(\w+)/i)
      if (!head) continue
      const verb = head[1].toLowerCase()
      const target = head[3].replace(/[^a-z0-9_]/gi, '')
      if (verb === 'create' && /^\s*insert\s/i.test(stmt)) continue             // seed INSERTs
      const dropRe = new RegExp(`drop\\s+${head[2]}\\s+(if exists\\s+)?${target}`, 'i')
      expect(text).toMatch(dropRe)
    }
  })
})
```
> The test lives in `supabase/migrations/`, which is OUTSIDE `vitest.config.ts`'s `include: ['src/**']` scope. **Two options** (decision flagged below):
> - **(a)** Move the test to `src/test/rollback.test.ts` and have it `fs.readFileSync` the absolute path via `path.join(__dirname, '..', '..', 'supabase', 'migrations', '00000000009999_rollback_strategy.sql')`. Stays under `src/`.
> - **(b)** Widen `vitest.config.ts` to `include: ['src/**', 'supabase/migrations/**/*.test.ts']` and add `supabase/migrations` to `exclude`'s sibling allow-list.
> **Recommendation (a)** — keeps `vitest.config.ts` untouched (avoids re-introducing the `dist/`-duplication class of bug fixed in `f1b6bd9`).
- **Test location decision**: `src/test/rollback.test.ts` reading from `supabase/migrations/` (option a).

**Edge cases**:
- `CASCADE` on every DROP TABLE handles the FK web. If a future migration adds a NEW FK, the rollback may silently CASCADE user data — that's a tradeoff; document in the file header.
- The `insert … on conflict do nothing` lines in `20260626000001`/`20260626000003` are data migrations, not schema — the rollback does NOT undo them (the user_achievements table is dropped, which clears them). Documented.
- `DROP POLICY IF EXISTS` is safe on a fresh DB.
- The test does NOT execute the SQL — it only asserts shape. A real `psql --dry-run` would be a follow-up (out of scope; current `sdd-init/pesos.md` lists no Postgres harness).

**Test scenarios** (from `deltas.md`):
| Given/When/Then | Vitest file | Test name |
|---|---|---|
| File exists and parses | `src/test/rollback.test.ts` (NEW) | `file is non-empty and starts with comment` |
| Every CREATE has a matching DROP | same | (covered by the single test above) |
| Dependency order respected | manual review; the test asserts the DROP statements exist (order is by code review) | — |
| Re-apply header present | same | (asserted in the same test) |
| Rollback policy is dropped | same | (the regex covers `create policy …` → `drop policy …`) |

## 4. Cross-cutting concerns

### 4.1 Multi-tenant / RLS strategy (required by `rules.design`)

**This is a single-user desktop app.** Multi-tenancy is **not** a runtime concern — the local SQLite mirror has one profile (`MOCK_USER_ID = '00000000-0000-0000-0000-000000000000'`, per `src/lib/sqlite-db.ts:7`) and all inserts hardcode it. There is no real `auth.users`; the `ServerMockSupabaseClient` in `src/lib/supabase.ts:91-101` returns a static mock user.

The Postgres schema in `supabase/migrations/` IS multi-tenant by design (RLS policies on every user-owned table — `20260616000000_init_schema.sql:73-102`, `20260626000001_rpg_system.sql:30-43`). This is **forward-looking**: when (if) the project migrates to real Supabase, the schema is ready; until then, RLS is dormant. The RLS rollback file (Δ4) is the safety net that lets the team reverse the schema if a Postgres cut-over goes wrong.

The v1 contract: SQLite = runtime truth; Postgres = forward-looking; `00000000009999_rollback_strategy.sql` = the day-1 escape hatch for the future Supabase migration.

### 4.2 Electron + Next.js SSR interaction (required by `rules.design`)

**Loopback binding**: `electron.js:44-50` spawns `next start -H 127.0.0.1 -p 3000`. Per `node_modules/next/dist/docs/01-app/02-guides/ai-agents.md` and the `route.md` API ref, Next.js's `next start` honors `-H` and `-p`; the doc explicitly notes cookies are set via the `Set-Cookie` header in route handlers, and `httpOnly: true` is the recommended pattern (`cookies.md:46-58`).

**No OS-level IPC channel needed.** The proposal's "IPC handshake" is implemented as an HTTP fetch from the Electron main process to `http://127.0.0.1:3000/api/auth/handshake` — both processes share the loopback interface, so a Unix domain socket or named pipe would only add complexity without adding security. The "secret" is the `.auth-secret` HMAC key, not an IPC channel. Rationale: Electron's `app.getPath('userData')` is for app-private data (DB, logs, caches), not for an IPC socket; the `os.homedir() + .config/pesos` location is the existing convention (`electron.js:14-33`, `electron.js:193`).

**Cookie attributes** (per `cookies.md:46-58`): `HttpOnly`, `SameSite=Lax` (the loopback origin never makes cross-site requests, so `Strict` is also fine — we pick `Lax` as the spec's "or stricter" floor), `Path=/`, `Max-Age=86400` (24h). `Secure` is intentionally NOT set because the loopback server is plain HTTP — the cookie is scoped to the loopback origin only.

**Race on Electron startup**: `electron.js:131-137` waits 3s before `mainWindow.loadURL`. The handshake call (`electron.js:215`, NEW) waits an additional 1s (3s + 1s slack) before the BrowserWindow's first navigation. The `AuthGate.tsx` belt-and-suspenders fetch covers the case where Electron's handshake didn't fire (dev mode).

**Middleware → Proxy rename**: per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11` and `:737-768` (Migration to Proxy), `middleware` is **DEPRECATED in v16.0.0** and renamed to `proxy`. The proposal says "new `src/middleware.ts`"; this design uses `src/proxy.ts` instead. **Critical: the codemod `npx @next/codemod@canary middleware-to-proxy .` would do this rename, but since the file doesn't exist yet, we just create the new name directly.** (Per `proxy.md:774`: "Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime.")

### 4.3 Secret storage

| File | Permissions | Owner | Purpose |
|---|---|---|---|
| `~/.config/pesos/.auth-secret` | `0o600` | Electron main | HMAC key for `session` cookie; generated on first launch via `crypto.randomBytes(32)` |
| `~/.config/pesos/.ai-config.json` | `0o600` (user) | Settings UI | `{provider, googleApiKey?, opencodeApiKey?, model?}` — explicit user-chosen default |
| `~/.config/pesos/.env.local` | existing | user (Setup Wizard) | `TELEGRAM_BOT_TOKEN`, `GOOGLE_AI_API_KEY`, `OPENCODE_GO_API_KEY` |
| `~/.config/pesos/pesos.db` | existing | better-sqlite3 | Local data mirror |
| `~/.config/pesos/.update-pending` | existing | `/api/update` | Update trigger file (Electron polls every 3s) |

All paths follow the existing convention from `electron.js:14-33` (`os.homedir() + '.config/pesos'`). No new directory structure.

### 4.4 Test strategy (strict TDD)

Test runner: Vitest 4.1.9 (per `openspec/sdd-init/pesos.md`). `npm test` is the canonical command; must stay green at all times. AI client modules (`openai`, `@google/generative-ai`) are mocked at the module level per the pattern in `src/app/api/telegram/route.test.ts:80-100` (the `f1b6bd9` fix). Test count floor: 13 → 20.

**7 new tests (RED first, then GREEN)**:
| # | File | Test |
|---|---|---|
| 1 | `src/app/api/telegram/route.test.ts` (modified) | `loopback host accepted` |
| 2 | same | `remote host rejected` |
| 3 | `src/app/api/telegram/setup/route.test.ts` (NEW) | `setup returns deprecation and never calls setWebhook` |
| 4 | `src/app/api/auth/handshake/route.test.ts` (NEW) | `loopback + correct host → 200 + Set-Cookie session=…; HttpOnly; SameSite=Lax` |
| 5 | `src/proxy.test.ts` (NEW) | `redirects to /setup without session cookie` |
| 6 | `src/proxy.test.ts` (NEW) | `passes with valid session cookie` |
| 7 | `src/lib/ai-config.test.ts` (NEW) | `reads provider override` + `missing file returns default` (= 2 tests in 1 file, total 8 new assertions; total 21 tests, satisfies ≥ 20 floor with margin) |
| 8 | `src/test/rollback.test.ts` (NEW) | `file exists, has header, every CREATE has matching DROP` (= 1 test) |

**New test total**: 8 distinct tests (counted in `npm test` output) + 1 setup test = **9 new tests**, bringing the suite from 13 → 22 (well above the 20 floor). The 8 vs 7 mismatch is fine — over-deliver vs the proposal's "7 new tests" floor.

**Mock pattern (locked, per `f1b6bd9`)**:
- `vi.mock('openai', () => { class OpenAI { … } return { default: OpenAI, OpenAI } })` — note: import is `import OpenAI from 'openai'` (default export).
- `vi.mock('@google/generative-ai', () => { class GoogleGenerativeAI { … } return { GoogleGenerativeAI } })` — note: import is `import { GoogleGenerativeAI } from '@google/generative-ai'` (named export).
- For new tests that need to control `os.homedir()` (the `ai-config.test.ts` case), use `vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)` and `vi.resetAllMocks()` in `beforeEach` (per the `route.test.ts:128` pattern).
- The rollback test does NOT need mocks — it only `fs.readFileSync`s.

**Test config**: `vitest.config.ts` is unchanged (`include: ['src/**']` from `f1b6bd9`). The rollback test lives at `src/test/rollback.test.ts` to stay in scope (option a from Δ4).

**Coverage**: not configured. Not a blocker; out of scope per `sdd-init/pesos.md:55`.

## 5. Sequencing and rollback

### 5.1 Sequencing (per proposal §"Scope / first slice")

1. **Δ4 RLS rollback** (FIRST). Reason: the proposal states RLS rollback "unblocks the rest per `rules.proposal`." It's also the only delta with zero runtime risk — pure SQL + a parse test.
2. **Δ1 Telegram loopback**. Touches the most security-sensitive code (the only externally-reachable route). Tests are mechanical.
3. **Δ3 AI provider config**. A pure-function module (`ai-config.ts`) plus a 1-line change in two route handlers. The TDD order is: write `ai-config.test.ts` (RED) → implement `ai-config.ts` (GREEN) → modify the two route handlers.
4. **Δ2 Dashboard auth gate**. Largest delta. The TDD order is: handshake route test (RED) → handshake route (GREEN) → `auth-gate.ts` → `proxy.ts` (renamed from `middleware.ts`) test (RED) → `proxy.ts` (GREEN) → Electron `electron.js` change (no test; verified at sdd-verify) → remove `AuthForm.tsx` from `Dashboard.tsx` (lint check).
5. **Spec docs are already done** (`openspec/changes/mvp-vida-core/specs/` and `deltas.md` written by `sdd-spec`).

### 5.2 Rollback per delta

- **Δ1**: revert `src/app/api/telegram/route.ts` (remove the loopback-guard block at the top of `POST`) and `src/app/api/telegram/setup/route.ts` (re-add the `setWebhook` fetch). Tests fail → revert is complete. No DB or schema impact.
- **Δ2**: delete `src/proxy.ts`, `src/lib/auth-gate.ts`, `src/app/api/auth/handshake/route.ts`, `src/components/AuthGate.tsx`. Re-add the `AuthForm` import to `Dashboard.tsx`. Revert `electron.js` (drop the `attemptHandshake` call). Tests fail (the deleted tests were already on the new module surface). No DB or schema impact.
- **Δ3**: delete `src/lib/ai-config.ts`. Revert `src/app/api/ai-chat/route.ts:211` to `provider = 'gemini'`. Revert `src/app/api/telegram/route.ts:getAIResponse` to the `if (GOOGLE_AI_API_KEY) … else if (OPENCODE_GO_API_KEY) …` chain. No DB or schema impact.
- **Δ4**: `DROP TABLE` is destructive but the rollback file is **forward-only** — it only DROPs, never CREATEs. To reverse the rollback file's application, re-run the originals in chronological order (the file's header documents this). No code rollback needed.

### 5.3 Out-of-scope follow-ups (confirmed from proposal)

- Migration to real Supabase / Auth (separate change after v1).
- Multi-device sync, mobile, multi-tenant.
- New AI features (image, function calling, MCP, structured output).
- New installer / distribution (Flatpak, Snap, MSIX).
- CI test workflow (`.github/workflows/test.yml`).
- `vite-tsconfig-paths` → native `resolve.tsconfigPaths: true` (cosmetic, non-blocking).
- `?force=1` escape hatch for `setWebhook` (deferred — see Δ1 edge cases).
- `psql --dry-run` harness for the rollback file (would need a Postgres test container).

## 6. Open questions

**None** — the user already confirmed all 5 assumptions in the launch prompt (loopback-only Telegram, local IPC handshake, explicit AI default, RLS rollback file, ≥ 20 tests). The `proxy.ts` vs `middleware.ts` rename is a **design decision documented above (§4.2)**, not an open question: the file is `proxy.ts` per Next.js 16.

---

## Appendix — Risks for the orchestrator (sdd-tasks phase)

1. **Next.js 16 `middleware` deprecation**: the proposal's "new `src/middleware.ts`" does NOT match Next.js 16 (renamed to `proxy.ts`). Apply phase must use `proxy.ts`. This is the single highest-risk design change vs. the proposal.
2. **`request.ip` was removed in v15.0.0** (`next-request.md:119`). The loopback guard must use the `host` header + opt-in `x-forwarded-for`. Documented in Δ1.
3. **Pre-existing bugs flagged by sdd-spec** (NOT fixed by this change; tracked as separate):
   - `/api/sqlite` is a dead path: `src/lib/supabase-client.ts:63` and `:106` call `fetch('/api/sqlite', ...)` but `src/app/api/sqlite/route.ts` does NOT exist. Every client component using `createClient()` from `@/lib/supabase-client` (`Dashboard.tsx`, `HabitList.tsx`, `TaskList.tsx`, `DietLog.tsx`, `JournalReflection.tsx`, `TransactionSummary.tsx`, `ChatBot.tsx`) hits a 404. The components still render because the mock chain's `.then` swallows the error. **The change does NOT touch this; tracked as a v1.1 follow-up.**
   - `habits.title` vs `habits.name` column drift: the code reads `name` (e.g. `src/app/api/ai-chat/route.ts:51`, `src/app/api/telegram/route.ts:58, :278`) but the schema and SQLite adapter both use `title`. The `data-model-rls` spec's "Out of scope" line item is correct: this is a pre-existing bug, NOT addressed by `mvp-vida-core`.
   - Webhook secret in query string (`electron.js:99` → `route.ts:470`): acknowledged in the `telegram-ingestion` spec's "Out of scope" (Telegram's `X-Telegram-Bot-Api-Secret-Token` header). Not addressed by this change.
4. **Test location for the rollback test** (option a in Δ4): `src/test/rollback.test.ts` reads from `supabase/migrations/`. If `vitest.config.ts` ever drops the `include: ['src/**']` scope (regression of the `f1b6bd9` fix), the rollback test will silently stop running. Consider adding a follow-up: an ESLint rule that bans widening `include` past `src/**`.
5. **The `auth-gate.ts` HMAC is single-key**: a 24h-TTL cookie signed with one secret. If the secret file is lost (`rm`), all cookies invalidate. Lockout recovery is `rm + restart` per the spec. This is the design's intentional single-user tradeoff.
6. **Voice → Gemini exception** in Δ3: when `userMessage` is non-string (voice), the function forces Gemini regardless of the user's default. This is per the `telegram-voice-transcription` spec ("OpenCode Go is text-only") but is NOT explicit in the proposal. If the user later wants voice via OpenCode, this design's behavior must change.
