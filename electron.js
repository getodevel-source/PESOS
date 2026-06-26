const { app, BrowserWindow, Tray, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

let mainWindow = null
let tray = null
let nextProcess = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Load local environment variables from .env.local on startup
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach((line) => {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return
      const parts = line.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        process.env[key] = value
      }
    })
    console.log('Loaded environment variables from .env.local')
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
  nextProcess = spawn('node', [nextBin, 'start', '-p', '3000'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' }
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

app.on('ready', () => {
  startNextServer()
  createWindow()
  createTray()
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
