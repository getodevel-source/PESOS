import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Electron main process updater module before importing the route.
// The route uses file-based state + request file IPC, so we just stub the
// bridge functions and assert the route calls them with the right shape.
vi.mock('@/lib/updater-bridge', () => ({
  getState: vi.fn(),
  requestCheck: vi.fn(),
  requestDownload: vi.fn(),
  requestInstall: vi.fn(),
  requestOpenDeb: vi.fn()
}))

import { GET, POST } from './route'
import { getState, requestCheck, requestDownload, requestInstall, requestOpenDeb } from '@/lib/updater-bridge'

const mockedGetState = vi.mocked(getState)
const mockedRequestCheck = vi.mocked(requestCheck)
const mockedRequestDownload = vi.mocked(requestDownload)
const mockedRequestInstall = vi.mocked(requestInstall)
const mockedRequestOpenDeb = vi.mocked(requestOpenDeb)

function makeJsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('Update route — GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the state from the updater module', async () => {
    mockedGetState.mockReturnValue({
      status: 'available',
      currentVersion: '1.0.4',
      availableVersion: '1.0.5',
      progress: 0,
      releaseNotes: 'Hardening release',
      error: null,
      timestamp: 1700000000000
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('available')
    expect(body.currentVersion).toBe('1.0.4')
    expect(body.availableVersion).toBe('1.0.5')
  })

  it('returns 500 when the updater module throws', async () => {
    mockedGetState.mockImplementation(() => {
      throw new Error('disk full')
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('disk full')
  })

  it('returns a response with all 7 bridge fields', async () => {
    // Mock the full readState contract shape. The route must serialize
    // every field as-is; the renderer reads them as a state object.
    mockedGetState.mockReturnValue({
      status: 'available',
      currentVersion: '1.0.4',
      availableVersion: '1.0.5',
      progress: 0,
      releaseNotes: 'Hardening',
      error: null,
      timestamp: 1700000000000
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('available')
    expect(body.currentVersion).toBe('1.0.4')
    expect(body.availableVersion).toBe('1.0.5')
    expect(body.progress).toBe(0)
    expect(body.releaseNotes).toBe('Hardening')
    expect(body.error).toBe(null)
    expect(body.timestamp).toBe(1700000000000)
  })

  it('reflects a recent writeState({ status: "downloading", progress: 50 }) call', async () => {
    // Simulates the bridge having just persisted a 'downloading' state
    // with 50% progress — the route must surface that exact shape.
    mockedGetState.mockReturnValue({
      status: 'downloading',
      currentVersion: '1.0.6',
      availableVersion: '1.0.7',
      progress: 50,
      releaseNotes: null,
      error: null,
      timestamp: Date.now()
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('downloading')
    expect(body.progress).toBe(50)
  })
})

describe('Update route — POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes action=check to requestCheck()', async () => {
    mockedRequestCheck.mockReturnValue(true)
    const res = await POST(makeJsonRequest({ action: 'check' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(mockedRequestCheck).toHaveBeenCalledTimes(1)
    expect(mockedRequestDownload).not.toHaveBeenCalled()
    expect(mockedRequestInstall).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.action).toBe('check')
  })

  it('routes action=download to requestDownload()', async () => {
    mockedRequestDownload.mockReturnValue(true)
    const res = await POST(makeJsonRequest({ action: 'download' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(mockedRequestDownload).toHaveBeenCalledTimes(1)
    expect(mockedRequestCheck).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.action).toBe('download')
  })

  it('routes action=install to requestInstall()', async () => {
    mockedRequestInstall.mockReturnValue(true)
    const res = await POST(makeJsonRequest({ action: 'install' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(mockedRequestInstall).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.action).toBe('install')
  })

  it('routes action=openDeb to requestOpenDeb() when a pending .deb exists', async () => {
    // The renderer asks to open the downloaded .deb manually when the
    // pkexec dialog never appears or dpkg is missing. The route must
    // surface the pendingPath so the main process can shell.openPath it.
    mockedGetState.mockReturnValue({
      status: 'downloaded',
      currentVersion: '1.0.7',
      availableVersion: '1.0.8',
      progress: 100,
      releaseNotes: null,
      error: null,
      timestamp: Date.now(),
      pendingPath: '/home/user/.cache/PESOS/pending/pesos_1.0.8_amd64.deb'
    })
    mockedRequestOpenDeb.mockReturnValue(true)

    const res = await POST(makeJsonRequest({ action: 'openDeb' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    expect(mockedRequestOpenDeb).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.action).toBe('openDeb')
    expect(body.message).toContain('pesos_1.0.8_amd64.deb')
  })

  it('rejects action=openDeb with 409 when no .deb is pending', async () => {
    // The renderer's "Abrir el .deb manualmente" button only appears when
    // pendingPath is set, but the route must defend itself against direct
    // calls in that state.
    mockedGetState.mockReturnValue({
      status: 'idle',
      currentVersion: '1.0.7',
      availableVersion: null,
      progress: 0,
      releaseNotes: null,
      error: null,
      timestamp: Date.now(),
      pendingPath: null
    })

    const res = await POST(makeJsonRequest({ action: 'openDeb' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(409)
    expect(mockedRequestOpenDeb).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toContain('No hay un .deb descargado')
  })

  it('rejects unknown actions with 400', async () => {
    const res = await POST(makeJsonRequest({ action: 'reboot-the-server' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Acción desconocida')
    expect(mockedRequestCheck).not.toHaveBeenCalled()
  })

  it('rejects empty body with 400', async () => {
    const res = await POST(makeJsonRequest({}) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(400)
  })

  it('propagates failures from the updater module as 500', async () => {
    mockedRequestCheck.mockImplementation(() => {
      throw new Error('fs error')
    })
    const res = await POST(makeJsonRequest({ action: 'check' }) as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('fs error')
  })
})
