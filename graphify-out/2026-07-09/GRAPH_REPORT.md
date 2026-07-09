# Graph Report - /home/geto/Proyectos/PESOS  (2026-07-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 466 nodes · 665 edges · 45 communities (38 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.52)
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

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 19 edges
2. `MockQueryChain` - 18 edges
3. `ServerMockQueryChain` - 18 edges
4. `compilerOptions` - 16 edges
5. `MockQueryChain` - 15 edges
6. `build` - 11 edges
7. `scripts` - 10 edges
8. `update-appimage.sh script` - 9 edges
9. `handleCommand()` - 9 edges
10. `POST()` - 9 edges

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

## Communities (45 total, 7 thin omitted)

### Community 0 - "Dashboard.tsx"
Cohesion: 0.07
Nodes (37): AuthForm(), AuthGate(), AchievementRow, Dashboard(), DashboardProps, UserAchievementRow, WEATHER_GRADIENTS, WEATHER_ICONS (+29 more)

### Community 1 - "route.ts"
Cohesion: 0.09
Nodes (33): buildUserContext(), HabitLogRow, HabitRow, POST(), streamWithGemini(), TaskRow, TransactionRow, GET() (+25 more)

### Community 2 - "electron.js"
Cohesion: 0.06
Nodes (34): { app, BrowserWindow, Tray, Menu }, createWindow(), fs, os, path, { setupAutoUpdater }, { spawn }, startTelegramPoll() (+26 more)

### Community 3 - "route.test.ts"
Cohesion: 0.16
Nodes (25): GET(), POST(), mockedGetState, mockedRequestCheck, mockedRequestDownload, mockedRequestInstall, mockedRequestOpenDeb, mockedRequestOpenReleases (+17 more)

### Community 4 - "dependencies"
Cohesion: 0.07
Nodes (29): author, email, name, dependencies, better-sqlite3, electron-updater, @google/generative-ai, lucide-react (+21 more)

### Community 5 - "sqlite-db.ts"
Cohesion: 0.09
Nodes (22): AchievementsTable, db, dbDir, dbPath, HabitLogsTable, HabitsTable, InputsTable, insertAchievement (+14 more)

### Community 6 - "MockQueryChain"
Cohesion: 0.09
Nodes (6): GoogleGenerativeAI, MockedSupabaseModule, OpenAI, { openaiCreateCompletion, googleGenerateContent }, supabaseMock, MockQueryChain

### Community 7 - "build"
Cohesion: 0.10
Nodes (20): build, appId, asar, deb, directories, files, linux, mac (+12 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "ServerMockQueryChain"
Cohesion: 0.12
Nodes (4): MockFilterClause, MockOrderClause, QueryAction, ServerMockQueryChain

### Community 10 - "reinstall-pesos-clean.sh"
Cohesion: 0.18
Nodes (17): APPDIR, APPIMAGE_NAME, APPIMAGE_PATH, BIN_LINK, CACHE_DIR, CONFIG_DIR, die(), err() (+9 more)

### Community 11 - "route.ts"
Cohesion: 0.23
Nodes (11): POST(), POST(), getOrCreateSecret(), SECRET_PATH, signSession(), verifySession(), MockQuery, ALLOW_LIST_EXACT (+3 more)

### Community 12 - "update-appimage.sh"
Cohesion: 0.30
Nodes (12): API_URL, confirm(), die(), err(), GITHUB_REPO, info(), is_older(), log() (+4 more)

### Community 13 - "ChatBot.tsx"
Cohesion: 0.16
Nodes (13): AIProvider, AuthUserPayload, ChatBot(), ConnectionAction, connectionReducer(), ConnectionState, formatMarkdown(), initialConnectionState (+5 more)

### Community 15 - "MockDatabase"
Cohesion: 0.18
Nodes (5): MockDatabase, MockQueryResult, MockSupabaseClient, MockBrowserClient, ServerMockSupabaseClient

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
Cohesion: 0.40
Nodes (3): ORIGINAL_FILES, ORIGINALS, ROLLBACK

### Community 24 - "runSQLiteQuery"
Cohesion: 0.67
Nodes (4): addXP(), checkAndUnlockAchievements(), cleanIdentifier(), runSQLiteQuery()

## Knowledge Gaps
- **184 isolated node(s):** `{ app, BrowserWindow, Tray, Menu }`, `path`, `{ spawn }`, `fs`, `os` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ServerMockQueryChain` connect `ServerMockQueryChain` to `MockDatabase`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `MockQueryChain` connect `MockQueryChain` to `Dashboard.tsx`, `ServerMockQueryChain`, `MockDatabase`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `MockQueryChain` connect `MockQueryChain` to `sqlite-db.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `{ app, BrowserWindow, Tray, Menu }`, `path`, `{ spawn }` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08943089430894309 - nodes in this community are weakly interconnected._
- **Should `electron.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057692307692307696 - nodes in this community are weakly interconnected._