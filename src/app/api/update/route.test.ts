import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Electron main process updater module before importing the route.
// The route uses file-based state + request file IPC, so we just stub the
// bridge functions and assert the route calls them with the right shape.
vi.mock('../../../../updater', () => ({
  getState: vi.fn(),
  requestCheck: vi.fn(),
  requestDownload: vi.fn(),
  requestInstall: vi.fn()
}))

import { GET, POST } from './route'
import { getState, requestCheck, requestDownload, requestInstall } from '../../../../updater'

const mockedGetState = vi.mocked(getState)
const mockedRequestCheck = vi.mocked(requestCheck)
const mockedRequestDownload = vi.mocked(requestDownload)
const mockedRequestInstall = vi.mocked(requestInstall)

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
