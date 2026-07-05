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

beforeEach(async () => {
  // Re-import the module under test for each scenario so the CONFIG_PATH
  // constant is computed against the new tmpDir.
  vi.resetModules()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pesos-ai-config-'))
  mockAppDir = tmpDir
})

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('ai-config getDefaultProvider (Δ3)', () => {
  it('reads provider override from .ai-config.json in standard path', async () => {
    const cfgPath = path.join(tmpDir, '.ai-config.json')
    fs.writeFileSync(cfgPath, JSON.stringify({ provider: 'opencode' }), 'utf8')

    const { getDefaultProvider } = await import('./ai-config')
    const cfg = getDefaultProvider()

    expect(cfg.provider).toBe('opencode')
  })

  it('returns { provider: "gemini" } when the config file is missing', async () => {
    // No file written — default path triggers.
    const { getDefaultProvider } = await import('./ai-config')
    const cfg = getDefaultProvider()

    expect(cfg).toEqual({ provider: 'gemini' })
  })
})
