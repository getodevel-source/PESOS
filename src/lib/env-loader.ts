import fs from 'fs'
import path from 'path'
import os from 'os'

import { getAppDir } from './paths'

// Helper to load env vars from the user's config directory (.env.local)
// This is critical because the AppImage/packaged app directories are read-only (EROFS).
export function loadUserEnv() {
  const envPath = path.join(getAppDir(), '.env.local')

  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const idx = trimmed.indexOf('=')
        if (idx === -1) return
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        process.env[key] = val
      })
    } catch (err) {
      console.error('Failed to load env from user config directory:', err)
    }
  }
}

// Run immediately upon import
loadUserEnv()
