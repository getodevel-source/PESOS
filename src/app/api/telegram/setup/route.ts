import { NextRequest, NextResponse } from 'next/server'

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

    // 2. Configure webhook to point to our Next.js backend
    const webhookUrl = `${origin}/api/telegram`
    const setWebhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
      }),
    })

    const webhookData = await setWebhookRes.json()

    if (webhookData.ok) {
      return NextResponse.json({
        success: true,
        username: botUsername,
        name: botFirstName,
        webhookUrl,
        message: `¡Pesito se conectó con éxito!`,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: webhookData.description || 'Error de Telegram al configurar el webhook.',
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Telegram Webhook Setup Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor al configurar el webhook.' }, { status: 500 })
  }
}
