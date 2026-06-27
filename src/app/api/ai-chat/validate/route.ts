import '@/lib/env-loader'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

// Δ3: 401 hard-fail; do not add cross-provider retry on failure.
// The 401 from the chosen provider's SDK is a hard-fail so wrong-key bugs
// surface immediately. The other provider's key is NEVER consulted as a
// fallback. This contract is intentional (proposal Assumption 3).

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()

    if (!provider || (provider !== 'gemini' && provider !== 'opencode')) {
      return NextResponse.json({ error: 'Proveedor inválido.' }, { status: 400 })
    }

    const googleKeyHeader = request.headers.get('x-google-api-key')
    const opencodeKeyHeader = request.headers.get('x-opencode-api-key')

    const googleKey = googleKeyHeader || process.env.GOOGLE_AI_API_KEY
    const opencodeKey = opencodeKeyHeader || process.env.OPENCODE_GO_API_KEY

    if (provider === 'gemini') {
      if (!googleKey) {
        return NextResponse.json({ valid: false, error: 'API key de Google no configurada.' })
      }
      try {
        const genAI = new GoogleGenerativeAI(googleKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        // Send a tiny prompt to verify key authorization.
        // Input: 4 chars, Output: tiny. Cost is effectively $0.00.
        await model.generateContent('ping')
        return NextResponse.json({ valid: true })
      } catch (err: any) {
        console.error('Gemini verification error:', err)
        return NextResponse.json({
          valid: false,
          error: err.message || 'Error de autorización con la API key de Google.',
        })
      }
    }

    if (provider === 'opencode') {
      if (!opencodeKey) {
        return NextResponse.json({ valid: false, error: 'API key de OpenCode Go no configurada.' })
      }
      try {
        const openai = new OpenAI({
          baseURL: 'https://opencode.ai/zen/go/v1',
          apiKey: opencodeKey,
          defaultHeaders: {
            'HTTP-Referer': 'https://pesos.app',
            'X-Title': 'Pesos Personal OS Verification',
          },
        })
        // List models to check connection. This uses metadata and does not burn generation tokens.
        await openai.models.list()
        return NextResponse.json({ valid: true })
      } catch (err: any) {
        console.error('OpenCode Go verification error:', err)
        return NextResponse.json({
          valid: false,
          error: err.message || 'Error de autorización con la API key de OpenCode Go.',
        })
      }
    }

    return NextResponse.json({ error: 'Proveedor no soportado.' }, { status: 400 })
  } catch (error: any) {
    console.error('API Validation endpoint error:', error)
    return NextResponse.json({ error: 'Error interno del servidor de validación.' }, { status: 500 })
  }
}
