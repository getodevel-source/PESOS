import { NextRequest, NextResponse } from 'next/server'

// Δ1: public `setWebhook` is removed. The bot is polled locally by
// `electron.js` (`startTelegramPoll`), so this endpoint only validates
// the bot token via `getMe` and returns a deprecation note telling the
// operator to restart the desktop app to recover the local-poll flow.
export async function POST(request: NextRequest) {
  try {
    const { botToken, origin } = await request.json()

    if (!botToken) {
      return NextResponse.json({ error: 'Falta el botToken de Telegram.' }, { status: 400 })
    }

    if (!origin) {
      return NextResponse.json({ error: 'Falta la URL de origen de tu aplicación.' }, { status: 400 })
    }

    // 1. Get Bot Details first to verify the token is valid
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const meData = await getMeRes.json()

    if (!meData.ok) {
      return NextResponse.json(
        { error: meData.description || 'Token de Telegram inválido (getMe falló).' },
        { status: 400 }
      )
    }

    const botUsername = meData.result.username
    const botFirstName = meData.result.first_name

    // 2. Return the deprecation note. We DO NOT call `setWebhook` because
    // public webhook registration is disabled in v1 — the bot is polled
    // locally by `electron.js` (see `startTelegramPoll`). To recover after
    // a previous public webhook registration, `startTelegramPoll` calls
    // `deleteWebhook` on app-ready.
    return NextResponse.json({
      deprecated: true,
      message:
        'Public setWebhook is disabled. The Telegram bot is polled locally by electron.js (startTelegramPoll). Restart the desktop app to recover.',
      username: botUsername,
      name: botFirstName,
    })
  } catch (error: unknown) {
    console.error('Telegram Webhook Setup Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor al configurar el webhook.' }, { status: 500 })
  }
}
