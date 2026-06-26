const { app, BrowserWindow, Tray, Menu } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let tray = null
let nextProcess = null
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

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
    }, 2500)
  } else {
    mainWindow.loadURL(startUrl).catch((err) => {
      console.log('Next.js dev server not running yet? Retrying in 3s...')
      setTimeout(() => {
        mainWindow.loadURL(startUrl)
      }, 3000)
    })
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
  if (nextProcess) {
    nextProcess.kill()
  }
})
