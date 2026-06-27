import '@/lib/env-loader'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramMessage {
  message_id?: number
  chat?: { id: number }
  from?: { username?: string; first_name?: string }
  text?: string
  voice?: { file_id: string; mime_type?: string }
}

interface TelegramPayload {
  message?: TelegramMessage
  edited_message?: TelegramMessage
  callback_query?: {
    from?: { username?: string; first_name?: string }
    message?: { chat?: { id: number } }
  }
}

// ─── Telegram API Helper ──────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

// ─── Supabase Context Builder ─────────────────────────────────────────────────

async function buildUserContext(userId: string): Promise<string> {
  const supabase = createAdminClient()
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const now = new Date()

  const [tasksResult, habitsResult, logsResult, transactionsResult, upcomingResult] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, description, status, due_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('habits').select('id, name').eq('user_id', userId).limit(20),
      supabase.from('habit_logs').select('habit_id').eq('log_date', todayStr),
      supabase
        .from('transactions')
        .select('description, amount, type, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tasks')
        .select('title, description, due_date')
        .eq('user_id', userId)
        .eq('status', 'todo')
        .gt('due_date', now.toISOString())
        .order('due_date', { ascending: true })
        .limit(10),
    ])

  const tasks = (tasksResult.data || []) as any[]
  const habits = (habitsResult.data || []) as any[]
  const habitLogs = (logsResult.data || []) as any[]
  const transactions = (transactionsResult.data || []) as any[]
  const upcoming = (upcomingResult.data || []) as any[]

  const completedHabitIds = new Set(habitLogs.map((l: any) => l.habit_id))
  const pendingTasks = tasks.filter(
    (t: any) => t.status === 'todo' && (!t.due_date || new Date(t.due_date).toLocaleDateString('sv-SE') <= todayStr)
  )
  const doneTasks = tasks.filter((t: any) => t.status === 'done')

  const todayTx = transactions.filter(
    (t: any) => new Date(t.created_at).toLocaleDateString('sv-SE') === todayStr
  )
  const expensesToday = todayTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const incomeToday = todayTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses30d = transactions.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const income30d = transactions.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0)

  const dateLabel = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return `=== CONTEXTO — HOY: ${dateLabel} ===

🗂 TAREAS PENDIENTES (${pendingTasks.length}):
${pendingTasks.length === 0 ? '  • Sin tareas pendientes' : pendingTasks.map((t: any) => `  • ${t.title}${t.due_date ? ` [${new Date(t.due_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}]` : ''}`).join('\n')}

✅ COMPLETADAS HOY (${doneTasks.length}):
${doneTasks.length === 0 ? '  • Ninguna' : doneTasks.map((t: any) => `  • ✓ ${t.title}`).join('\n')}

🔔 PRÓXIMOS RECORDATORIOS (${upcoming.length}):
${upcoming.length === 0 ? '  • Sin recordatorios futuros' : upcoming.map((t: any) => `  • ${t.title} — ${new Date(t.due_date!).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ${new Date(t.due_date!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`).join('\n')}

🔄 HÁBITOS (${completedHabitIds.size}/${habits.length} completados):
${habits.length === 0 ? '  • Sin hábitos' : habits.map((h: any) => `  • ${completedHabitIds.has(h.id) ? '✓' : '○'} ${h.name}`).join('\n')}

💰 FINANZAS HOY: Gastos $${expensesToday.toFixed(2)} | Ingresos $${incomeToday.toFixed(2)} | Balance $${(incomeToday - expensesToday).toFixed(2)}
📊 30 DÍAS: Gastado $${expenses30d.toFixed(2)} | Ingresado $${income30d.toFixed(2)} | Balance $${(income30d - expenses30d).toFixed(2)}
🧾 ÚLTIMAS 5 TX: ${transactions.slice(0, 5).map((t: any) => `${t.type === 'expense' ? '↓' : '↑'} ${t.description} $${Number(t.amount).toFixed(2)}`).join(' | ')}

=== FIN ===`
}

// ─── AI Response (non-streaming, for Telegram) ────────────────────────────────

async function getAIResponse(
  userMessage: string | { inlineData: { data: string; mimeType: string } },
  systemPrompt: string
): Promise<string> {
  // Prefer Gemini if available, fall back to OpenCode Go
  if (process.env.GOOGLE_AI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    })
    const content = typeof userMessage === 'string'
      ? userMessage
      : [userMessage, { text: 'Procesá este audio de voz y respondé siguiendo el system prompt.' }]

    const result = await model.generateContent(content)
    return result.response.text()
  }

  if (process.env.OPENCODE_GO_API_KEY) {
    if (typeof userMessage !== 'string') {
      return '⚠️ El procesamiento de voz requiere configurar GOOGLE_AI_API_KEY para utilizar Gemini multimodal.'
    }
    const openai = new OpenAI({
      baseURL: 'https://opencode.ai/zen/go/v1',
      apiKey: process.env.OPENCODE_GO_API_KEY,
      defaultHeaders: { 'HTTP-Referer': 'https://pesos.app', 'X-Title': 'Pesos Personal OS' },
    })
    const completion = await openai.chat.completions.create({
      model: 'opencode-go/deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })
    return completion.choices[0]?.message?.content || 'Sin respuesta.'
  }

  return '⚠️ No hay proveedor de IA configurado. Agregá GOOGLE_AI_API_KEY u OPENCODE_GO_API_KEY en .env.local.'
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

// Helper to parse amount strings supporting thousands and decimal separators
function parseAmount(numStr: string): number {
  if (!numStr) return 0
  if (numStr.includes('.') && numStr.includes(',')) {
    return parseFloat(numStr.replace(/\./g, '').replace(',', '.'))
  }
  if (numStr.includes(',')) {
    return parseFloat(numStr.replace(',', '.'))
  }
  if (numStr.includes('.')) {
    const parts = numStr.split('.')
    if (parts[parts.length - 1].length === 3) {
      return parseFloat(numStr.replace(/\./g, ''))
    } else {
      return parseFloat(numStr)
    }
  }
  return parseFloat(numStr)
}


// Fetch Dólar MEP rate from dolarapi.com
async function getMepRate(): Promise<{ compra: number; venta: number } | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/mep', {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return { compra: data.compra, venta: data.venta }
  } catch {
    return null
  }
}

// ARS Display Formatter for response messages
function toARSDisplay(num: number): string {
  const intPart = Math.floor(Math.abs(num))
  const decimalStr = (() => {
    const dec = num - Math.floor(num)
    if (dec === 0) return ''
    return dec.toFixed(2).slice(1)
  })()
  const formatted = intPart.toLocaleString('es-AR').replace(/,/g, '.')
  return formatted + decimalStr.replace('.', ',')
}

async function handleCommand(
  command: string,
  args: string,
  userId: string | null,
  chatId: number
): Promise<void> {
  const supabase = createAdminClient()
  const todayStr = new Date().toLocaleDateString('sv-SE')

  switch (command) {
    case '/start':
    case '/ayuda':
    case '/help': {
      await sendTelegramMessage(
        chatId,
        `🤖 *Pesos Bot — Comandos disponibles*\n\n` +
        `📋 */tareas* — Tus tareas pendientes de hoy\n` +
        `✅ */habitos* — Estado de hábitos del día\n` +
        `💰 */finanzas* — Resumen financiero de hoy\n` +
        `📊 */resumen* — Resumen completo del día\n` +
        `➕ */agregar [título]* — Crear una nueva tarea\n` +
        `💸 */gasto [monto] [moneda?] [descripción]* — Registrar un gasto (ars/usd)\n` +
        `📈 */ingreso [monto] [moneda?] [descripción]* — Registrar un ingreso (ars/usd)\n\n` +
        `💬 También podés escribirme en lenguaje natural y te respondo con IA.`
      )
      break
    }

    case '/tareas': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta. Verificá tu nombre de usuario de Telegram en el perfil de Pesos.')
        return
      }
      const { data: tasksResult } = await supabase
        .from('tasks')
        .select('title, due_date, status')
        .eq('user_id', userId)
        .eq('status', 'todo')
        .order('created_at', { ascending: false })
        .limit(15)

      const tasks = (tasksResult || []) as any[]

      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, '✅ ¡No tenés tareas pendientes! Bien hecho.')
        return
      }

      const list = tasks
        .map((t: any) =>
          `• ${t.title}${t.due_date ? ` _(${new Date(t.due_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})_` : ''}`
        )
        .join('\n')

      await sendTelegramMessage(chatId, `📋 *Tareas pendientes (${tasks.length}):*\n\n${list}`)
      break
    }

    case '/habitos': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta.')
        return
      }
      const [{ data: habitsResult }, { data: logsResult }] = await Promise.all([
        supabase.from('habits').select('id, name').eq('user_id', userId).limit(20),
        supabase.from('habit_logs').select('habit_id').eq('log_date', todayStr),
      ])

      const habits = (habitsResult || []) as any[]
      const logs = (logsResult || []) as any[]

      if (habits.length === 0) {
        await sendTelegramMessage(chatId, 'No tenés hábitos registrados todavía.')
        return
      }

      const completedIds = new Set(logs.map((l: any) => l.habit_id))
      const list = habits
        .map((h: any) => `${completedIds.has(h.id) ? '✅' : '⬜'} ${h.name}`)
        .join('\n')
      const pct = Math.round((completedIds.size / habits.length) * 100)

      await sendTelegramMessage(
        chatId,
        `🔄 *Hábitos de hoy — ${completedIds.size}/${habits.length} (${pct}%):*\n\n${list}`
      )
      break
    }

    case '/finanzas': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta.')
        return
      }
      const { data: txs } = await supabase
        .from('transactions')
        .select('description, amount, type, created_at')
        .eq('user_id', userId)
        .gte('created_at', `${todayStr}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(20)

      const transactions = (txs || []) as any[]
      const expenses = transactions.filter((t: any) => t.type === 'expense')
      const income = transactions.filter((t: any) => t.type === 'income')
      const totalExp = expenses.reduce((s: number, t: any) => s + Number(t.amount), 0)
      const totalInc = income.reduce((s: number, t: any) => s + Number(t.amount), 0)

      const txList = transactions
        .slice(0, 8)
        .map((t: any) => `${t.type === 'expense' ? '↓' : '↑'} ${t.description} *$${toARSDisplay(Number(t.amount))}*`)
        .join('\n')

      await sendTelegramMessage(
        chatId,
        `💰 *Finanzas de hoy:*\n\n` +
        `Gastos: *$${toARSDisplay(totalExp)}* | Ingresos: *$${toARSDisplay(totalInc)}* | Balance: *$${toARSDisplay(totalInc - totalExp)}*\n\n` +
        (txList ? `Movimientos:\n${txList}` : '_Sin movimientos registrados hoy._')
      )
      break
    }

    case '/resumen': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta.')
        return
      }
      const context = await buildUserContext(userId)
      const systemPrompt = `Sos Pesito, asistente personal de la app Pesos. Respondé SOLO en Telegram (texto plano con emojis, sin markdown complejo). Sé conciso y motivador. Usás español argentino informal. REGLA ESTRICTA: No escribas código (HTML, JS, etc.) ni actúes como generador de código; decliná amablemente si te lo piden.`
      const reply = await getAIResponse(
        'Dame un resumen ejecutivo de mi día en máximo 5 líneas: tareas, hábitos y finanzas. Sé concreto con los números.',
        `${systemPrompt}\n\n${context}`
      )
      await sendTelegramMessage(chatId, reply)
      break
    }

    case '/agregar': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta.')
        return
      }
      const title = args.trim()
      if (!title) {
        await sendTelegramMessage(chatId, '❌ Usá: /agregar [título de la tarea]')
        return
      }
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title,
        status: 'todo',
      })
      if (error) {
        await sendTelegramMessage(chatId, `❌ Error al crear la tarea: ${error.message}`)
      } else {
        await sendTelegramMessage(chatId, `✅ Tarea creada: *${title}*`)
      }
      break
    }

    case '/gasto':
    case '/ingreso': {
      if (!userId) {
        await sendTelegramMessage(chatId, '⚠️ No encontré tu cuenta.')
        return
      }
      const isExpense = command === '/gasto'
      // Match amount, optional currency, and description
      const match = args.trim().match(/^([\d.,]+)\s*(usd|u\$d|ars|\$)?\s+(.+)$/i)
      if (!match) {
        await sendTelegramMessage(
          chatId,
          `❌ Formato incorrecto. Usá:\n` +
          `*${command} [monto] [moneda?] [descripción]*\n` +
          `Ejemplos:\n` +
          `• \`${command} 10 usd Netflix\`\n` +
          `• \`${command} 8000 Nafta\`\n` +
          `• \`${command} 1500,50 farmacia\``
        )
        return
      }

      const rawAmountStr = match[1]
      const currencyArg = (match[2] || 'ars').toLowerCase()
      const description = match[3].trim()

      const isUsd = currencyArg === 'usd' || currencyArg === 'u$d'
      const amount = parseAmount(rawAmountStr)

      if (isNaN(amount) || amount <= 0) {
        await sendTelegramMessage(chatId, '❌ El monto ingresado no es válido.')
        return
      }

      let finalAmount = amount
      let rateDetail = ''

      if (isUsd) {
        const rates = await getMepRate()
        if (!rates) {
          await sendTelegramMessage(chatId, '❌ No se pudo obtener la cotización del dólar MEP en este momento. Intentá de nuevo.')
          return
        }
        const rate = isExpense ? rates.venta : rates.compra
        finalAmount = Math.round(amount * rate * 100) / 100
        const rateFormatted = toARSDisplay(rate)
        rateDetail = ` (USD ${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)} @ $${rateFormatted})`
      }

      const finalDescription = `${description}${rateDetail}`

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        description: finalDescription,
        amount: finalAmount,
        type: isExpense ? 'expense' : 'income',
        transaction_date: todayStr,
      })

      if (error) {
        await sendTelegramMessage(chatId, `❌ Error al registrar en la base de datos: ${error.message}`)
      } else {
        const formattedARS = toARSDisplay(finalAmount)
        if (isUsd) {
          const matchedDetail = rateDetail.split('@ $')[1]?.replace(')', '') || ''
          await sendTelegramMessage(
            chatId,
            `✅ *${isExpense ? 'Gasto' : 'Ingreso'} registrado*\n` +
            `• Descripción: ${description}\n` +
            `• Monto original: *u$d ${amount}*\n` +
            `• Equivalente: *$${formattedARS} ARS*\n` +
            `• Tipo de cambio MEP: *$${matchedDetail}*`
          )
        } else {
          await sendTelegramMessage(
            chatId,
            `✅ *${isExpense ? 'Gasto' : 'Ingreso'} registrado*\n` +
            `• Descripción: ${description}\n` +
            `• Monto: *$${formattedARS} ARS*`
          )
        }
      }
      break
    }

    default: {
      await sendTelegramMessage(chatId, `❓ Comando desconocido. Escribí */ayuda* para ver los comandos disponibles.`)
    }
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token || secret !== token) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Payload must be an object' }, { status: 400 })
    }

    const typedPayload = payload as TelegramPayload
    const message = typedPayload.message || typedPayload.edited_message || typedPayload.callback_query?.message
    const from = typedPayload.message?.from || typedPayload.edited_message?.from || typedPayload.callback_query?.from

    const chat_id = message?.chat?.id
    const username = from?.username
    const messageText = (typedPayload.message?.text || typedPayload.edited_message?.text || '').trim()
    const voice = typedPayload.message?.voice || typedPayload.edited_message?.voice

    const supabase = createAdminClient()
    let userId: string | null = null

    // Resolve user from profiles table
    if (chat_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_chat_id', chat_id)
        .maybeSingle()
      if (profile) userId = profile.id
    }

    if (!userId && username) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_username', username)
        .maybeSingle()
      if (profile) {
        userId = profile.id
        if (chat_id) {
          await supabase.from('profiles').update({ telegram_chat_id: chat_id }).eq('id', profile.id)
        }
      }
    }

    // Store raw payload for audit
    await supabase.from('inputs').insert({ user_id: userId, payload, processed: false }).throwOnError()

    // Process message if we have a chat_id and text or voice
    if (chat_id && (messageText || voice)) {
      const todayStr = new Date().toLocaleDateString('sv-SE')
      // Detect command vs free text
      if (messageText && messageText.startsWith('/')) {
        const parts = messageText.split(' ')
        const command = parts[0].toLowerCase().split('@')[0] // handle /cmd@botname
        const args = parts.slice(1).join(' ')
        await handleCommand(command, args, userId, chat_id)
      } else {
        // Free text → AI with full context
        if (!userId) {
          await sendTelegramMessage(
            chat_id,
            '⚠️ No encontré tu cuenta en Pesos. Asegurate de tener tu usuario de Telegram configurado en la app.'
          )
        } else {
          const confirmationWords = ['si', 'sí', 'confirmar', 'confirmado', 'confirmó', 'dale', 'ok', 'yes', 'de una', 'sisi', 'procede']
          const cancellationWords = ['no', 'cancelar', 'cancela', 'cancel', 'nono', 'cancela el gasto', 'cancela la transaccion']
          const normalizedMsg = messageText ? messageText.toLowerCase().replace(/[.,!?]/g, '').trim() : ''

          // Fetch user profile to check for pending transaction
          const { data: profile } = await supabase
            .from('profiles')
            .select('pending_transaction')
            .eq('id', userId)
            .maybeSingle()

          if (!voice && profile?.pending_transaction && (confirmationWords.includes(normalizedMsg) || cancellationWords.includes(normalizedMsg))) {
            if (confirmationWords.includes(normalizedMsg)) {
              // Confirm transaction!
              const tx = profile.pending_transaction as { amount: number; currency: string; description: string; type: 'expense' | 'income' }
              let finalAmount = tx.amount
              let rateDetail = ''
              const isUsd = tx.currency.toLowerCase() === 'usd' || tx.currency.toLowerCase() === 'u$d'

              if (isUsd) {
                const rates = await getMepRate()
                if (!rates) {
                  await sendTelegramMessage(chat_id, '❌ No se pudo obtener la cotización del dólar MEP en este momento para confirmar. Intentá de nuevo.')
                  return NextResponse.json({ ok: true }, { status: 200 })
                }
                const rate = tx.type === 'expense' ? rates.venta : rates.compra
                finalAmount = Math.round(tx.amount * rate * 100) / 100
                rateDetail = ` (USD ${tx.amount % 1 === 0 ? tx.amount.toFixed(0) : tx.amount.toFixed(2)} @ $${toARSDisplay(rate)})`
              }

              const { error } = await supabase.from('transactions').insert({
                user_id: userId,
                description: `${tx.description}${rateDetail}`,
                amount: finalAmount,
                type: tx.type,
                transaction_date: todayStr,
              })

              // Clear pending transaction
              await supabase.from('profiles').update({ pending_transaction: null }).eq('id', userId)

              if (error) {
                await sendTelegramMessage(chat_id, `❌ Error al registrar en la base de datos: ${error.message}`)
              } else {
                const formattedARS = toARSDisplay(finalAmount)
                if (isUsd) {
                  await sendTelegramMessage(
                    chat_id,
                    `✅ *${tx.type === 'expense' ? 'Gasto' : 'Ingreso'} registrado*\n` +
                    `• Descripción: ${tx.description}\n` +
                    `• Monto original: *u$d ${tx.amount}*\n` +
                    `• Equivalente: *$${formattedARS} ARS*\n` +
                    `• Tipo de cambio MEP: *$${rateDetail.split('@ $')[1]?.replace(')', '') || ''}*`
                  )
                } else {
                  await sendTelegramMessage(
                    chat_id,
                    `✅ *${tx.type === 'expense' ? 'Gasto' : 'Ingreso'} registrado*\n` +
                    `• Descripción: ${tx.description}\n` +
                    `• Monto: *$${formattedARS} ARS*`
                  )
                }
              }
            } else {
              // Cancel transaction!
              await supabase.from('profiles').update({ pending_transaction: null }).eq('id', userId)
              await sendTelegramMessage(chat_id, '❌ Registro cancelado.')
            }
          } else {
            // If they sent another instruction and we had a pending transaction, we clear it to avoid confusion
            if (profile?.pending_transaction) {
              await supabase.from('profiles').update({ pending_transaction: null }).eq('id', userId)
            }

            // Download voice file if present
            let aiInput: string | { inlineData: { data: string; mimeType: string } } = messageText
            if (voice) {
              try {
                const fileId = voice.file_id
                const token = process.env.TELEGRAM_BOT_TOKEN
                
                // Get file path
                const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
                if (!fileRes.ok) throw new Error('Error al obtener ruta del audio en Telegram')
                const fileData = await fileRes.json()
                const filePath = fileData.result?.file_path
                
                if (!filePath) throw new Error('No se encontró el path del archivo de voz')

                // Download file
                const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
                if (!downloadRes.ok) throw new Error('Error al descargar archivo de audio')
                
                const audioBuffer = await downloadRes.arrayBuffer()
                const audioBase64 = Buffer.from(audioBuffer).toString('base64')

                aiInput = {
                  inlineData: {
                    data: audioBase64,
                    mimeType: voice.mime_type || 'audio/ogg',
                  }
                }
              } catch (err: any) {
                await sendTelegramMessage(chat_id, `❌ Hubo un problema al descargar o procesar tu nota de voz: ${err.message}`)
                return NextResponse.json({ ok: true }, { status: 200 })
              }
            }

            const context = await buildUserContext(userId)
            const firstName = from?.first_name || 'vos'
            const systemPrompt = `Sos Pesito, asistente personal de ${firstName} en la app Pesos. Respondés por Telegram (texto plano, emojis sí, markdown mínimo). Sos conciso, motivador, en español argentino informal. Usás los datos del contexto para respuestas precisas. Nunca inventás cifras. REGLA ESTRICTA: No escribas código ni actúes como generador de código.

REGLA DE REGISTRO DE TRANSACCIONES:
Si el usuario indica que gastó o ingresó dinero (ej: "gaste 6000 en nafta", "ingresé 50 usd", "me entraron 10000 de una venta"), debes identificar el monto, la descripción, la moneda y el tipo de transacción.
- La moneda por defecto DEBE ser ARS a menos que el usuario especifique explícitamente USD (ej. "usd", "dolares", "u$d").
- En la PRIMERA LÍNEA de tu respuesta debes escribir exactamente:
CONFIRM_TX: {"amount": <monto>, "currency": "<USD o ARS>", "description": "<descripción>", "type": "expense" o "income"}
- En el texto subsiguiente, pregúntale amigablemente si quiere confirmar el registro del movimiento especificando claramente la moneda en la pregunta para que el usuario verifique si es ARS o USD (ej: "¿Querés que registre un gasto de $6.000 ARS en nafta?" o "¿Querés que registre un gasto de USD 50 en café?").`

            const reply = await getAIResponse(aiInput, `${systemPrompt}\n\n${context}`)
            
            const matchConfirm = reply.match(/CONFIRM_TX:\s*(\{[\s\S]*?\})/)
            if (matchConfirm) {
              try {
                const txData = JSON.parse(matchConfirm[1])
                // Save to profiles
                await supabase.from('profiles').update({ pending_transaction: txData }).eq('id', userId)
                
                // Strip CONFIRM_TX block for the user response
                const cleanReply = reply.replace(/CONFIRM_TX:\s*\{[\s\S]*?\}/g, '').trim()
                await sendTelegramMessage(chat_id, cleanReply)
              } catch (err) {
                await sendTelegramMessage(chat_id, reply)
              }
            } else {
              await sendTelegramMessage(chat_id, reply)
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
