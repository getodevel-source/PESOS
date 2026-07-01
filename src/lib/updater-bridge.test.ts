import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { createRequire } from 'node:module'

// The bridge (updater-bridge.js) computes STATE_DIR from os.homedir() once
// at module load time (it's a top-level `const`). To re-evaluate that const
// against the spy'd homedir in each test we must clear BOTH vitest's module
// cache (vi.resetModules) and Node's require.cache for the bridge path —
// otherwise the frozen constant leaks the first test's tmpDir into every
// later test, and the "auto-create" assertion becomes meaningless.

let tmpDir: string

beforeEach(() => {
  vi.resetModules()
  // updater-bridge.js is a .js CJS module; clear Node's require cache so
  // the top-level `const STATE_DIR` re-evaluates against the spy below.
  // createRequire gives us a CommonJS require function from this ESM
  // test module without triggering @typescript-eslint/no-require-imports.
  const localReq = createRequire(import.meta.url)
  const bridgePath = localReq.resolve('../../updater-bridge')
  delete localReq.cache[bridgePath]
  tmpDir = path.join(os.tmpdir(), 'pesos-bridge-test-' + crypto.randomUUID())
  vi.spyOn(os, 'homedir').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

interface Bridge {
  writeState: (partial: Record<string, unknown>) => unknown
  readState: () => Record<string, unknown>
  getState: () => Record<string, unknown>
  requestCheck: () => boolean
  requestDownload: () => boolean
  requestInstall: () => boolean
  _paths: {
    STATE_DIR: string
    STATE_PATH: string
    CHECK_REQUEST_PATH: string
    DOWNLOAD_REQUEST_PATH: string
    INSTALL_REQUEST_PATH: string
  }
}

async function loadBridge(): Promise<Bridge> {
  return (await import('../../updater-bridge')) as unknown as Bridge
}

describe('updater-bridge — writeState merge', () => {
  it('preserves fields from previous writes when a second writeState arrives', async () => {
    const bridge = await loadBridge()

    bridge.writeState({ status: 'checking' })
    bridge.writeState({ progress: 50 })

    const state = bridge.readState()
    expect(state.status).toBe('checking')
    expect(state.progress).toBe(50)
  })
})

describe('updater-bridge — readState / getState defaults', () => {
  it('readState returns the canonical 7-field default when the file is missing', async () => {
    const bridge = await loadBridge()
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')
    ) as { version: string }

    // No prior write — the file is missing, readState must return defaults.
    const state = bridge.readState()
    expect(state).toEqual({
      status: 'idle',
      currentVersion: pkg.version,
      availableVersion: null,
      progress: 0,
      releaseNotes: null,
      error: null,
      timestamp: 0
    })
  })

  it('getState is a passthrough of readState (same payload, deep-equal)', async () => {
    const bridge = await loadBridge()

    // Both functions read the same backing file and return equivalent
    // payloads (the route uses getState; the main process uses readState).
    expect(bridge.getState()).toEqual(bridge.readState())
  })
})

describe('updater-bridge — request sentinel files', () => {
  it('requestCheck writes update-check-request with content "1"', async () => {
    const bridge = await loadBridge()

    const ok = bridge.requestCheck()
    expect(ok).toBe(true)
    expect(fs.readFileSync(bridge._paths.CHECK_REQUEST_PATH, 'utf8')).toBe('1')
  })

  it('requestDownload writes update-download-request with content "1"', async () => {
    const bridge = await loadBridge()

    const ok = bridge.requestDownload()
    expect(ok).toBe(true)
    expect(fs.readFileSync(bridge._paths.DOWNLOAD_REQUEST_PATH, 'utf8')).toBe('1')
  })

  it('requestInstall writes update-install-request with content "1"', async () => {
    const bridge = await loadBridge()

    const ok = bridge.requestInstall()
    expect(ok).toBe(true)
    expect(fs.readFileSync(bridge._paths.INSTALL_REQUEST_PATH, 'utf8')).toBe('1')
  })
})

describe('updater-bridge — state dir lifecycle', () => {
  it('auto-creates the state dir on the first request', async () => {
    const bridge = await loadBridge()

    // tmpDir is unique per test (crypto.randomUUID). The bridge's
    // STATE_DIR is path.join(homedir(), '.config', 'pesos'); with the
    // beforeEach cache bust, it reflects the current spy and the
    // directory should not exist yet — making the test meaningful.
    expect(fs.existsSync(bridge._paths.STATE_DIR)).toBe(false)

    bridge.requestCheck()

    expect(fs.existsSync(bridge._paths.STATE_DIR)).toBe(true)
  })
})
