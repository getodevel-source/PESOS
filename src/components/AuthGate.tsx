'use client'

import { useEffect, useState } from 'react'

// Δ2: client-side belt-and-suspenders. The Electron main process already
// triggers the handshake after `next start` boots, so the session cookie
// is normally set before the BrowserWindow's first navigation. This client
// component exists to recover the cookie in dev mode (when Electron isn't
// the entry point) and to show a loading hint while the handshake is in
// flight. Retries with exponential backoff so a slow server startup doesn't
// permanently block the UI.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.cookie.includes('session=')
  })

  useEffect(() => {
    if (ready) return

    let cancelled = false

    async function ensureHandshake(attempt = 0) {
      if (cancelled) return
      try {
        const res = await fetch('/api/auth/handshake', { method: 'POST' })
        if (!cancelled && res.ok) {
          setReady(true)
          return
        }
      } catch {
        // Network failure — retry below
      }
      // Retry up to 8 times with exponential backoff: 500 1000 2000 4000 …
      if (!cancelled && attempt < 8) {
        const delay = Math.min(500 * Math.pow(2, attempt), 8000)
        await new Promise(r => setTimeout(r, delay))
        ensureHandshake(attempt + 1)
      }
    }

    ensureHandshake()
    return () => { cancelled = true }
  }, [ready])

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080b14',
          color: 'rgba(0,255,136,0.7)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}
      >
        Iniciando…
      </div>
    )
  }

  return <>{children}</>
}
