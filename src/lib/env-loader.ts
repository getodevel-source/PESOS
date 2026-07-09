import fs from 'fs'
import path from 'path'

import { getAppDir } from './paths'

// Helper to load env vars from the user's config directory (.env.local)
// This is critical because the AppImage/packaged app directories are read-only (EROFS).
export function loadUserEnv() {
  const envPath = path.join(getAppDir(), '.env.local')

  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath)
    } catch (err) {
      console.error('Failed to load env from user config directory:', err)
    }
  }
}

// Run immediately upon import
loadUserEnv()
