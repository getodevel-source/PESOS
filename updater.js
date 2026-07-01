// Electron main-process updater.
//
// Wraps electron-updater and writes its state to the file-based bridge
// (`updater-bridge.js`) so the Next.js renderer can observe progress
// without IPC. The bridge file is pure Node so it can be imported from
// the Next.js route without pulling in `electron` at build time.

const fs = require('fs')
const { autoUpdater } = require('electron-updater')

const bridge = require('./updater-bridge')

const {
  CHECK_REQUEST_PATH,
  DOWNLOAD_REQUEST_PATH,
  INSTALL_REQUEST_PATH
} = bridge._paths

let _checkInFlight = false
let _downloadInFlight = false

function setupAutoUpdater({ checkOnStart = true, initialCheckDelayMs = 5000 } = {}) {
  // Configure
  autoUpdater.logger = console
  // User-controlled download: the renderer drives the lifecycle via the
  // request files. Avoids surprise downloads on every launch.
  autoUpdater.autoDownload = false
  // Safety net: if the user quits while a download is in flight, finish the
  // install on the next launch.
  autoUpdater.autoInstallOnAppQuit = true

  // Initial state
  bridge.writeState({ status: 'idle' })

  // ─── electron-updater events ─────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    bridge.writeState({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    bridge.writeState({
      status: 'available',
      availableVersion: info && info.version ? info.version : null,
      releaseNotes: info && info.releaseNotes ? String(info.releaseNotes) : null,
      progress: 0,
      error: null
    })
  })

  autoUpdater.on('update-not-available', () => {
    bridge.writeState({
      status: 'idle',
      availableVersion: null,
      progress: 0,
      error: null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    bridge.writeState({
      status: 'downloading',
      progress: Math.round((progress && progress.percent) || 0)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    bridge.writeState({
      status: 'downloaded',
      availableVersion: info && info.version ? info.version : null,
      progress: 100
    })
  })

  autoUpdater.on('error', (err) => {
    bridge.writeState({
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
              bridge.writeState({
                status: 'error',
                error: (err && err.message) ? err.message : String(err)
              })
            })
            .finally(() => { _checkInFlight = false })
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
              bridge.writeState({
                status: 'error',
                error: (err && err.message) ? err.message : String(err)
              })
            })
            .finally(() => { _downloadInFlight = false })
        }
      } catch (err) {
        console.error('updater: failed to handle download request:', err)
      }
    }

    // 3) Install request
    if (fs.existsSync(INSTALL_REQUEST_PATH)) {
      try {
        fs.unlinkSync(INSTALL_REQUEST_PATH)
        // isSilent=false: let the OS show its update UI. isForceRunAfter=true.
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
        bridge.writeState({
          status: 'error',
          error: (err && err.message) ? err.message : String(err)
        })
      })
    }, initialCheckDelayMs)
  }
}

module.exports = {
  setupAutoUpdater,
  // Re-export bridge for tests
  bridge
}
