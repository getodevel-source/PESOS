const path = require('path')
const fs = require('fs')

let offset = 0
let isPolling = false

// Load environment variables from .env.local or .env
function loadEnv() {
  const envFiles = ['.env.local', '.env']
  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file)
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach((line) => {
        if (line.trim().startsWith('#') || !line.trim()) return
        const parts = line.split('=')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const value = parts.slice(1).join('=').trim()
          // Only set if not already set by system/shell env
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      })
      console.log(`Loaded environment variables from ${file}`)
    }
  }
}

loadEnv()

async function startTelegramPoll() {
  if (isPolling) return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('CRITICAL: No TELEGRAM_BOT_TOKEN found in environment. Bot daemon exiting.')
    process.exit(1)
  }

  isPolling = true

  // Deactivate any set webhook so we can long poll
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`)
    const data = await res.json()
    if (data.ok) {
      console.log('Webhook deleted successfully to enable local long polling.')
    }
  } catch (err) {
    console.error('Failed to clear webhook:', err)
  }

  console.log('Starting Headless Telegram Bot long polling loop...')

  const serverUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  while (isPolling) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`)
      if (!res.ok) {
        throw new Error(`Telegram returned status ${res.status}`)
      }
      const data = await res.json()
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1

          // Forward the Telegram update payload locally to Next.js API
          const targetUrl = `${serverUrl}/api/telegram`
          fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': token
            },
            body: JSON.stringify(update)
          })
          .then((response) => {
            if (!response.ok) {
              console.error(`Local API returned error status ${response.status}`)
            }
          })
          .catch((err) => {
            console.error('Failed to forward update locally to Next.js handler:', err)
          })
        }
      }
    } catch (err) {
      console.error('Telegram polling error, retrying in 5s:', err)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Stopping bot daemon...')
  isPolling = false
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Stopping bot daemon...')
  isPolling = false
  process.exit(0)
})

startTelegramPoll()
