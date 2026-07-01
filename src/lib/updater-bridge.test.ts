import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

// The bridge (updater-bridge.js) resolves its paths from `os.homedir()`
// inside `getPaths()`, so the value is re-evaluated on every call rather
// than frozen at module load. Combined with `vi.resetModules()` in
// `beforeEach`, each test gets a fresh bridge instance bound to a
// unique `tmpDir`. A spy on `os.homedir` is enough — no `createRequire`
// or `require.cache` surgery required.

let tmpDir: string

beforeEach(() => {
  vi.resetModules()
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
  getPaths: () => {
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

  it('preserves the error field when a later writeState arrives (the user must keep seeing the failure)', async () => {
    // Real flow: electron-updater fires the `error` event with
    // { message, code }; the next event is often `checking-for-update`
    // (status reset to 'checking') or `update-available` (a new version
    // arrived). Without merge, a status: 'available' write would clobber
    // the user's error and they would not see why the install failed.
    const bridge = await loadBridge()

    bridge.writeState({
      status: 'error',
      error: { message: 'dpkg: dependency problems prevent configuration', code: 'INSTALL_FAILED' }
    })
    bridge.writeState({ status: 'available', availableVersion: '1.0.8' })

    const state = bridge.readState()
    expect(state.status).toBe('available')
    expect(state.availableVersion).toBe('1.0.8')
    expect(state.error).toEqual({
      message: 'dpkg: dependency problems prevent configuration',
      code: 'INSTALL_FAILED'
    })
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
      timestamp: 0,
      pendingPath: null,
      installMethod: 'unknown'
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
    expect(fs.readFileSync(bridge.getPaths().CHECK_REQUEST_PATH, 'utf8')).toBe('1')
  })

  it('requestDownload writes update-download-request with content "1"', async () => {
    const bridge = await loadBridge()

    const ok = bridge.requestDownload()
    expect(ok).toBe(true)
    expect(fs.readFileSync(bridge.getPaths().DOWNLOAD_REQUEST_PATH, 'utf8')).toBe('1')
  })

  it('requestInstall writes update-install-request with content "1"', async () => {
    const bridge = await loadBridge()

    const ok = bridge.requestInstall()
    expect(ok).toBe(true)
    expect(fs.readFileSync(bridge.getPaths().INSTALL_REQUEST_PATH, 'utf8')).toBe('1')
  })
})

describe('updater-bridge — state dir lifecycle', () => {
  it('auto-creates the state dir on the first request', async () => {
    const bridge = await loadBridge()

    // tmpDir is unique per test (crypto.randomUUID). The bridge's
    // STATE_DIR is path.join(homedir(), '.config', 'pesos'); with the
    // beforeEach cache bust, it reflects the current spy and the
    // directory should not exist yet — making the test meaningful.
    expect(fs.existsSync(bridge.getPaths().STATE_DIR)).toBe(false)

    bridge.requestCheck()

    expect(fs.existsSync(bridge.getPaths().STATE_DIR)).toBe(true)
  })
})
