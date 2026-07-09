import path from 'path'
import os from 'os'
import fs from 'fs'

export function getAppDir(): string {
  const platform = os.platform()
  let dir = ''
  if (platform === 'win32') {
    const appData = process.env.APPDATA
    if (appData) {
      dir = path.join(appData, 'pesos')
    } else {
      dir = path.join(os.homedir(), 'AppData', 'Roaming', 'pesos')
    }
  } else if (platform === 'darwin') {
    dir = path.join(os.homedir(), 'Library', 'Application Support', 'pesos')
  } else {
    // Linux and other platforms
    const xdg = process.env.XDG_DATA_HOME
    if (xdg) {
      dir = path.join(xdg, 'pesos')
    } else {
      dir = path.join(os.homedir(), '.local', 'share', 'pesos')
    }
  }

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true })

  // Migration logic: Copy legacy config files if legacy db exists and new db does not
  const legacyDir = path.join(os.homedir(), '.config', 'pesos')
  const legacyDb = path.join(legacyDir, 'pesos.db')
  const newDb = path.join(dir, 'pesos.db')

  if (fs.existsSync(legacyDb) && !fs.existsSync(newDb)) {
    const filesToMigrate = ['pesos.db', '.env.local', '.ai-config.json']
    for (const file of filesToMigrate) {
      const legacyFile = path.join(legacyDir, file)
      const newFile = path.join(dir, file)
      if (fs.existsSync(legacyFile)) {
        try {
          fs.copyFileSync(legacyFile, newFile)
          console.log(`Migration: copied ${file} from legacy config directory to standard path`)
        } catch (err) {
          console.error(`Migration: failed to copy ${file}:`, err)
        }
      }
    }
  }

  return dir
}
