import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Δ3: `getDefaultProvider()` must read ~/.config/pesos/.ai-config.json
// and default to { provider: 'gemini' } when missing/unparseable.

let tmpDir: string

beforeEach(async () => {
  // Re-import the module under test for each scenario so the CONFIG_PATH
  // constant is computed against the new tmpDir.
  vi.resetModules()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pesos-ai-config-'))
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('ai-config getDefaultProvider (Δ3)', () => {
  it('reads provider override from .ai-config.json', async () => {
    const cfgPath = path.join(tmpDir, '.config', 'pesos', '.ai-config.json')
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
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
