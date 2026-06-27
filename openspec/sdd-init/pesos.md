# SDD Init Report — `pesos`

**Project**: `pesos` (Personal OS — habits, finances, productivity, Telegram bot)
**Workspace**: `/home/geto/Proyectos/PESOS`
**Date**: 2026-06-27 (re-verified 2026-06-27 after gatekeeper feedback; blocker resolved 2026-06-27 via commit `f1b6bd9`)
**Phase**: sdd-init
**Artifact store**: `hybrid` (engram + openspec)
**Strict TDD**: **enabled** (re-enabled 2026-06-27 — see "Resolved test issues" below)

---

## 1. Detected Stack

| Layer | Detected | Version / Notes |
| --- | --- | --- |
| Language | TypeScript | 5.x, `strict: true`, target ES2017 |
| Framework | Next.js (App Router) | 16.2.9 — newer than typical training data; per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing any Next.js code |
| UI | React + React DOM | 19.2.4 |
| Styling | Tailwind CSS 4 | via `@tailwindcss/postcss` PostCSS plugin |
| Desktop wrapper | Electron + electron-builder | Electron 42.5.0, builder 26.x, targets `nsis` (Win), `AppImage`/`deb` (Linux), `zip` (mac). `electron.js` is the entry, `updater.js` wires auto-update via `electron-builder` GitHub publish. `dist/linux-unpacked/` is the produced Linux build artifact (per `package.json` `build.directories.output`). |
| Database | Supabase (Postgres) + better-sqlite3 | hybrid; Supabase for auth/RLS/sync, SQLite as local mirror. `better-sqlite3` listed in `next.config.ts` `serverExternalPackages` |
| AI | OpenAI SDK 6.45.0 + `@google/generative-ai` 0.24.1 | both wired; user configures keys in Setup Wizard |
| Package manager | npm | `package-lock.json` present (382 KB); no yarn/pnpm lockfile |
| Lint | ESLint 9 (flat config) | `eslint-config-next` core-web-vitals + typescript |
| Type check | TypeScript 5 | `tsc` via `next build` |
| Format | none configured | no Prettier; tab/space convention not codified |
| CI | `.github/workflows/release.yml` | tag-triggered release build only; **no test workflow** |
| Module alias | `@/*` → `./src/*` | via `tsconfig.json` `paths` and `vite-tsconfig-paths` |
| Server externals | `better-sqlite3` | declared in `next.config.ts` |

### Conventions detected

- `AGENTS.md` (and `CLAUDE.md` which `@AGENTS.md`-includes) carries the Next.js 16 warning.
- `package.json` `private: true`, version `1.0.4`, author `getodevel`, repo `getodevel-source/PESOS`.
- App icon lives at `public/logo.png`; desktop targets reference it.
- Telegram bot endpoint lives at `src/app/api/telegram/route.ts` (webhook).
- Local SQLite DB path: `~/.config/pesos/pesos.db` (per README, never auto-deleted on uninstall).
- Electron entrypoint: `electron.js`. Auto-updater wired via `updater.js` (uses `electron-builder` GitHub publish).
- `src/lib/env-loader.ts` loads `.env.local` (Telegram, Supabase URL/keys) for both web and Electron processes.

---

## 2. Testing Capability

| Field | Value |
| --- | --- |
| Test runner | Vitest 4.1.9 |
| Test command | `npm test` (resolves to `vitest run`) |
| Watch command | `npx vitest` |
| Config | `vitest.config.ts` (node env, `globals: true`, `tsconfigPaths()` plugin) — `include: ['src/**']` and extended `exclude` set in `f1b6bd9` |
| Test file pattern | `include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)']` (set in `f1b6bd9`; replaces vitest 4 default `**/*.{test,spec}.?(c|m)[jt]s?(x)`) |
| Test file exclude | `['**/dist/**', '**/.next/**', '**/out/**', '**/coverage/**', '**/node_modules/**', '**/.git/**']` (set in `f1b6bd9`; replaces vitest 4 default `['**/node_modules/**', '**/.git/**']` which did **not** include `**/dist/**` — that omission was the root cause of the test-duplication issue) |
| Test files present (under `src/`) | `src/app/db-rls.test.ts` (5 tests, RLS smoke), `src/app/api/telegram/route.test.ts` (8 tests) |
| Test files actually executed by `npm test` | **2** — `src/app/db-rls.test.ts` (5 ✓), `src/app/api/telegram/route.test.ts` (8 ✓). **Total: 13 pass, 0 fail, 13 tests.** No `dist/` duplication. |
| Coverage tooling | not configured (no `--coverage` flag, no `c8`/`@vitest/coverage-*`) |
| Lint command | `npm run lint` (ESLint) |
| Type check command | `npx tsc --noEmit` (TypeScript strict) |
| Format command | not configured |

### Re-verification history

This report was corrected twice in the same day:

1. **First correction (2026-06-27, after gatekeeper feedback)** — `npm test` was re-run from a clean shell and found to be **red**:
   ```
   Test Files:  2 failed | 2 passed  (4)
   Tests:       4 failed | 22 passed  (26)
   Duration:    1.73s
   ```
   The four failing tests, quoted from that vitest run:
   1. `src/app/api/telegram/route.test.ts > Telegram Webhook Route Handler > should process payload and assign user_id if profile is found by chat_id`
      `AssertionError: expected 500 to be 200 // Object.is equality` — at `src/app/api/telegram/route.test.ts:172`
   2. `src/app/api/telegram/route.test.ts > Telegram Webhook Route Handler > should process payload, assign user_id and update chat_id if profile is found by username`
      `AssertionError: expected 500 to be 200 // Object.is equality` — at `src/app/api/telegram/route.test.ts:215`
   3. and 4. the same two tests re-run from `dist/linux-unpacked/resources/app/src/app/api/telegram/route.test.ts` (same assertions, same lines 172 and 215).

   The underlying error in all four cases was the same. The route handler at `src/app/api/telegram/route.ts:152` (`getAIResponse`) called the OpenAI SDK against a real endpoint and the API returned `401 Model opencode-go/deepseek-v4-flash is not supported`. The test mocked `@/lib/supabase` (database) but did **not** mock the OpenAI client, so the network call leaked through. The earlier init's claim that `db-rls.test.ts` was green was correct, but `npm test` overall was red. That finding flipped `strict_tdd` to `false` and added a `strict_tdd_blocker:` field.

2. **Second correction (2026-06-27, this re-init)** — commit `f1b6bd9` fixed both issues (see §7.1). `npm test` was re-run during this re-init and is now **green**:
   ```
   Test Files  2 passed (2)
        Tests  13 passed (13)
     Duration  2.08s
   ```
   All 13 tests run from `src/` only — no `dist/` paths in the output. This finding flips `strict_tdd` back to `true` and clears the blocker.

### Strict TDD verdict (re-enabled)

`strict_tdd: true` — `npm test` is the canonical test command and it exits 0 with 13/13 passing. The two issues that had flipped strict_tdd off (test duplication in `dist/`, real OpenAI call from a unit test) are both resolved by `f1b6bd9`. `apply.tdd: true` in `openspec/config.yaml` re-enables the RED-GREEN-REFACTOR requirement for `sdd-apply`. Full resolution record in §7.1.

### Limits / gaps

- Coverage threshold not set; no coverage tool wired.
- No E2E runner (Playwright, Cypress, etc.) installed.
- CI only runs on `v*` tag pushes for release builds — **no PR-level test gate**.
- Only ~2 test files exist under `src/`; component and integration coverage is shallow.
- The `vite-tsconfig-paths` plugin is **deprecated by Vitest 4** in favor of native `resolve.tsconfigPaths: true` (Vitest prints a deprecation notice at startup). Not a blocker, but worth a follow-up cleanup.
- Test count is still small (13 across 2 files). Green status is the floor — there's plenty of headroom to add coverage before TDD becomes a real constraint.

---

## 3. Persistence Setup

- **Mode**: `hybrid` (engram + openspec)
- **Engram project**: `pesos` (auto-detected from git remote `getodevel-source/PESOS`)
- **OpenSpec root**: `openspec/` (created by this phase)

### Files / artifacts created by `sdd-init`

| Path / Topic | Purpose |
| --- | --- |
| `openspec/config.yaml` | Project config: stack, conventions, phase rules. `strict_tdd: true` + `apply.tdd: true` re-enabled 2026-06-27 after `f1b6bd9` |
| `openspec/sdd-init/pesos.md` | This report (file mirror) |
| Engram `sdd-init/pesos` | This report (working memory) — updated 2026-06-27 (re-init) with the resolved test status |
| Engram `sdd/pesos/testing-capabilities` | Standalone testing capability record — updated 2026-06-27 (re-init) with the resolved verdict |
| Engram `skill-registry` | Snapshot of `.atl/skill-registry.md` |
| `.atl/skill-registry.md` | Already present, freshly generated 2026-06-27 — left as-is |

---

## 4. Existing SDD State

A partial legacy SDD layout exists outside the canonical OpenSpec tree:

| Legacy path | Status |
| --- | --- |
| `sdd/mvp-vida-core/exploration.md` | Present, dated 2026-06-26, **exploration only** — no proposal, specs, design, or tasks follow |

The `mvp-vida-core` change has been started (exploration done) but lives in a flat `sdd/{change}/` directory rather than the canonical `openspec/changes/{change}/` layout. **The orchestrator must decide**:

- (a) Migrate `sdd/mvp-vida-core/exploration.md` → `openspec/changes/mvp-vida-core/exploration.md` and continue from there (recommended — keeps everything in one tree).
- (b) Leave it where it is and start a new change at `openspec/changes/{new-name}/`.
- (c) Treat the legacy file as a reference doc and archive it.

This is flagged in `risks` and surfaced in `next_recommended`.

---

## 5. Non-obvious Discoveries (saved to Engram)

1. **Vitest 4 default `exclude` is narrower than expected** — vitest 4.1.9's default `exclude` is `['**/node_modules/**', '**/.git/**']` (verified in `node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js`). The `**/dist/**` pattern that older vitest/jest versions had by default is **gone** in vitest 4. `vitest.config.ts` now (post-`f1b6bd9`) overrides this with `include: ['src/**']` and an extended `exclude` covering `**/dist/**`, `**/.next/**`, `**/out/**`, `**/coverage/**`. Any future vitest config change that drops the `include` scope will silently re-introduce the test-duplication issue.
2. **Vitest 4 deprecation noise**: `vite-tsconfig-paths` is no longer needed; Vitest 4 supports `resolve.tsconfigPaths: true` natively. Cosmetic, no action required for init. Still printed on every run.
3. **Next.js 16 is post-training-data**: `AGENTS.md` warns explicitly. The relevant guides live at `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`, `index.md`). Any phase that writes Next.js code MUST read those first.
4. **`better-sqlite3` is a server external**: declared in `next.config.ts` `serverExternalPackages`. This is a Next.js 16 / Webpack 5 / Turbopack concern — bundling native modules requires this hint, or the build will fail at runtime.
5. **No PR-level CI for tests**: only `release.yml` exists, which runs on `v*` tags. PRs have no automatic test gate; `sdd-verify` is the only safety net before merge.
6. **Local DB persistence semantics**: SQLite DB at `~/.config/pesos/pesos.db` is intentionally **preserved on uninstall** (per README). Schema migrations must remain forward-compatible with existing user DBs.
7. **Telegram webhook is the primary ingestion path**: it must return `200 OK` quickly; long-running work must be deferred asynchronously (per `sdd/mvp-vida-core/exploration.md`).
8. **Telegram route test mocks (post-`f1b6bd9`)**: `src/app/api/telegram/route.test.ts` now uses `vi.mock('openai')` and `vi.mock('@google/generative-ai')` with class-based + `vi.hoisted` stubs. The route handler no longer makes a real network call during tests. If a future change touches the OpenAI/Gemini client wiring (constructor signature, import path, exported factory), the mock shape must move with it — otherwise the test will either compile-fail or, worse, start hitting the real endpoint and re-open the `strict_tdd` blocker.

---

## 6. Next Recommended Phase

`select-change` — the orchestrator should ask the user whether to:

1. **Continue `mvp-vida-core`** (migrate exploration to `openspec/changes/mvp-vida-core/` and run `sdd-propose` to draft the PRD), or
2. **Start a new change** (`/sdd-new <name>`).

The init phase alone does not pick an active change; that decision belongs to the orchestrator once it has user intent.

If the user wants to continue `mvp-vida-core` without migration, the orchestrator can also choose to **treat the legacy `sdd/mvp-vida-core/exploration.md` as canonical and run `sdd-propose` against it directly** (with paths configured per-phase), but this is non-standard.

**Caveat lifted**: `strict_tdd: true` and `apply.tdd: true` are now in effect (post `f1b6bd9`). `sdd-apply` against either change will enforce the RED-GREEN-REFACTOR loop. No further re-init is required unless `npm test` regresses.

---

## 7. Resolved test issues (was "Known test issues" before commit `f1b6bd9`)

The `strict_tdd: true` verdict now in `openspec/config.yaml` is based on a clean `npm test` re-run performed during this re-init. The blocker that flipped strict_tdd off in the earlier correction is **resolved**.

### 7.1 Resolution record

- **Commit**: `f1b6bd9` on `main` — `fix(tests): scope vitest to src/ and stub AI client modules`
- **Date**: 2026-06-27
- **Files touched (by the fix, NOT by this re-init)**:
  - `vitest.config.ts` — added `include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)']` and extended `exclude` with `**/dist/**`, `**/.next/**`, `**/out/**`, `**/coverage/**`, `**/node_modules/**`, `**/.git/**`.
  - `src/app/api/telegram/route.test.ts` — added `vi.mock('openai')` and `vi.mock('@google/generative-ai')` using class-based + `vi.hoisted` stubs so the route handler never makes a real HTTP call during tests.
- **Verifier**: orchestrator preflight at 2026-06-27 06:40:33 -0300; re-confirmed by this re-init just now.
- **Result**: `npm test` exits 0. Raw summary from the run performed during this re-init:

  ```
  Test Files  2 passed (2)
       Tests  13 passed (13)
    Duration  2.08s
  ```

  All 13 tests are run from `src/` only — no `dist/` paths appear in the output.

### 7.2 What was wrong (kept as history)

For traceability, the two layered issues that flipped `strict_tdd` off are preserved here as a record of what was fixed. They are no longer the current state of the repo.

**7.2.1 Test duplication in `dist/`** — `vitest.config.ts` had no `include` or `exclude` override, and vitest 4.1.9's default `exclude` is `['**/node_modules/**', '**/.git/**']` (verified in `node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js:6`). The `**/dist/**` pattern older vitest/jest versions had by default is **gone** in vitest 4. The electron-builder Linux unpack output `dist/linux-unpacked/resources/app/` contained a copy of `vitest.config.ts` and was treated as a second workspace, so every test ran twice. **Fix applied in `f1b6bd9`**: scoped `include` to `src/**`.

**7.2.2 Real OpenAI call from a unit test** — `src/app/api/telegram/route.test.ts` mocked `@/lib/supabase` but not the OpenAI client. The route handler called `getAIResponse` (at `src/app/api/telegram/route.ts:152`) which made a real HTTP request to an OpenAI-compatible endpoint and got back `401 Model opencode-go/deepseek-v4-flash is not supported`. The route returned 500, the test assertion `expect(response.status).toBe(200)` failed. **Fix applied in `f1b6bd9`**: `vi.mock('openai')` and `vi.mock('@google/generative-ai')` with class-based stubs.

### 7.3 `vite-tsconfig-paths` deprecation (still present, still non-blocking)

- The vitest run still prints: `The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.`
- Cosmetic only. The fix is to drop the `vite-tsconfig-paths` import and add `resolve.tsconfigPaths: true` to `vitest.config.ts` (or to the Vite config the vitest config extends, if any). Not part of the strict_tdd verdict; tracked as a follow-up.

### 7.4 What downstream phases need to know now

- The **canonical test command** `npm test` is green. `sdd-apply` is configured with `tdd: true` and **will require RED-GREEN-REFACTOR** for new tasks.
- `sdd-verify` should still run `npm test` and report the raw pass/fail counts (currently 2 files / 13 tests / 0 failed).
- If a future change re-introduces a red `npm test` (e.g. by re-adding a real-network test or by removing the `include` scope), the strict_tdd verdict will need to be re-corrected by another re-init.

---

## 8. Risks for Downstream Phases

- **Strict TDD is now on** — `apply.tdd: true` in `openspec/config.yaml` (re-enabled 2026-06-27 by commit `f1b6bd9`). Any future change MUST be developed under the RED-GREEN-REFACTOR loop, and `sdd-verify` will report a failure if `npm test` regresses. Treat the green test run as the floor, not the ceiling: future changes that add a real-network dependency or remove the `include: ['src/**']` scope will silently re-open the blocker.
- **`vite-tsconfig-paths` deprecation hint still present** — Vitest 4 will eventually drop the plugin; `vitest.config.ts` should migrate to native `resolve.tsconfigPaths: true` when convenient. Non-blocking.
- **Next.js 16 + React 19 APIs differ from training data** — agents must read `node_modules/next/dist/docs/` before writing any Next.js code. This is a hard rule from `AGENTS.md`, not a suggestion.
- **Hybrid DB requires dual schema discipline** — schema changes must apply to both Supabase (Postgres) and the local SQLite mirror. Any `sdd-spec` for a DB change must cover both.
- **No test CI** — `sdd-verify` must run the full test command before merge, and reviewers should not rely on GitHub Actions.
- **Legacy SDD layout** — `sdd/mvp-vida-core/exploration.md` is outside `openspec/`. Migration must be decided before further changes are added.
- **Single-user desktop distribution** — telemetry, multi-tenant, and account-level features need an explicit decision; the current model assumes one user per install.
- **Two AI SDKs are wired** (OpenAI, Gemini). Any spec/design that introduces AI work must pick one or define a routing layer.
- **Stderr noise in the Telegram test** — the test `should return 500 if database insertion fails` intentionally calls `console.error` (or a similar logger) from the route handler. vitest prints it to `stderr` on a passing test. Cosmetic only; not a failure.

---

## 9. Skill Resolution

Skills were loaded **by path injection** — the orchestrator passed the contents of `sdd-init/SKILL.md` and `_shared/SKILL.md` (plus their references) inline in the session context, so this phase did not need to call the `skill()` tool. The `_shared` references read for this phase: `engram-convention.md`, `openspec-convention.md`, `sdd-status-contract.md`. The phase-specific reference read: `sdd-init/references/init-details.md`.

`skill_resolution`: `paths-injected`
