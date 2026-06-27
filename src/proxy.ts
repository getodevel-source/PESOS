import { NextResponse, type NextRequest } from 'next/server'
import { verifySession } from '@/lib/auth-gate'

// Δ2: Next.js 16 `proxy` (renamed from `middleware` — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11).
// Gates `/dashboard/*` behind a session cookie. The handshake endpoint
// (`/api/auth/handshake`) and Next.js internals are always allowed.

const SESSION_COOKIE = 'session'
const ALLOW_LIST_PREFIXES = ['/_next/', '/api/auth/handshake']
const ALLOW_LIST_EXACT = new Set(['/favicon.ico', '/logo.png'])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (ALLOW_LIST_EXACT.has(pathname)) return NextResponse.next()
  if (ALLOW_LIST_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  if (cookie && verifySession(cookie)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/setup', request.url), 307)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
