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

    // Dynamic import to trigger the immediate execution of loadUserEnv
    await import('./env-loader')

    expect(process.env.TEST_ENV_VAR).toBe('loaded_from_standard_path')
    expect(process.env.ANOTHER_VAR).toBe('quoted_value')
  })
})
