import { NextResponse } from 'next/server'

// ─── Server-side cache: 5-minute TTL ──────────────────────────────────────────
let cachedRate: { compra: number; venta: number; fechaActualizacion: string } | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    const now = Date.now()

    // Return cached value if still fresh
    if (cachedRate && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ...cachedRate, cached: true })
    }

    // Fetch from dolarapi.com — free, no API key required
    const res = await fetch('https://dolarapi.com/v1/dolares/mep', {
      next: { revalidate: 300 }, // Next.js fetch cache: 5 min
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`dolarapi.com respondió con ${res.status}`)
    }

    const data = await res.json()
    // Response shape: { compra: number, venta: number, moneda: "USD", casa: "mep", fechaActualizacion: string }

    cachedRate = {
      compra: data.compra,
      venta: data.venta,
      fechaActualizacion: data.fechaActualizacion,
    }
    cacheTimestamp = now

    return NextResponse.json({ ...cachedRate, cached: false })
  } catch (error) {
    console.error('Error fetching MEP rate:', error)

    // If we have a stale cache, return it with a warning
    if (cachedRate) {
      return NextResponse.json({ ...cachedRate, cached: true, stale: true }, { status: 200 })
    }

    return NextResponse.json(
      { error: 'No se pudo obtener el tipo de cambio MEP. Intentá de nuevo.' },
      { status: 503 }
    )
  }
}
