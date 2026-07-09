# Graph Report - PESOS  (2026-07-09)

## Corpus Check
- 144 files · ~148,646 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1426 nodes · 1551 edges · 132 communities (116 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5aaf698b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.tsx
- route.ts
- electron.js
- route.test.ts
- dependencies
- sqlite-db.ts
- MockQueryChain
- build
- compilerOptions
- ServerMockQueryChain
- reinstall-pesos-clean.sh
- route.ts
- update-appimage.sh
- ChatBot.tsx
- MockQueryChain
- MockDatabase
- ErrorBoundary
- install.sh
- SetupWizard.tsx
- bot-daemon.js
- layout.tsx
- rollback.test.ts
- route.test.ts
- runSQLiteQuery
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- check-mock-schema-sync.sh
- globals.test.ts
- components-aesthetic.test.ts
- 4. File Changes
- Scenarios
- Scenarios
- Design: `mvp-vida-core` — Endurecer el MVP local-first
- Scenarios
- Scenarios
- SDD Init Report — `pesos`
- Scenarios
- Scenarios
- PESOS — Personal OS
- Scenarios
- Scenarios
- Scenarios
- Scenarios
- Proposal: mvp-vida-core — Endurecer el MVP local-first
- Requirements
- Scenarios
- Requirements
- Scenarios
- Scenarios
- Technical Design: SQLite Infallible Persistence
- Scenarios
- Scenarios
- Proposal: SQLite Infallible Persistence
- Proposal: UI Aesthetic Overhaul
- Scenarios
- Dashboard.tsx
- route.ts
- 03-components — Componentes del Sistema
- Archive Report — `mvp-vida-core`
- 2. Scenarios
- 2. Scenarios
- Exploration: MVP Vida Core Architecture & Schema
- Exploration: sqlite-infallible-persistence
- Requirements
- Requirements
- 01-system-context — Contexto del Sistema
- 05-ai-agents — Agentes e Inteligencia Artificial
- 06-deployment — Despliegue y Distribución
- Verification Report: SQLite Infallible Persistence
- env-loader.ts
- Apply Progress: mvp-vida-core
- Verification Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)
- `mock-layer` — Specification
- TransactionSummary.tsx
- graphify reference: extra exports and benchmark
- Ponytail
- 02-containers — Contenedores del Sistema
- 04-database — Modelo de Base de Datos
- Tasks: SQLite Infallible Persistence
- Tasks: UI Aesthetic Overhaul
- route.test.ts
- supabase-client.ts
- Ponytail Help
- macOS Build, Signing, and Notarization Guide
- Scenarios
- Tasks: mvp-vida-core — Endurecer el MVP local-first
- Exploration: ui-aesthetic-overhaul
- ADDED Requirements
- Scenarios
- Apply Progress: SQLite Infallible Persistence
- Progress Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)
- TaskList.tsx
- graphify reference: query, path, explain
- ADDED Requirements
- ADDED Requirements
- Scenarios
- Scenarios
- Archive Report: SQLite Infallible Persistence
- SKILL.md
- Ponytail Gain
- SKILL.md
- ADDED Requirements
- Archive Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native AGENTS.md integration
- graphify reference: incremental update and cluster-only
- SKILL.md
- Deltas — `mvp-vida-core`
- This is NOT the Next.js you know
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- graphify.md
- ponytail.md
- extraction-spec.md
- graphify.md

## God Nodes (most connected - your core abstractions)
1. `MockQueryChain` - 18 edges
2. `createClient()` - 18 edges
3. `ServerMockQueryChain` - 18 edges
4. `compilerOptions` - 16 edges
5. `Verification Report: mvp-vida-core` - 16 edges
6. `MockQueryChain` - 15 edges
7. `Proposal: mvp-vida-core — Endurecer el MVP local-first` - 15 edges
8. `What You Must Do When Invoked` - 12 edges
9. `build` - 11 edges
10. `Scenarios` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `getState()`  [EXTRACTED]
  src/app/api/update/route.ts → updater-bridge.js
- `POST()` --calls--> `getState()`  [EXTRACTED]
  src/app/api/update/route.ts → updater-bridge.js
- `POST()` --calls--> `requestCheck()`  [EXTRACTED]
  src/app/api/update/route.ts → updater-bridge.js
- `POST()` --calls--> `requestDownload()`  [EXTRACTED]
  src/app/api/update/route.ts → updater-bridge.js
- `POST()` --calls--> `requestInstall()`  [EXTRACTED]
  src/app/api/update/route.ts → updater-bridge.js

## Import Cycles
- 1-file cycle: `updater.js -> updater.js`
- 1-file cycle: `src/lib/updater-bridge.ts -> src/lib/updater-bridge.ts`

## Communities (132 total, 16 thin omitted)

### Community 0 - "Dashboard.tsx"
Cohesion: 0.15
Nodes (12): AuthForm(), Dashboard(), DietLogForm(), DietLogProps, FREQUENT_FOODS, GOALS, DEFAULT_TAGS, JournalEntry (+4 more)

### Community 1 - "route.ts"
Cohesion: 0.23
Nodes (16): buildUserContext(), getAIResponse(), getMepRate(), HabitLogRow, HabitRow, handleCommand(), parseAmount(), POST() (+8 more)

### Community 2 - "electron.js"
Cohesion: 0.06
Nodes (34): { app, BrowserWindow, Tray, Menu }, createWindow(), fs, os, path, { setupAutoUpdater }, { spawn }, startTelegramPoll() (+26 more)

### Community 3 - "route.test.ts"
Cohesion: 0.16
Nodes (25): GET(), POST(), mockedGetState, mockedRequestCheck, mockedRequestDownload, mockedRequestInstall, mockedRequestOpenDeb, mockedRequestOpenReleases (+17 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (47): author, email, name, build, appId, asar, deb, directories (+39 more)

### Community 5 - "sqlite-db.ts"
Cohesion: 0.09
Nodes (22): AchievementsTable, db, dbDir, dbPath, HabitLogsTable, HabitsTable, InputsTable, insertAchievement (+14 more)

### Community 7 - "build"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "reinstall-pesos-clean.sh"
Cohesion: 0.18
Nodes (17): APPDIR, APPIMAGE_NAME, APPIMAGE_PATH, BIN_LINK, CACHE_DIR, CONFIG_DIR, die(), err() (+9 more)

### Community 11 - "route.ts"
Cohesion: 0.25
Nodes (10): POST(), POST(), getOrCreateSecret(), SECRET_PATH, signSession(), verifySession(), ALLOW_LIST_EXACT, ALLOW_LIST_PREFIXES (+2 more)

### Community 12 - "update-appimage.sh"
Cohesion: 0.30
Nodes (12): API_URL, confirm(), die(), err(), GITHUB_REPO, info(), is_older(), log() (+4 more)

### Community 13 - "ChatBot.tsx"
Cohesion: 0.16
Nodes (13): AIProvider, AuthUserPayload, ChatBot(), ConnectionAction, connectionReducer(), ConnectionState, formatMarkdown(), initialConnectionState (+5 more)

### Community 15 - "MockDatabase"
Cohesion: 0.18
Nodes (4): MockQueryResult, MockSupabaseClient, MockBrowserClient, ServerMockSupabaseClient

### Community 16 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 17 - "install.sh"
Cohesion: 0.57
Nodes (6): detect_distro(), err(), info(), ok(), install.sh script, warn()

### Community 18 - "SetupWizard.tsx"
Cohesion: 0.33
Nodes (3): defaultField(), FieldState, SetupWizard()

### Community 20 - "layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, inter, metadata

### Community 21 - "rollback.test.ts"
Cohesion: 0.08
Nodes (23): Artifacts, Assertion Quality, Build & Tests Execution, Coherence (Design), Completeness, Correctness (Static Evidence), CRITICAL (0), Cross-Cutting Checks (+15 more)

### Community 24 - "runSQLiteQuery"
Cohesion: 0.67
Nodes (4): addXP(), checkAndUnlockAchievements(), cleanIdentifier(), runSQLiteQuery()

### Community 33 - "globals.test.ts"
Cohesion: 0.09
Nodes (21): `desktop-runtime` Specification, Out of scope, Purpose, Requirement 1 — Next.js production boot, Requirement 2 — Main window, Requirement 3 — Tray icon, Requirement 4 — Update check (GitHub), Requirement 5 — Download trigger flow (+13 more)

### Community 34 - "components-aesthetic.test.ts"
Cohesion: 0.09
Nodes (21): Out of scope, Purpose, Requirement 1 — Command parsing, Requirement 2 — Help commands are account-free, Requirement 3 — Per-user commands short-circuit on missing account, Requirement 4 — `/gasto` and `/ingreso` argument shape, Requirement 5 — Free-text AI flow + `CONFIRM_TX` marker, Requirement 6 — Confirmation / cancellation handshake (+13 more)

### Community 45 - "4. File Changes"
Cohesion: 0.09
Nodes (21): 1. Technical Approach, 2. Architecture Decisions, 3. Data Flow, 4.1. `src/app/globals.css`, 4.2. `src/components/Dashboard.tsx`, 4.3. `src/components/TaskList.tsx` & `HabitList.tsx`, 4.4. `src/components/DietLog.tsx`, 4.5. `src/components/JournalReflection.tsx` (+13 more)

### Community 46 - "Scenarios"
Cohesion: 0.09
Nodes (21): `desktop-runtime` Specification, Out of scope, Purpose, Requirement 1 — Next.js production boot, Requirement 2 — Main window, Requirement 3 — Tray icon, Requirement 4 — Update check (GitHub), Requirement 5 — Download trigger flow (+13 more)

### Community 47 - "Scenarios"
Cohesion: 0.09
Nodes (21): Out of scope, Purpose, Requirement 1 — Command parsing, Requirement 2 — Help commands are account-free, Requirement 3 — Per-user commands short-circuit on missing account, Requirement 4 — `/gasto` and `/ingreso` argument shape, Requirement 5 — Free-text AI flow + `CONFIRM_TX` marker, Requirement 6 — Confirmation / cancellation handshake (+13 more)

### Community 48 - "Design: `mvp-vida-core` — Endurecer el MVP local-first"
Cohesion: 0.10
Nodes (19): 1. Architecture overview, 2. File plan, 3. The 4 delta designs, 4.1 Multi-tenant / RLS strategy (required by `rules.design`), 4.2 Electron + Next.js SSR interaction (required by `rules.design`), 4.3 Secret storage, 4.4 Test strategy (strict TDD), 4. Cross-cutting concerns (+11 more)

### Community 49 - "Scenarios"
Cohesion: 0.10
Nodes (19): `ai-chat` Specification, Out of scope, Purpose, Requirement 1 — Server-Sent Events stream, Requirement 2 — Provider is explicit, Requirement 3 — Persona + guardrails in the system prompt, Requirement 4 — Provider routing, Requirement 5 — Monthly-budget alerts in context (+11 more)

### Community 50 - "Scenarios"
Cohesion: 0.10
Nodes (19): Out of scope, Purpose, Requirement 1 — `user_stats` schema + level formula, Requirement 2 — XP grants and deductions, Requirement 3 — Achievement criteria, Requirement 4 — Idempotent unlock + one-time XP award, Requirement 5 — SQLite adapter mirrors Postgres behavior, Requirements (+11 more)

### Community 51 - "SDD Init Report — `pesos`"
Cohesion: 0.10
Nodes (19): 1. Detected Stack, 2. Testing Capability, 3. Persistence Setup, 4. Existing SDD State, 5. Non-obvious Discoveries (saved to Engram), 6. Next Recommended Phase, 7.1 Resolution record, 7.2 What was wrong (kept as history) (+11 more)

### Community 52 - "Scenarios"
Cohesion: 0.10
Nodes (19): `ai-chat` Specification, Out of scope, Purpose, Requirement 1 — Server-Sent Events stream, Requirement 2 — Provider is explicit, Requirement 3 — Persona + guardrails in the system prompt, Requirement 4 — Provider routing, Requirement 5 — Monthly-budget alerts in context (+11 more)

### Community 53 - "Scenarios"
Cohesion: 0.10
Nodes (19): Out of scope, Purpose, Requirement 1 — `user_stats` schema + level formula, Requirement 2 — XP grants and deductions, Requirement 3 — Achievement criteria, Requirement 4 — Idempotent unlock + one-time XP award, Requirement 5 — SQLite adapter mirrors Postgres behavior, Requirements (+11 more)

### Community 54 - "PESOS — Personal OS"
Cohesion: 0.11
Nodes (17): Desarrollo Local, Despliegue en VPS (Docker), Empaquetado de Instaladores, Guía de Desarrollo y Despliegue, Requisitos Previos, ⚙️ Configuración Inicial, 🛠️ Desarrollo Local / Servidores, 🧹 Desinstalación (+9 more)

### Community 55 - "Scenarios"
Cohesion: 0.11
Nodes (18): `ai-provider-config` Specification, Out of scope, Purpose, Requirement 1 — Persistent explicit default, Requirement 2 — Explicit default is the source of truth, Requirement 3 — `/api/ai-chat` uses the explicit default, Requirement 4 — `/api/telegram` uses the explicit default, Requirement 5 — Validate-only-the-chosen-provider (+10 more)

### Community 56 - "Scenarios"
Cohesion: 0.11
Nodes (18): Out of scope, Purpose, Requirement 1 — Local long-poll is the single source of truth, Requirement 2 — Secret-gated ingestion endpoint, Requirement 3 — User resolution by `telegram_chat_id` then `telegram_username`, Requirement 4 — Audit insert on every well-formed update, Requirement 5 — Always 200 for messages Telegram can retry, Requirements (+10 more)

### Community 57 - "Scenarios"
Cohesion: 0.11
Nodes (18): `ai-provider-config` Specification, Out of scope, Purpose, Requirement 1 — Persistent explicit default, Requirement 2 — Explicit default is the source of truth, Requirement 3 — `/api/ai-chat` uses the explicit default, Requirement 4 — `/api/telegram` uses the explicit default, Requirement 5 — Validate-only-the-chosen-provider (+10 more)

### Community 58 - "Scenarios"
Cohesion: 0.11
Nodes (18): Out of scope, Purpose, Requirement 1 — Local long-poll is the single source of truth, Requirement 2 — Secret-gated ingestion endpoint, Requirement 3 — User resolution by `telegram_chat_id` then `telegram_username`, Requirement 4 — Audit insert on every well-formed update, Requirement 5 — Always 200 for messages Telegram can retry, Requirements (+10 more)

### Community 59 - "Proposal: mvp-vida-core — Endurecer el MVP local-first"
Cohesion: 0.11
Nodes (17): Affected areas (forward-looking), Approach, Assumptions (sensible defaults — user can flip at review), Capabilities (contract with sdd-spec), Dependencies, Direction (a) — Ship the local-first MVP, Intent, Modified Capabilities (+9 more)

### Community 60 - "Requirements"
Cohesion: 0.11
Nodes (17): `data-model-rls` Specification, Out of scope, Purpose, Requirement 1 — Tables and columns, Requirement 2 — RLS policies, Requirement 3 — Public catalog of achievements, Requirement 4 — `handle_new_user` trigger, Requirement 5 — SQLite mirror parity (+9 more)

### Community 61 - "Scenarios"
Cohesion: 0.11
Nodes (17): `exchange-rate` Specification, Out of scope, Purpose, Requirement 1 — Cached endpoint shape, Requirement 2 — Upstream + cache TTL, Requirement 3 — Failure modes, Requirement 4 — Telegram helper, Requirement 5 — USD conversion semantics (+9 more)

### Community 62 - "Requirements"
Cohesion: 0.11
Nodes (17): `data-model-rls` Specification, Out of scope, Purpose, Requirement 1 — Tables and columns, Requirement 2 — RLS policies, Requirement 3 — Public catalog of achievements, Requirement 4 — `handle_new_user` trigger, Requirement 5 — SQLite mirror parity (+9 more)

### Community 63 - "Scenarios"
Cohesion: 0.11
Nodes (17): `exchange-rate` Specification, Out of scope, Purpose, Requirement 1 — Cached endpoint shape, Requirement 2 — Upstream + cache TTL, Requirement 3 — Failure modes, Requirement 4 — Telegram helper, Requirement 5 — USD conversion semantics (+9 more)

### Community 64 - "Scenarios"
Cohesion: 0.12
Nodes (16): `dashboard-auth` Specification, Out of scope, Purpose, Requirement 1 — Loopback-only handshake endpoint, Requirement 2 — Middleware-enforced dashboard gate, Requirement 3 — Session cookie semantics, Requirement 4 — Electron triggers the handshake on app-ready, Requirement 5 — Documented lockout recovery (+8 more)

### Community 65 - "Technical Design: SQLite Infallible Persistence"
Cohesion: 0.12
Nodes (16): 1. Technical Approach, 2. Architecture Decisions, 3. Data Flow, 4. File Changes, 5. Interfaces/Contracts, 6. Testing Strategy, 7. Rollout/Migration, Decision: Centralized App Data Directory (+8 more)

### Community 66 - "Scenarios"
Cohesion: 0.12
Nodes (16): `dashboard-auth` Specification, Out of scope, Purpose, Requirement 1 — Loopback-only handshake endpoint, Requirement 2 — Middleware-enforced dashboard gate, Requirement 3 — Session cookie semantics, Requirement 4 — Electron triggers the handshake on app-ready, Requirement 5 — Documented lockout recovery (+8 more)

### Community 67 - "Scenarios"
Cohesion: 0.13
Nodes (14): Out of scope, Purpose, Requirement 1 — Voice download → base64 inline data, Requirement 2 — Pass inline data to Gemini, not OpenCode, Requirement 3 — Prompt prefix for transcription, Requirement 4 — Voice errors do not produce 4xx, Requirements, Scenario: Default MIME type (+6 more)

### Community 68 - "Proposal: SQLite Infallible Persistence"
Cohesion: 0.13
Nodes (14): Affected Areas, Approach, Capabilities, Dependencies, In Scope, Intent, Modified Capabilities, New Capabilities (+6 more)

### Community 69 - "Proposal: UI Aesthetic Overhaul"
Cohesion: 0.13
Nodes (14): Affected Areas, Approach, Capabilities, Dependencies, In Scope, Intent, Modified Capabilities, New Capabilities (+6 more)

### Community 70 - "Scenarios"
Cohesion: 0.13
Nodes (14): Out of scope, Purpose, Requirement 1 — Voice download → base64 inline data, Requirement 2 — Pass inline data to Gemini, not OpenCode, Requirement 3 — Prompt prefix for transcription, Requirement 4 — Voice errors do not produce 4xx, Requirements, Scenario: Default MIME type (+6 more)

### Community 71 - "Dashboard.tsx"
Cohesion: 0.16
Nodes (12): AuthGate(), AchievementRow, DashboardProps, UserAchievementRow, WEATHER_GRADIENTS, WEATHER_ICONS, WEATHER_LABELS, WeatherState (+4 more)

### Community 72 - "route.ts"
Cohesion: 0.20
Nodes (12): buildUserContext(), HabitLogRow, HabitRow, POST(), streamWithGemini(), TaskRow, TransactionRow, AIConfig (+4 more)

### Community 73 - "03-components — Componentes del Sistema"
Cohesion: 0.15
Nodes (12): 03-components — Componentes del Sistema, Componentes de Servicio y Datos (Backend/Core - `src/lib/*` & `src/app/api/*`), Componentes Visuales (Frontend - `src/components/*`), Decisiones arquitectónicas, Dependencias, Diagrama 1: Flujo en Frontend (Cliente), Diagrama 2: Backend y Persistencia, Diagramas de Componentes (+4 more)

### Community 74 - "Archive Report — `mvp-vida-core`"
Cohesion: 0.15
Nodes (12): Archive Report — `mvp-vida-core`, Change summary, Commit graph, Open follow-ups, Pre-existing bugs flagged by sdd-spec (NOT addressed by this change), Proposal's out-of-scope follow-ups (deferred), SDD cycle complete, Verification (+4 more)

### Community 75 - "2. Scenarios"
Cohesion: 0.15
Nodes (12): 1.1 Dark Glassmorphic Design, 1.2 Tactile Interactions, 1.3 Contextual Status Glows, 1.4 Accessibility & Contrast, 1. Requirements, 2. Scenarios, Scenario 1: Rendering the Dark Glassmorphic UI with Hardware Acceleration, Scenario 2: Backdrop Blur Fallback (Electron Safety Limit) (+4 more)

### Community 76 - "2. Scenarios"
Cohesion: 0.15
Nodes (12): 1.1 Dark Glassmorphic Design, 1.2 Tactile Interactions, 1.3 Contextual Status Glows, 1.4 Accessibility & Contrast, 1. Requirements, 2. Scenarios, Scenario 1: Rendering the Dark Glassmorphic UI with Hardware Acceleration, Scenario 2: Backdrop Blur Fallback (Electron Safety Limit) (+4 more)

### Community 77 - "Exploration: MVP Vida Core Architecture & Schema"
Cohesion: 0.17
Nodes (11): 1. Next.js Webhook + App Router (Monolithic Serverless), 2. Decoupled Next.js Dashboard + Supabase Edge Functions (Deno), Affected Areas, Approaches, Current State, Exploration: MVP Vida Core Architecture & Schema, Proposed Project Structure, Proposed Supabase Schema (+3 more)

### Community 78 - "Exploration: sqlite-infallible-persistence"
Cohesion: 0.17
Nodes (11): 1. Path Resolution, 2. Backup Rotation, 3. Corruption Check and Self-Healing, 4. Concurrency Optimization, Affected Areas, Approaches, Current State, Exploration: sqlite-infallible-persistence (+3 more)

### Community 79 - "Requirements"
Cohesion: 0.17
Nodes (11): 1. Directory Path Resolution, 2. WAL Mode & Timeout Constraints, 3. Backup Rotation, 4. Corruption Detection & Self-Healing, Requirements, Scenario 1: OS-Specific Path Resolution, Scenario 2: Connection Configuration (WAL & Timeout), Scenario 3: Backup Rotation Limit (+3 more)

### Community 80 - "Requirements"
Cohesion: 0.17
Nodes (11): 1. Directory Path Resolution, 2. WAL Mode & Timeout Constraints, 3. Backup Rotation, 4. Corruption Detection & Self-Healing, Requirements, Scenario 1: OS-Specific Path Resolution, Scenario 2: Connection Configuration (WAL & Timeout), Scenario 3: Backup Rotation Limit (+3 more)

### Community 81 - "01-system-context — Contexto del Sistema"
Cohesion: 0.18
Nodes (10): 01-system-context — Contexto del Sistema, Decisiones arquitectónicas, Dependencias, Diagrama Mermaid de Alto Nivel, Externas, Internas, Pendientes de validación, Propósito (+2 more)

### Community 82 - "05-ai-agents — Agentes e Inteligencia Artificial"
Cohesion: 0.18
Nodes (10): 05-ai-agents — Agentes e Inteligencia Artificial, 1. Asistente Conversacional "Pesito" (Bot de Telegram), 2. Chatbot del Dashboard (Asistente Integrado), Decisiones arquitectónicas, Dependencias, Diagrama de Comunicación e Ingesta del Bot, Pendientes de validación, Propósito (+2 more)

### Community 83 - "06-deployment — Despliegue y Distribución"
Cohesion: 0.18
Nodes (10): 06-deployment — Despliegue y Distribución, Decisiones arquitectónicas, Dependencias, Diagramas de Despliegue, Flujo 1: Desarrollo y Empaquetado Local, Flujo 2: Despliegue Headless en Servidor (VPS), Pendientes de validación, Propósito (+2 more)

### Community 84 - "Verification Report: SQLite Infallible Persistence"
Cohesion: 0.18
Nodes (10): 1. Final Verdict, 2. Technical Metadata, 3. TDD Cycle Compliance, 4. Test Execution & Build Output, 5. Assertion Quality & Code Audit, 6. Implementation & Specification Matrix, Findings:, Next.js Production Build (+2 more)

### Community 85 - "env-loader.ts"
Cohesion: 0.31
Nodes (5): GET(), POST(), sanitizeEnvValue(), loadUserEnv(), getAppDir()

### Community 86 - "Apply Progress: mvp-vida-core"
Cohesion: 0.20
Nodes (9): Apply Progress: mvp-vida-core, Deviations from the plan, Issues, Phase 1 — Δ4 RLS rollback ✅ — commit `26cfd85`, Phase 2 — Δ1 Telegram loopback + setWebhook removal ✅ — commit `7a67ee6`, Phase 3 — Δ3 AI provider config ✅ — commit `adb2992`, Phase 4 — Δ2 Dashboard auth gate ✅ — commit `7fe9105`, Risks for the orchestrator (+1 more)

### Community 87 - "Verification Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)"
Cohesion: 0.20
Nodes (9): 1. Executive Summary, 2. TDD Cycle & Assertion Audit, 3. Test Suite Execution Logs, 4. Production Build Verification, 5. Verification Conclusion, Final Verdict: PASS, TDD Cycle Evidence, Test File Quality Audit (+1 more)

### Community 88 - "`mock-layer` — Specification"
Cohesion: 0.20
Nodes (9): 1. `scripts/check-mock-schema-sync.sh` (CI check), 2. Schema promotion discipline, Drift risk and mitigation, Known mock-surface extensions, `mock-layer` — Specification, Out of scope, Purpose, The two layers (+1 more)

### Community 89 - "TransactionSummary.tsx"
Cohesion: 0.29
Nodes (8): BudgetStatus, formatARSOnChange(), getMonthKey(), parseARSInput(), toARSDisplay(), Transaction, TransactionSummary(), TransactionSummaryProps

### Community 90 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 91 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 92 - "02-containers — Contenedores del Sistema"
Cohesion: 0.22
Nodes (8): 02-containers — Contenedores del Sistema, Decisiones arquitectónicas, Dependencias, Diagrama Mermaid de Containers, Pendientes de validación, Propósito, Responsabilidades, Restricciones conocidas

### Community 93 - "04-database — Modelo de Base de Datos"
Cohesion: 0.22
Nodes (8): 04-database — Modelo de Base de Datos, Decisiones arquitectónicas, Dependencias, Diagrama Mermaid ER, Pendientes de validación, Propósito, Responsabilidades, Restricciones conocidas

### Community 94 - "Tasks: SQLite Infallible Persistence"
Cohesion: 0.22
Nodes (8): Phase 1: Centralized Path Utility, Phase 2: Path Standardization, Phase 3: Backup Rotation & WAL, Phase 4: Corruption Recovery & Boot Check, Phase 5: Verification Unit Tests, Phase 6: Build & Manual Verification, Tasks: SQLite Infallible Persistence, Workload Forecast

### Community 95 - "Tasks: UI Aesthetic Overhaul"
Cohesion: 0.22
Nodes (8): Phase 1: CSS Foundation, Phase 2: Sidebar & Core Layout, Phase 3: List Elements, Phase 4: Activity & Health Cards, Phase 5: Finance & Assistant, Phase 6: Build & Verification, Tasks: UI Aesthetic Overhaul, Workload Forecast & PR Split

### Community 96 - "route.test.ts"
Cohesion: 0.22
Nodes (5): GoogleGenerativeAI, MockedSupabaseModule, OpenAI, { openaiCreateCompletion, googleGenerateContent }, supabaseMock

### Community 97 - "supabase-client.ts"
Cohesion: 0.36
Nodes (6): MockDatabase, MockFilterClause, MockOrderClause, MockPostgrestError, MockQuery, QueryAction

### Community 98 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 99 - "macOS Build, Signing, and Notarization Guide"
Cohesion: 0.25
Nodes (7): macOS Build, Signing, and Notarization Guide, Prerequisites, Step 1: Install and Configure Developer Certificates, Step 2: Configure Environment Variables, Step 3: Configure `package.json`, Step 4: Run the Build Command, Step 5: Verification

### Community 100 - "Scenarios"
Cohesion: 0.25
Nodes (8): Scenario: Authenticated dashboard request passes through, Scenario: Electron triggers handshake on ready, Scenario: Handshake loopback-only, Scenario: Handshake success on loopback, Scenario: Legacy `AuthForm` is not in the tree, Scenario: Lockout recovery, Scenario: Unauthenticated dashboard request redirects, Scenarios

### Community 101 - "Tasks: mvp-vida-core — Endurecer el MVP local-first"
Cohesion: 0.25
Nodes (7): Forecast, Out-of-scope follow-ups, Phase 1 — Δ4 RLS rollback, Phase 2 — Δ1 Telegram loopback + setWebhook removal, Phase 3 — Δ3 AI provider config, Phase 4 — Δ2 Dashboard auth gate, Tasks: mvp-vida-core — Endurecer el MVP local-first

### Community 102 - "Exploration: ui-aesthetic-overhaul"
Cohesion: 0.25
Nodes (7): Affected Areas, Approaches, Current State, Exploration: ui-aesthetic-overhaul, Ready for Proposal, Recommendation, Risks

### Community 103 - "ADDED Requirements"
Cohesion: 0.29
Nodes (7): ADDED Requirements, Delta 2 — `dashboard-auth-gate`, Requirement: Documented lockout recovery, Requirement: Electron triggers the handshake on app-ready, Requirement: Handshake endpoint issues an HttpOnly session cookie, Requirement: Legacy email/password AuthForm is removed from the dashboard tree, Requirement: Middleware-enforced dashboard gate

### Community 104 - "Scenarios"
Cohesion: 0.29
Nodes (7): Scenario: 401 hard-fail in `/api/ai-chat`, Scenario: 401 hard-fail in `/api/telegram`, Scenario: Explicit default honored, Scenario: Missing config file → graceful default, Scenario: Telegram free-text uses explicit default, Scenario: Validate-only-chosen-provider, Scenarios

### Community 105 - "Apply Progress: SQLite Infallible Persistence"
Cohesion: 0.29
Nodes (6): 1. Implementation Status, 2. TDD Cycle Evidence, 3. Verification & Build Results, Apply Progress: SQLite Infallible Persistence, Production Build, Unit Test Execution

### Community 106 - "Progress Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)"
Cohesion: 0.29
Nodes (6): 1. Implementation Summary, 2. TDD Cycle Evidence, 3. Verification & Build Logs, Production Build compilation, Progress Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul), Test Suite Execution

### Community 107 - "TaskList.tsx"
Cohesion: 0.38
Nodes (4): TaskCalendarProps, Task, TaskList(), TaskListProps

### Community 108 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 109 - "ADDED Requirements"
Cohesion: 0.33
Nodes (6): ADDED Requirements, Requirement: 401 is a hard-fail in both chat routes, Requirement: `/api/ai-chat` uses the explicit default, Requirement: `/api/telegram` uses the explicit default, Requirement: Persistent explicit default in `.ai-config.json`, Requirement: Validate-only-the-chosen-provider (no cross-provider retry)

### Community 110 - "ADDED Requirements"
Cohesion: 0.33
Nodes (6): ADDED Requirements, Delta 4 — `rls-rollback-strategy`, Requirement: Every CREATE / ALTER / POLICY has a matching DROP, Requirement: Re-apply script header present, Requirement: Rollback file exists and is parseable SQL, Requirement: Test parses the rollback and asserts completeness

### Community 111 - "Scenarios"
Cohesion: 0.33
Nodes (6): Scenario: Dependency order respected, Scenario: Every CREATE has a matching DROP, Scenario: File exists and parses, Scenario: Re-apply header present, Scenario: Rollback policy is dropped, Scenarios

### Community 112 - "Scenarios"
Cohesion: 0.33
Nodes (6): Scenario: Electron clears stale webhook, Scenario: Loopback request accepted, Scenario: Remote request rejected, Scenario: `setWebhook` not called from setup route, Scenario: `TELEGRAM_ALLOW_REMOTE=1` opt-in, Scenarios

### Community 113 - "Archive Report: SQLite Infallible Persistence"
Cohesion: 0.33
Nodes (5): 1. Change Metadata, 2. Archival Tasks Completed, 3. Verification & Compliance Summary, 4. Final Sign-off, Archive Report: SQLite Infallible Persistence

### Community 114 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 115 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 116 - "SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 117 - "ADDED Requirements"
Cohesion: 0.40
Nodes (5): ADDED Requirements, Requirement: Electron clears any stale public webhook on startup, Requirement: Loopback guard on `/api/telegram`, Requirement: Opt-in escape hatch, Requirement: Public `setWebhook` registration is removed

### Community 118 - "Archive Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)"
Cohesion: 0.40
Nodes (4): 1. Task Verification, 2. Specification Sync Details, 3. Directory Archive, Archive Report: UI Aesthetic Overhaul (ui-aesthetic-overhaul)

### Community 119 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 120 - "graphify reference: commit hook and native AGENTS.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native AGENTS.md integration, graphify reference: commit hook and native AGENTS.md integration

### Community 121 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 122 - "SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 123 - "Deltas — `mvp-vida-core`"
Cohesion: 0.50
Nodes (3): Delta 1 — `telegram-loopback-and-setwebhook-removal`, Delta 3 — `ai-provider-config-and-key-validation`, Deltas — `mvp-vida-core`

## Knowledge Gaps
- **901 isolated node(s):** `{ app, BrowserWindow, Tray, Menu }`, `path`, `{ spawn }`, `fs`, `os` (+896 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MockQueryChain` connect `MockQueryChain` to `route.test.ts`, `sqlite-db.ts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `electron.js` to `dependencies`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `{ app, BrowserWindow, Tray, Menu }`, `path`, `{ spawn }` to the rest of the system?**
  _901 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `electron.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057692307692307696 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `sqlite-db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `MockQueryChain` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._