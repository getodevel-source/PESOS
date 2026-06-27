# `desktop-runtime` Specification

## Purpose

The Electron desktop shell that ships the Next.js app as a single-user offline app. It boots the Next.js server in production, opens a BrowserWindow pointing at `http://localhost:3000`, manages a tray icon, and wires auto-update via `updater.js` + the update trigger file.

## Requirements

### Requirement 1 — Next.js production boot

`electron.js` MUST spawn the packaged Next.js production server bound to `127.0.0.1:3000` when running outside development. The boot MUST be skipped in development (`NODE_ENV === 'development'` or `app.isPackaged === false`).

- Reference: `electron.js:11, 37-59, 213`.
- The spawned process MUST set `NODE_ENV=production` and `NEXT_TELEMETRY_DISABLED=1` in the child env to prevent Turbopack dev server from starting in a read-only AppImage.

### Requirement 2 — Main window

`electron.js` MUST create a `BrowserWindow` (1200×800, `nodeIntegration: false`, `contextIsolation: true`) and load `http://localhost:3000` after a 3-second boot delay. The window MUST hide on `close` (intercept the event) instead of quitting the app.

- Reference: `electron.js:115-158`.
- Dev mode retry: the load URL call is retried once after 3s if the first attempt fails.

### Requirement 3 — Tray icon

`electron.js` MUST create a tray icon with a context menu containing at minimum `Mostrar PESOS` (shows the main window) and `Salir` (sets `app.isQuitting = true` and quits). The tray MUST also show the window on `double-click`.

- Reference: `electron.js:160-189, 226-232`.

### Requirement 4 — Update check (GitHub)

Auto-update MUST be wired through `updater.js`'s `checkUpdate`, `downloadFile`, and `applyUpdate` functions. `checkUpdate` MUST consult `https://api.github.com/repos/getodevel-source/PESOS/releases/latest` and MUST select the asset by platform:

- Linux → asset ending in `.AppImage`
- Windows → asset ending in `.exe`
- macOS → asset ending in `.zip`

- Reference: `updater.js:7-81`, `package.json:50-56` (`publish.github`).

### Requirement 5 — Download trigger flow

The Next.js route `POST /api/update` MUST re-verify the update on the server (it MUST NOT trust the client payload) and MUST write `~/.config/pesos/.update-pending` (the trigger file) when the download finishes. The Electron `startUpdateMonitor` loop MUST poll for that file every 3 seconds and call `applyUpdate` when it appears.

- Reference: `src/app/api/update/route.ts:51-91`, `electron.js:191-211`.

### Requirement 6 — Platform-specific apply

`applyUpdate` MUST:

- On Linux + `process.env.APPIMAGE` set: hot-replace the AppImage in place (`fs.copyFileSync`, `chmod 755`), unlink the temp file, and call `app.relaunch({ execPath: targetPath })` followed by `app.exit(0)`.
- On Windows: spawn the NSIS installer detached (`spawn(filePath, ['/S'], { detached: true, stdio: 'ignore' })`) and exit.
- On any other platform (or as a general fallback): `shell.openPath(filePath)`.

- Reference: `updater.js:127-165`.

## Scenarios

### Scenario: Production boot spawns the Next.js server
- GIVEN `app.isPackaged === true`
- WHEN `app.on('ready')` fires
- THEN `nextProcess` is spawned with `NODE_ENV: 'production'` and `-H 127.0.0.1 -p 3000`.

### Scenario: Development boot does NOT spawn a child
- GIVEN `process.env.NODE_ENV === 'development'`
- WHEN `app.on('ready')` fires
- THEN no Next.js child process is spawned (`startNextServer()` early-returns).

### Scenario: Window close → hide, not quit
- GIVEN the user clicks the X on the main window
- WHEN the `close` event fires
- THEN `mainWindow.hide()` is called and the app does not quit.

### Scenario: Tray `Salir` quits
- GIVEN the user clicks `Salir` in the tray
- WHEN the click handler runs
- THEN `app.isQuitting = true` and `app.quit()` is called.

### Scenario: Update available + GitHub reachable
- GIVEN `package.json` says `1.0.3` and the latest release tag is `v1.0.4`
- WHEN `checkUpdate` is called
- THEN it returns `{ updateAvailable: true, latestVersion: 'v1.0.4', assetUrl, filename }`.

### Scenario: Platform asset picked
- GIVEN `process.platform === 'linux'`
- WHEN `checkUpdate` returns
- THEN the `filename` ends in `.AppImage`.
- GIVEN `process.platform === 'win32'` → `filename` ends in `.exe`.
- GIVEN `process.platform === 'darwin'` → `filename` ends in `.zip`.

### Scenario: Download → apply trigger file
- GIVEN the user clicks `Descargar e Instalar`
- WHEN the download finishes
- THEN `~/.config/pesos/.update-pending` exists and contains the temp file path.

### Scenario: Electron picks up the trigger
- GIVEN the trigger file is written
- WHEN `startUpdateMonitor` ticks (≤ 3s)
- THEN `applyUpdate` is called and the trigger file is unlinked.

### Scenario: Linux AppImage hot replace
- GIVEN Linux + `process.env.APPIMAGE` is set
- WHEN `applyUpdate` runs
- THEN the AppImage file is overwritten in place, `chmod 755` is applied, the temp file is unlinked, and `app.relaunch({ execPath })` is called.

### Scenario: Windows detached installer
- GIVEN Windows
- WHEN `applyUpdate` runs
- THEN a child process is spawned detached with args `['/S']` and `app.exit(0)` is called.

## Out of scope

- Code signing on macOS / Windows (see `MACOS_BUILD.md`).
- Multi-window support (single `mainWindow`).
- Auto-update on macOS via Squirrel (the current code uses GitHub release downloads + a manual relaunch).
- A CI workflow that runs `npm test` on PRs.
- Telemetry / crash reporting.
- A notification system for update availability inside the BrowserWindow (the `Dashboard.tsx` "Buscar actualizaciones" button + the `/api/update` polling loop covers that surface, but it is owned by `Dashboard.tsx`, not by `desktop-runtime`).
