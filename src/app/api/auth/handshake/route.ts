import { NextResponse, type NextRequest } from 'next/server'
import { signSession } from '@/lib/auth-gate'

// Δ2: local-only IPC handshake. The Electron main process calls this
// after `next start` boots; the response sets an HttpOnly session cookie
// that the proxy (`src/proxy.ts`) verifies for every `/dashboard/*` request.
//
// Loopback-only: rejects remote callers with 403 unless the operator
// opts in via `TELEGRAM_ALLOW_REMOTE=1` (typically for ngrok tunnels).
export async function POST(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const isLoopback =
    host.startsWith('127.0.0.1') ||
    host.startsWith('localhost') ||
    host.startsWith('[::1]') ||
    xff === '127.0.0.1' ||
    xff === '::1'

  if (!isLoopback && process.env.TELEGRAM_ALLOW_REMOTE !== '1') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', signSession(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  })
  return res
}
