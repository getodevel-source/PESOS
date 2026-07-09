import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string
let mockAppDir: string

vi.mock('./paths', () => {
  return {
    getAppDir: () => mockAppDir,
  }
})

describe('env-loader', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pesos-env-loader-'))
    mockAppDir = tmpDir
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('loads environment variables from the standard directory', async () => {
    const envPath = path.join(tmpDir, '.env.local')
    fs.writeFileSync(envPath, 'TEST_ENV_VAR=loaded_from_standard_path\nANOTHER_VAR="quoted_value"', 'utf8')

    const loadEnvFileSpy = vi.spyOn(process, 'loadEnvFile').mockImplementation((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8')
      content.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const idx = trimmed.indexOf('=')
        if (idx === -1) return
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        process.env[key] = val
      })
    })

    // Dynamic import to trigger the immediate execution of loadUserEnv
    await import('./env-loader')

    expect(loadEnvFileSpy).toHaveBeenCalledWith(envPath)
    expect(process.env.TEST_ENV_VAR).toBe('loaded_from_standard_path')
    expect(process.env.ANOTHER_VAR).toBe('quoted_value')
  })
})
