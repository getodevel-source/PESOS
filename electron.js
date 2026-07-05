const { app, BrowserWindow, Tray, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const { setupAutoUpdater } = require('./updater')

let mainWindow = null
let tray = null
let nextProcess = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Load local environment variables from writable user config directory on startup
function loadEnv() {
  let userEnvPath
  if (process.platform === 'win32') {
    userEnvPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pesos', '.env.local')
  } else if (process.platform === 'darwin') {
    userEnvPath = path.join(os.homedir(), 'Library', 'Application Support', 'pesos', '.env.local')
  } else {
    userEnvPath = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'pesos', '.env.local')
  }
  const devEnvPath = path.join(__dirname, '.env.local')
  const envPath = fs.existsSync(userEnvPath) ? userEnvPath : devEnvPath

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach((line) => {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return
      const parts = line.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    })
    console.log(`Loaded environment variables from: ${envPath}`)
  }
}

loadEnv()

// Use a non-standard port in production to avoid conflicts with npm run dev (port 3000)
const PROD_PORT = '3847'
const port = isDev ? '3000' : PROD_PORT

function startNextServer() {
  if (isDev) {
    // In development mode, we assume the server is run separately (npm run dev)
    return
  }

  // In production, start the standalone Next.js server (avoids writes to read-only squashfs)
  const serverScript = path.join(__dirname, '.next', 'standalone', 'server.js')
  nextProcess = spawn('node', [serverScript], {
    cwd: path.join(__dirname, '.next', 'standalone'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: port,
      HOSTNAME: '127.0.0.1'
    }
  })

  nextProcess.stdout.on('data', (data) => {
    console.log(`Next: ${data}`)
  })

  nextProcess.stderr.on('data', (data) => {
    console.error(`Next Error: ${data}`)
  })
}

let offset = 0
let isPolling = false

async function startTelegramPoll() {
  if (isPolling) return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log('No TELEGRAM_BOT_TOKEN found in environment. Polling disabled.')
    return
  }

  isPolling = true

  // Deactivate any set webhook so we can long poll
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
    const data = await res.json()
    if (data.ok) {
      console.log('Webhook deleted successfully to enable local long polling.')
    }
  } catch (err) {
    console.error('Failed to clear webhook:', err)
  }

  console.log('Starting Telegram Bot long polling loops...')

  while (isPolling) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`)
      if (!res.ok) {
        throw new Error(`Telegram returned status ${res.status}`)
      }
      const data = await res.json()
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1

          // Forward the Telegram update payload locally to Next.js API
          fetch(`http://localhost:${port}/api/telegram`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': token
            },
            body: JSON.stringify(update)
          }).catch((err) => {
            console.error('Failed to forward update locally to Next.js handler:', err)
          })
        }
      }
    } catch (err) {
      console.error('Telegram polling error, retrying in 5s:', err)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

async function waitForNextServer(maxWaitMs = 30000, intervalMs = 500) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (r.ok) return true
    } catch {}
    await new Promise(res => setTimeout(res, intervalMs))
  }
  return false
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'PESOS Personal OS',
    icon: path.join(__dirname, 'public', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const startUrl = `http://localhost:${port}`

  if (!isDev) {
    // Show the branded loading screen immediately — no more blank white page
    const loadingPage = path.join(__dirname, 'public', 'loading.html')
    mainWindow.loadFile(loadingPage).catch(() => {
      // Fallback if loadFile fails (e.g. path mismatch in AppImage)
      mainWindow.loadURL(`data:text/html,<html style="background:#080b14"><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p style="color:#00ff88;font-family:system-ui;letter-spacing:4px;font-size:13px;text-transform:uppercase">Iniciando PESOS...</p></body></html>`)
    })
    waitForNextServer(30000).then(ready => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (ready) {
          mainWindow.loadURL(startUrl).catch(err => {
            console.error('Failed to load local server URL:', err)
          })
          startTelegramPoll()
        } else {
          console.error('Next.js server did not become ready in 30s')
          mainWindow.loadURL(`data:text/html,<html style="background:#080b14"><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px"><p style="color:#ff4466;font-family:system-ui;font-size:16px;font-weight:700">Error al iniciar PESOS</p><p style="color:rgba(255,255,255,0.4);font-family:system-ui;font-size:13px">El servidor no respondió. Cerrá y volvé a abrir la aplicación.</p></body></html>`)
        }
      }
    })
  } else {
    mainWindow.loadURL(startUrl).catch(() => {
      console.log('Next.js dev server not running yet? Retrying in 3s...')
      setTimeout(() => {
        mainWindow.loadURL(startUrl)
      }, 3000)
    })
    // Start polling in dev mode too
    setTimeout(() => {
      startTelegramPoll()
    }, 4000)
  }

  // Intercept the close event to hide window instead of exiting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  // Create system tray icon
  const trayIcon = path.join(__dirname, 'public', 'logo.png')
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar PESOS',
      click: () => {
        mainWindow.show()
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('PESOS Personal OS')
  tray.setContextMenu(contextMenu)

  // Show window on double click or click
  tray.on('double-click', () => {
    mainWindow.show()
  })
}

// Update handling lives in updater.js (electron-updater) with a file-based
// state bridge for the Next.js renderer. The old `startUpdateMonitor`
// trigger-file polling was removed; see PR for the migration.

// Δ2: trigger the local-only auth handshake after `next start` is up, so
// the BrowserWindow's first navigation already has a session cookie. The
// `proxy` (Next.js 16) will pass /dashboard through without a 307 redirect.
// Retries 3× with 1s backoff to absorb the Next.js boot delay.
async function attemptHandshake(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/auth/handshake`, { method: 'POST' })
      if (r.ok) return
    } catch {
      // Next.js is not up yet — retry.
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
}

app.on('ready', () => {
  startNextServer()
  createWindow()
  createTray()
  setupAutoUpdater()
  // Wait for Next.js to boot (createWindow has a 3s delay) then call the
  // handshake. The BrowserWindow's first load happens inside createWindow.
  if (!isDev) {
    // attemptHandshake is now called after waitForNextServer inside createWindow
    // But also call it from ready handler as a safety net
    setTimeout(() => { attemptHandshake().catch(() => {}) }, 5000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  isPolling = false
  if (nextProcess) {
    nextProcess.kill()
  }
})
