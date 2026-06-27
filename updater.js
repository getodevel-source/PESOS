const fs = require('fs')
const path = require('path')
const os = require('os')
const { app } = require('electron')
const { autoUpdater } = require('electron-updater')

// File-based state bridge so the Next.js renderer (which has no IPC by
// default) can observe the Electron-updater state by reading these files.
// The bridge is intentional: keeping it lets the existing `route.ts` and
// Dashboard UI work without exposing `ipcRenderer` via a preload script.

const STATE_DIR = path.join(os.homedir(), '.config', 'pesos')
const STATE_PATH = path.join(STATE_DIR, 'update-state.json')
const INSTALL_REQUEST_PATH = path.join(STATE_DIR, 'update-install-request')
const CHECK_REQUEST_PATH = path.join(STATE_DIR, 'update-check-request')
const DOWNLOAD_REQUEST_PATH = path.join(STATE_DIR, 'update-download-request')

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

function writeState(partial) {
  ensureStateDir()
  const payload = {
    status: 'idle',
    currentVersion: getCurrentVersion(),
    availableVersion: null,
    progress: 0,
    releaseNotes: null,
    error: null,
    timestamp: Date.now(),
    ...partial
  }
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    console.error('updater: failed to write state:', err)
  }
  return payload
}

function readState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    }
  } catch (err) {
    console.error('updater: failed to read state:', err)
  }
  return {
    status: 'idle',
    currentVersion: getCurrentVersion(),
    availableVersion: null,
    progress: 0,
    releaseNotes: null,
    error: null,
    timestamp: 0
  }
}

let _checkInFlight = false
let _downloadInFlight = false

function setupAutoUpdater({ checkOnStart = true, initialCheckDelayMs = 5000 } = {}) {
  // Configure
  autoUpdater.logger = console
  // User-controlled download: the renderer drives the lifecycle via the
  // request files. This avoids surprise downloads on every launch.
  autoUpdater.autoDownload = false
  // Install downloaded update when the user quits (after we call quitAndInstall
  // explicitly below; autoInstallOnAppQuit is a safety net).
  autoUpdater.autoInstallOnAppQuit = true

  // Initial state
  writeState({ status: 'idle' })

  // ─── electron-updater events ─────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    writeState({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    writeState({
      status: 'available',
      availableVersion: info && info.version ? info.version : null,
      releaseNotes: info && info.releaseNotes ? String(info.releaseNotes) : null,
      progress: 0,
      error: null
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    writeState({
      status: 'idle',
      availableVersion: null,
      progress: 0,
      error: null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    writeState({
      status: 'downloading',
      progress: Math.round((progress && progress.percent) || 0)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    writeState({
      status: 'downloaded',
      availableVersion: info && info.version ? info.version : null,
      progress: 100
    })
  })

  autoUpdater.on('error', (err) => {
    writeState({
      status: 'error',
      error: (err && err.message) ? err.message : String(err)
    })
  })

  // ─── Renderer request polling (file-based IPC) ───────────────────────────

  setInterval(() => {
    // 1) Check request
    if (fs.existsSync(CHECK_REQUEST_PATH)) {
      try {
        fs.unlinkSync(CHECK_REQUEST_PATH)
        if (!_checkInFlight) {
          _checkInFlight = true
          autoUpdater.checkForUpdates()
            .catch((err) => {
              writeState({ status: 'error', error: err && err.message ? err.message : String(err) })
            })
            .finally(() => {
              _checkInFlight = false
            })
        }
      } catch (err) {
        console.error('updater: failed to handle check request:', err)
      }
    }

    // 2) Download request
    if (fs.existsSync(DOWNLOAD_REQUEST_PATH)) {
      try {
        fs.unlinkSync(DOWNLOAD_REQUEST_PATH)
        if (!_downloadInFlight) {
          _downloadInFlight = true
          autoUpdater.downloadUpdate()
            .catch((err) => {
              writeState({ status: 'error', error: err && err.message ? err.message : String(err) })
            })
            .finally(() => {
              _downloadInFlight = false
            })
        }
      } catch (err) {
        console.error('updater: failed to handle download request:', err)
      }
    }

    // 3) Install request
    if (fs.existsSync(INSTALL_REQUEST_PATH)) {
      try {
        fs.unlinkSync(INSTALL_REQUEST_PATH)
        // quitAndInstall will trigger app relaunch with the new version.
        // isSilent=false so the user sees the OS-level update UI; isForceRunAfter=true.
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        console.error('updater: failed to handle install request:', err)
      }
    }
  }, 1000)

  // Initial check on app start (after a short delay so the UI is up)
  if (checkOnStart) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        writeState({ status: 'error', error: err && err.message ? err.message : String(err) })
      })
    }, initialCheckDelayMs)
  }
}

// ─── Synchronous helpers used by the Next.js route ─────────────────────────

function getState() {
  return readState()
}

function requestCheck() {
  ensureStateDir()
  try {
    fs.writeFileSync(CHECK_REQUEST_PATH, 'check', 'utf8')
    return true
  } catch (err) {
    console.error('updater: failed to request check:', err)
    return false
  }
}

function requestDownload() {
  ensureStateDir()
  try {
    fs.writeFileSync(DOWNLOAD_REQUEST_PATH, 'download', 'utf8')
    return true
  } catch (err) {
    console.error('updater: failed to request download:', err)
    return false
  }
}

function requestInstall() {
  ensureStateDir()
  try {
    fs.writeFileSync(INSTALL_REQUEST_PATH, 'install', 'utf8')
    return true
  } catch (err) {
    console.error('updater: failed to request install:', err)
    return false
  }
}

module.exports = {
  setupAutoUpdater,
  getState,
  requestCheck,
  requestDownload,
  requestInstall,
  // Test-only exports (do not use from app code)
  _internals: {
    STATE_PATH,
    CHECK_REQUEST_PATH,
    DOWNLOAD_REQUEST_PATH,
    INSTALL_REQUEST_PATH,
    writeState,
    readState,
    getCurrentVersion
  }
}
