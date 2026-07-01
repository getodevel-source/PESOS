import { NextRequest, NextResponse } from 'next/server'
import {
  getState,
  requestCheck,
  requestDownload,
  requestInstall
} from '@/lib/updater-bridge'

export const dynamic = 'force-dynamic'

// GET /api/update — returns the current updater state. The state is written
// by the Electron main process to a file in ~/.config/pesos/update-state.json
// on every electron-updater event. This route is read-only.
export async function GET() {
  try {
    const state = getState()
    return NextResponse.json(state)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al leer el estado del actualizador'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/update { action: 'check' | 'download' | 'install' }
// Triggers the corresponding electron-updater action via a file-based
// request that the main process polls every second. The action does not
// block — the UI should re-poll GET /api/update to observe progress.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = body && typeof body === 'object' ? body.action : null

    if (action === 'check') {
      const ok = requestCheck()
      return NextResponse.json({ ok, action, message: 'Verificación de actualizaciones solicitada.' })
    }
    if (action === 'download') {
      const ok = requestDownload()
      return NextResponse.json({ ok, action, message: 'Descarga de actualización solicitada.' })
    }
    if (action === 'install') {
      const ok = requestInstall()
      return NextResponse.json({ ok, action, message: 'Instalación de actualización solicitada. La app se va a reiniciar.' })
    }

    return NextResponse.json(
      { error: `Acción desconocida: ${String(action)}. Usar 'check', 'download' o 'install'.` },
      { status: 400 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar la solicitud de actualización'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
