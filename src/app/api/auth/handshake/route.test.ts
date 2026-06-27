import { vi, describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

// Δ2: the handshake endpoint MUST validate a loopback caller, set an
// HttpOnly session cookie scoped to the dashboard origin, and return 200.
// We mock @/lib/auth-gate to keep the test isolated from the HMAC key
// generation (filesystem + crypto) and to make the cookie value
// deterministic.

const SIGNED_SESSION = 'deterministic-test-session-cookie-value'

vi.mock('@/lib/auth-gate', () => ({
  signSession: () => SIGNED_SESSION,
  verifySession: (cookie: string) => cookie === SIGNED_SESSION,
  getOrCreateSecret: () => 'mock-secret-for-test',
}))

describe('Auth Handshake Route (Δ2)', () => {
  it('loopback + correct host → 200 + Set-Cookie session=...; HttpOnly; SameSite=Lax', async () => {
    const { POST } = await import('./route')

    const request = new NextRequest('http://127.0.0.1:3000/api/auth/handshake', {
      method: 'POST',
      headers: { host: '127.0.0.1:3000' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    // The cookie MUST be HttpOnly, SameSite=Lax, scoped to '/', with a
    // 24h max-age. The exact attribute formatting is the framework's
    // responsibility, but the cookie name + value MUST be present.
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/session=/)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/Path=\//i)
    expect(setCookie).toMatch(/Max-Age=86400/)
    expect(setCookie).toContain(SIGNED_SESSION)
  })
})
