import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

// Δ1: `writeState({ status: 'checking' })` then `writeState({ progress: 50 })`
// must produce a file whose `readState()` contains BOTH fields. The current
// bridge builds a fresh defaults+partial payload on every write, so the
// second call clobbers `status` back to 'idle'. This test pins the spec
// requirement (Requirement 7 — merge semantics).

let tmpDir: string

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), 'pesos-bridge-test-' + crypto.randomUUID())
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('updater-bridge — writeState merge', () => {
  it('preserves fields from previous writes when a second writeState arrives', () => {
    const bridge = require('../../updater-bridge') as {
      writeState: (partial: Record<string, unknown>) => unknown
      readState: () => Record<string, unknown>
    }

    bridge.writeState({ status: 'checking' })
    bridge.writeState({ progress: 50 })

    const state = bridge.readState()
    expect(state.status).toBe('checking')
    expect(state.progress).toBe(50)
  })
})
