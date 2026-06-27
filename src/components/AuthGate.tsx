'use client'

import { useEffect, useState } from 'react'

// Δ2: client-side belt-and-suspenders. The Electron main process already
// triggers the handshake after `next start` boots, so the session cookie
// is normally set before the BrowserWindow's first navigation. This client
// component exists to recover the cookie in dev mode (when Electron isn't
// the entry point) and to show a "loading" hint while the handshake is in
// flight.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function ensureHandshake() {
      try {
        const res = await fetch('/api/auth/handshake', { method: 'POST' })
        if (!cancelled && res.ok) {
          setReady(true)
        }
      } catch {
        // Network failure: leave ready=false so the user sees the loading
        // hint and can retry by reloading the window.
      }
    }

    // Skip if the cookie is already set (Electron path).
    if (typeof document !== 'undefined' && document.cookie.includes('session=')) {
      setReady(true)
      return
    }

    ensureHandshake()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-slate-400 text-xs">
        Abriendo Pesos…
      </div>
    )
  }

  return <>{children}</>
}
