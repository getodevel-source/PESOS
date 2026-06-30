'use client'

import { useEffect, useState } from 'react'

// Δ2: client-side belt-and-suspenders. The Electron main process already
// triggers the handshake after `next start` boots, so the session cookie
// is normally set before the BrowserWindow's first navigation. This client
// component exists to recover the cookie in dev mode (when Electron isn't
// the entry point) and to show a "loading" hint while the handshake is in
// flight.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  // Read the cookie synchronously at init. When Electron already set the
  // session, ready is true from the first render and we never run the
  // handshake effect. This avoids the `set-state-in-effect` antipattern
  // (calling setReady(true) inside the effect body just because a cookie
  // was already on document).
  const [ready, setReady] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.cookie.includes('session=')
  })

  useEffect(() => {
    // Cookie already present → no async handshake needed.
    if (ready) return

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

    ensureHandshake()
    return () => {
      cancelled = true
    }
  }, [ready])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-slate-400 text-xs">
        Abriendo Pesos…
      </div>
    )
  }

  return <>{children}</>
}
