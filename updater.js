// Electron main-process updater.
//
// Wraps electron-updater and writes its state to the file-based bridge
// (`updater-bridge.js`) so the Next.js renderer can observe progress
// without IPC. The bridge file is pure Node so it can be imported from
// the Next.js route without pulling in `electron` at build time.

const fs = require('fs')
const path = require('path')
const os = require('os')
const { autoUpdater } = require('electron-updater')
const { shell } = require('electron')

const bridge = require('./updater-bridge')

const {
  CHECK_REQUEST_PATH,
  DOWNLOAD_REQUEST_PATH,
  INSTALL_REQUEST_PATH,
  OPEN_DEB_REQUEST_PATH,
  OPEN_RELEASES_REQUEST_PATH
} = bridge.getPaths()

const RELEASES_URL = 'https://github.com/getodevel-source/PESOS/releases/latest'

// Locate the .deb that electron-updater just downloaded. The library
// stores it at <cache>/<appName>/pending/<filename>, but exposes no public
// getter for the path. We scan the dir on `update-downloaded` and store
// the first .deb we find; that's the one we want to install (or open
// manually as a fallback if pkexec / dpkg is unavailable).
function findPendingDebPath() {
  const pendingDir = path.join(os.homedir(), '.cache', 'PESOS', 'pending')
  try {
    if (!fs.existsSync(pendingDir)) return null
    const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith('.deb'))
    if (files.length === 0) return null
    return path.join(pendingDir, files[0])
  } catch (err) {
    console.error('updater: failed to scan pending dir:', err)
    return null
  }
}

// Detect how the app is installed. The `electron-updater` class
// selection reads `process.resourcesPath/package-type`, but for AppImage
// builds that file is absent / unreliable (the AppImage runtime sets
// `process.env.APPIMAGE` instead). When the class is mis-detected the
// install path uses the wrong mechanism (e.g. tries `dpkg -i` on a
// CachyOS install where dpkg doesn't exist) and the user gets stuck
// with no recovery. We surface the install method in the state so the
// UI can offer the right fallback.
function detectInstallMethod() {
  if (process.env.APPIMAGE) return 'appimage'
  // /opt/pesos is the FHS path electron-builder's DEB target uses; see
  // package.json:30-50. Fall back to inspecting the install dir.
  if (process.execPath && process.execPath.startsWith('/opt/pesos/')) return 'deb'
  return 'unknown'
}

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

  // Initial state. Must include `currentVersion` so the state file
  // gets refreshed to the actual binary version on every launch —
  // otherwise a stale value (e.g. v1.0.10 from before a manual binary
  // swap) would survive because writeState merges partial into base.
  // The "Estás en la última versión" indicator in the Dashboard reads
  // from this field; if it's stale the indicator shows the wrong
  // version.
  bridge.writeState({
    status: 'idle',
    currentVersion: getCurrentVersion(),
    installMethod: detectInstallMethod()
  })

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
      progress: 100,
      pendingPath: findPendingDebPath(),
      error: null
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
        // Best-effort UX: set 'installing' state BEFORE the app exits so
        // the renderer can show a spinner / fallback. The app may exit
        // before this write is observed — that's fine; if the install
        // succeeds the new process takes over, and if it fails the
        // 'error' event will fire (or the next launch will see the old
        // state and the user can retry from the 'downloaded' panel).
        bridge.writeState({ status: 'installing' })
        // isSilent=false: let the OS show its update UI. isForceRunAfter=true.
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        console.error('updater: failed to handle install request:', err)
        bridge.writeState({
          status: 'error',
          error: (err && err.message) ? err.message : String(err)
        })
      }
    }

    // 4) Open deb manually request (fallback when pkexec / dpkg fails)
    if (fs.existsSync(OPEN_DEB_REQUEST_PATH)) {
      try {
        fs.unlinkSync(OPEN_DEB_REQUEST_PATH)
        const state = bridge.readState()
        if (state.pendingPath && fs.existsSync(state.pendingPath)) {
          // shell.openPath returns a string error message if it fails
          // (empty string on success). On Debian/Ubuntu the OS launches
          // gnome-software / kde-discover; on CachyOS or systems without
          // a DEB handler the user gets the file manager fallback.
          shell.openPath(state.pendingPath).then((errMsg) => {
            if (errMsg) {
              bridge.writeState({
                status: 'error',
                error: `No se pudo abrir el .deb automáticamente: ${errMsg}. Instalalo manualmente desde ${state.pendingPath}`
              })
            }
          }).catch((err) => {
            bridge.writeState({
              status: 'error',
              error: `Error abriendo el .deb: ${err && err.message ? err.message : String(err)}`
            })
          })
        } else {
          bridge.writeState({
            status: 'error',
            error: 'No hay un .deb descargado para abrir. Volvé a buscar actualizaciones.'
          })
        }
      } catch (err) {
        console.error('updater: failed to handle open-deb request:', err)
        bridge.writeState({
          status: 'error',
          error: (err && err.message) ? err.message : String(err)
        })
      }
    }

    // 5) Open releases page request (fallback for AppImage installs where
    // the in-place replace failed). Opens the GitHub Releases page so
    // the user can download the new AppImage manually and replace the
    // current one. This is the AppImage equivalent of the .deb fallback.
    if (fs.existsSync(OPEN_RELEASES_REQUEST_PATH)) {
      try {
        fs.unlinkSync(OPEN_RELEASES_REQUEST_PATH)
        shell.openExternal(RELEASES_URL).then((errMsg) => {
          if (errMsg) {
            bridge.writeState({
              status: 'error',
              error: `No se pudo abrir el browser: ${errMsg}. Descargá la nueva versión desde ${RELEASES_URL}`
            })
          }
        }).catch((err) => {
          bridge.writeState({
            status: 'error',
            error: `Error abriendo el browser: ${err && err.message ? err.message : String(err)}`
          })
        })
      } catch (err) {
        console.error('updater: failed to handle open-releases request:', err)
        bridge.writeState({
          status: 'error',
          error: (err && err.message) ? err.message : String(err)
        })
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
