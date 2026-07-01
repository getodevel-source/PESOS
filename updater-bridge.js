// File-based state bridge for the in-app updater.
//
// This file is INTENTIONALLY pure Node.js — it must NOT import `electron`
// or `electron-updater` because Next.js evaluates it at build time when
// collecting route data for `/api/update`. Importing `electron` from the
// route would fail in CI because the Electron binary download is not
// available outside the Electron main process.
//
// The Electron main process (updater.js) writes state to these files; the
// Next.js route (src/app/api/update/route.ts) reads them. The renderer
// (Dashboard.tsx) polls the route.
//
// Path resolution: paths are derived from `os.homedir()`, so they are
// computed lazily inside `getPaths()` instead of frozen as top-level
// constants. This matters for tests: the bridge is a CJS module cached
// by Node, but each call to `getPaths()` re-evaluates `os.homedir()` so
// a spy on `homedir` (or any future runtime change of the home dir)
// actually takes effect.

const fs = require('fs')
const path = require('path')
const os = require('os')

function getPaths() {
  const STATE_DIR = path.join(os.homedir(), '.config', 'pesos')
  return {
    STATE_DIR,
    STATE_PATH: path.join(STATE_DIR, 'update-state.json'),
    CHECK_REQUEST_PATH: path.join(STATE_DIR, 'update-check-request'),
    DOWNLOAD_REQUEST_PATH: path.join(STATE_DIR, 'update-download-request'),
    INSTALL_REQUEST_PATH: path.join(STATE_DIR, 'update-install-request'),
    OPEN_DEB_REQUEST_PATH: path.join(STATE_DIR, 'update-open-deb-request'),
    OPEN_RELEASES_REQUEST_PATH: path.join(STATE_DIR, 'update-open-releases-request')
  }
}

function ensureStateDir() {
  const { STATE_DIR } = getPaths()
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }
}

function getCurrentVersion() {
  // Try multiple candidate paths because the bridge lives at the
  // project root in source (so __dirname is the project root, where
  // package.json sits) but in the packaged AppImage electron-builder
  // places it at resources/app/updater-bridge.js (so package.json is
  // alongside it in the same dir — still __dirname). That works for
  // both. But on some AppImage runtimes __dirname can resolve oddly
  // when the file is loaded via a FUSE mount — fall back to
  // process.resourcesPath (set by Electron to the resources dir, e.g.
  // <AppImage>/resources) joined with 'app/package.json'.
  const candidates = [
    path.join(__dirname, 'package.json'),
  ]
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app', 'package.json'))
    candidates.push(path.join(process.resourcesPath, 'package.json'))
  }
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      if (pkg && pkg.version) return pkg.version
    } catch {
      // try next candidate
    }
  }
  return '0.0.0'
}

function readState() {
  const { STATE_PATH } = getPaths()
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    }
  } catch (err) {
    console.error('updater-bridge: failed to read state:', err)
  }
  return {
    status: 'idle',
    currentVersion: getCurrentVersion(),
    availableVersion: null,
    progress: 0,
    releaseNotes: null,
    error: null,
    timestamp: 0,
    pendingPath: null,
    installMethod: 'unknown'
  }
}

function writeState(partial) {
  ensureStateDir()
  // Spec Requirement 7: merge semantics so concurrent electron-updater
  // events do not clobber unrelated fields. Read the existing state, spread
  // it as the base, spread `partial` on top, and always refresh `timestamp`.
  const base = readState()
  const payload = {
    ...base,
    ...partial,
    timestamp: Date.now()
  }
  const { STATE_PATH } = getPaths()
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    console.error('updater-bridge: failed to write state:', err)
  }
  return payload
}

function writeRequestFile(filePath) {
  ensureStateDir()
  try {
    fs.writeFileSync(filePath, '1', 'utf8')
    return true
  } catch (err) {
    console.error(`updater-bridge: failed to write request ${filePath}:`, err)
    return false
  }
}

function getState() {
  return readState()
}

function requestCheck() {
  return writeRequestFile(getPaths().CHECK_REQUEST_PATH)
}

function requestDownload() {
  return writeRequestFile(getPaths().DOWNLOAD_REQUEST_PATH)
}

function requestInstall() {
  return writeRequestFile(getPaths().INSTALL_REQUEST_PATH)
}

function requestOpenDeb() {
  return writeRequestFile(getPaths().OPEN_DEB_REQUEST_PATH)
}

function requestOpenReleases() {
  return writeRequestFile(getPaths().OPEN_RELEASES_REQUEST_PATH)
}

module.exports = {
  // Used by the Next.js route
  getState,
  requestCheck,
  requestDownload,
  requestInstall,
  requestOpenDeb,
  requestOpenReleases,
  // Used by the Electron main process (updater.js)
  readState,
  writeState,
  ensureStateDir,
  getCurrentVersion,
  // Resolved on every call so callers see the current `os.homedir()`.
  // Use this in polling loops and tests that override `homedir`.
  getPaths
}
