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

const fs = require('fs')
const path = require('path')
const os = require('os')

const STATE_DIR = path.join(os.homedir(), '.config', 'pesos')
const STATE_PATH = path.join(STATE_DIR, 'update-state.json')
const CHECK_REQUEST_PATH = path.join(STATE_DIR, 'update-check-request')
const DOWNLOAD_REQUEST_PATH = path.join(STATE_DIR, 'update-download-request')
const INSTALL_REQUEST_PATH = path.join(STATE_DIR, 'update-install-request')
const OPEN_DEB_REQUEST_PATH = path.join(STATE_DIR, 'update-open-deb-request')
const OPEN_RELEASES_REQUEST_PATH = path.join(STATE_DIR, 'update-open-releases-request')

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }
}

function getCurrentVersion() {
  try {
    const pkgPath = path.join(__dirname, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

function readState() {
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
  return writeRequestFile(CHECK_REQUEST_PATH)
}

function requestDownload() {
  return writeRequestFile(DOWNLOAD_REQUEST_PATH)
}

function requestInstall() {
  return writeRequestFile(INSTALL_REQUEST_PATH)
}

function requestOpenDeb() {
  return writeRequestFile(OPEN_DEB_REQUEST_PATH)
}

function requestOpenReleases() {
  return writeRequestFile(OPEN_RELEASES_REQUEST_PATH)
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
  // Path constants (test-only)
  _paths: {
    STATE_DIR,
    STATE_PATH,
    CHECK_REQUEST_PATH,
    DOWNLOAD_REQUEST_PATH,
    INSTALL_REQUEST_PATH,
    OPEN_DEB_REQUEST_PATH,
    OPEN_RELEASES_REQUEST_PATH
  }
}
