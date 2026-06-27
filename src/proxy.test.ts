import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Δ2: the proxy MUST redirect unauthenticated /dashboard requests to /setup
// (HTTP 307) and pass through authenticated ones. The allow-list covers
// the handshake endpoint, Next.js internals (`/_next/*`), and static
// assets so that asset loads are not blocked by the auth gate.

// Mocked session value; signSession() and verifySession() are deterministic.
const VALID_SESSION = 'mocked-valid-session'

vi.mock('@/lib/auth-gate', () => ({
  signSession: () => VALID_SESSION,
  verifySession: (cookie: string) => cookie === VALID_SESSION,
  getOrCreateSecret: () => 'mock-secret',
}))

describe('proxy (Next.js 16 — auth gate for /dashboard)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('redirects to /setup without a session cookie', async () => {
    const { proxy } = await import('@/proxy')
    const request = new NextRequest('http://127.0.0.1:3000/dashboard', {
      method: 'GET',
      headers: { host: '127.0.0.1:3000' },
    })

    const response = proxy(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/setup')
  })

  it('passes through with a valid session cookie', async () => {
    const { proxy } = await import('@/proxy')
    const request = new NextRequest('http://127.0.0.1:3000/dashboard', {
      method: 'GET',
      headers: {
        host: '127.0.0.1:3000',
        cookie: `session=${VALID_SESSION}`,
      },
    })

    const response = proxy(request)
    // The KEY assertion is that we did NOT redirect to /setup — i.e. the
    // response is a pass-through, not a redirect.
    const location = response.headers.get('location')
    expect(location ?? '').not.toContain('/setup')
  })
})
