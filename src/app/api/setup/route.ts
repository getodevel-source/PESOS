import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadUserEnv } from '@/lib/env-loader'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Ensure we have loaded the variables
  loadUserEnv()
  
  // Returns which env vars are currently configured (values masked)
  return NextResponse.json({
    telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    googleAiApiKey: !!process.env.GOOGLE_AI_API_KEY,
    opencodeApiKey: !!process.env.OPENCODE_GO_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { telegramBotToken, googleAiApiKey, opencodeApiKey } = await request.json()

    if (!telegramBotToken && !googleAiApiKey && !opencodeApiKey) {
      return NextResponse.json(
        { success: false, error: 'Tenés que configurar al menos una clave para continuar.' },
        { status: 400 }
      )
    }

    const configDir = path.join(os.homedir(), '.config', 'pesos')
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    // Read existing .env.local if it exists to preserve any unknown keys
    const envPath = path.join(configDir, '.env.local')
    const lines: Record<string, string> = {}

    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, 'utf-8')
      existing.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const idx = trimmed.indexOf('=')
        if (idx === -1) return
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        lines[key] = val
      })
    }

    // Overwrite only the keys the user provided
    if (telegramBotToken !== undefined && telegramBotToken !== '')
      lines['TELEGRAM_BOT_TOKEN'] = telegramBotToken
    if (googleAiApiKey !== undefined && googleAiApiKey !== '')
      lines['GOOGLE_AI_API_KEY'] = googleAiApiKey
    if (opencodeApiKey !== undefined && opencodeApiKey !== '')
      lines['OPENCODE_GO_API_KEY'] = opencodeApiKey

    // Rebuild .env.local
    const envContent =
      '# PESOS — Variables de entorno\n# Generado automáticamente por el asistente de configuración\n\n' +
      Object.entries(lines)
        .map(([k, v]) => `${k}="${v}"`)
        .join('\n') +
      '\n'

    fs.writeFileSync(envPath, envContent, 'utf-8')

    // Force reload active memory config
    loadUserEnv()

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al guardar la configuración'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
