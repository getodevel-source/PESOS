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
  const userEnvPath = path.join(os.homedir(), '.config', 'pesos', '.env.local')
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

function startNextServer() {
  if (isDev) {
    // In development mode, we assume the server is run separately (npm run dev)
    return
  }

  // In production, start the packaged Next.js server
  const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next')
  nextProcess = spawn('node', [nextBin, 'start', '-H', '127.0.0.1', '-p', '3000'], {
    cwd: __dirname,
    // Force production mode to prevent Turbopack dev server from starting
    // and attempting to write to the read-only AppImage filesystem
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
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
          fetch(`http://localhost:3000/api/telegram?secret=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  const startUrl = 'http://localhost:3000'

  if (!isDev) {
    // Give Next.js a moment to boot
    setTimeout(() => {
      mainWindow.loadURL(startUrl).catch((err) => {
        console.error('Failed to load local server URL:', err)
      })
      // Start polling after Next.js is booted
      startTelegramPoll()
    }, 3000)
  } else {
    mainWindow.loadURL(startUrl).catch((err) => {
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
      const r = await fetch('http://127.0.0.1:3000/api/auth/handshake', { method: 'POST' })
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
    setTimeout(() => { attemptHandshake().catch(() => {}) }, 4000)
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
