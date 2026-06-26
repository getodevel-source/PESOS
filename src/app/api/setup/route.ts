import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { supabaseUrl, supabaseAnonKey, telegramBotToken, isLocal } = await request.json()

    // Build the .env.local content
    let envContent = ''
    if (isLocal) {
      // Default local Supabase config (typical local docker setup)
      envContent = `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'}
SUPABASE_SERVICE_ROLE_KEY=eyJo...
TELEGRAM_BOT_TOKEN=${telegramBotToken || ''}
`
    } else {
      envContent = `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || ''}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey || ''}
TELEGRAM_BOT_TOKEN=${telegramBotToken || ''}
`
    }

    // Write to .env.local in the root directory
    const envPath = path.join(process.cwd(), '.env.local')
    fs.writeFileSync(envPath, envContent, 'utf-8')

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al guardar la configuración'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
