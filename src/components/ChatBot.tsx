'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Bot, Send, User, Loader2, Sparkles, X, Settings, ChevronDown, HelpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type AIProvider = 'gemini' | 'opencode'

interface ProviderConfig {
  label: string
  envVar: string
  models: { value: string; label: string }[]
}

const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    label: 'Google Gemini',
    envVar: 'GOOGLE_AI_API_KEY',
    models: [
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Legacy) · $0.30/M · ⭐⭐⭐' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash ⚡ · $0.60/M · ⭐⭐⭐⭐' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash ⚡ · $1.50/M · ⭐⭐⭐⭐⭐' },
    ],
  },
  opencode: {
    label: 'OpenCode Go',
    envVar: 'OPENCODE_GO_API_KEY',
    models: [
      { value: 'opencode-go/deepseek-v4-flash', label: 'DeepSeek V4 Flash ⚡ · $0.28/M · ⭐⭐⭐⭐' },
      { value: 'opencode-go/mimo-v2-flash',     label: 'MiMo V2 Flash ⚡ · $0.30/M · ⭐⭐⭐'    },
      { value: 'opencode-go/qwen3.5-plus',      label: 'Qwen 3.5 Plus · ~$0.90/M · ⭐⭐⭐'     },
      { value: 'opencode-go/minimax-m2.5',      label: 'MiniMax M2.5 · $1.20/M · ⭐⭐⭐'       },
      { value: 'opencode-go/minimax-m3',        label: 'MiniMax M3 · $1.20/M · ⭐⭐⭐⭐⭐'      },
      { value: 'opencode-go/qwen3.6-plus',      label: 'Qwen 3.6 Plus · $1.95/M · ⭐⭐⭐⭐'     },
    ],
  },
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    '¡Hola! Soy **Pesito**, tu asistente personal 🤖\n\nTengo acceso a tus tareas, hábitos, recordatorios y finanzas. Podés preguntarme cosas como:\n- *"¿Qué tareas me faltan hoy?"*\n- *"¿Cuánto gasté esta semana?"*\n- *"¿Cuál fue mi último gasto?"*\n- *"¿Qué recordatorios tengo próximos?"*\n- *"¿Cómo van mis hábitos?"*',
  timestamp: new Date(),
}

function formatMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Provider config
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState(PROVIDERS.gemini.models[0].value)
  const [showSettings, setShowSettings] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Custom API keys state — lazy-init from localStorage so the seeding
  // happens at mount instead of inside an effect. This is the React 19
  // canonical pattern: useState(() => ...) runs the initializer once and
  // avoids the set-state-in-effect cascade.
  const [googleApiKey, setGoogleApiKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('peso_google_api_key') || ''
  })
  const [opencodeApiKey, setOpencodeApiKey] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('peso_opencode_api_key') || ''
  })
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'unknown'>('unknown')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Telegram bot config state — same lazy-init pattern.
  const [telegramToken, setTelegramToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('peso_telegram_bot_token') || ''
  })
  const [telegramSetupStatus, setTelegramSetupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [telegramSetupResult, setTelegramSetupResult] = useState<string | null>(null)
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('peso_telegram_bot_username') || null
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      setUserId(data?.user?.id ?? null)
    })
  }, [supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Validate the connection (efficient, runs only on demand or provider switch)
  const validateConnection = async (
    targetProvider = provider,
    customGoogle = googleApiKey,
    customOpencode = opencodeApiKey
  ) => {
    setConnectionStatus('checking')
    setValidationError(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (customGoogle) headers['x-google-api-key'] = customGoogle
      if (customOpencode) headers['x-opencode-api-key'] = customOpencode

      const res = await fetch('/api/ai-chat/validate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: targetProvider }),
      })

      if (!res.ok) {
        throw new Error('Error al conectar con el servidor de validación.')
      }

      const data = await res.json()
      if (data.valid) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
        setValidationError(data.error || 'La API key no es válida.')
      }
    } catch (err: any) {
      setConnectionStatus('disconnected')
      setValidationError(err.message || 'Error de conexión.')
    }
  }

  // Validate initially and on every provider switch. The keys are already
  // in state from the lazy initializers above, so we just call
  // validateConnection() and let its default args pick them up.
  useEffect(() => {
    validateConnection()
  }, [provider])

  // Handle Telegram dynamic webhook configuration
  const handleTelegramSetup = async () => {
    if (!telegramToken.trim()) {
      setTelegramSetupStatus('error')
      setTelegramSetupResult('Por favor, ingresá un token de bot de Telegram.')
      return
    }

    setTelegramSetupStatus('loading')
    setTelegramSetupResult(null)

    try {
      const response = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramToken.trim(),
          origin: window.location.origin,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTelegramSetupStatus('success')
        setTelegramSetupResult(`¡Pesito se conectó con éxito!`)
        setTelegramBotUsername(data.username)
        localStorage.setItem('peso_telegram_bot_token', telegramToken.trim())
        localStorage.setItem('peso_telegram_bot_username', data.username)
      } else {
        setTelegramSetupStatus('error')
        setTelegramSetupResult(data.error || 'Error al conectar el bot con Telegram.')
      }
    } catch (err: any) {
      setTelegramSetupStatus('error')
      setTelegramSetupResult(err.message || 'Error de red al intentar conectar el bot.')
    }
  }

  // When switching provider, reset to that provider's first model
  const handleProviderChange = (p: AIProvider) => {
    setProvider(p)
    setSelectedModel(PROVIDERS[p].models[0].value)
    setShowSettings(false)
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (googleApiKey) {
        headers['x-google-api-key'] = googleApiKey
      }
      if (opencodeApiKey) {
        headers['x-opencode-api-key'] = opencodeApiKey
      }

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: apiMessages,
          userId,
          provider,
          model: selectedModel,
          monthlyBudgetLimit: (() => {
            try {
              const saved = localStorage.getItem('pesos_monthly_budget_limit')
              return saved ? parseFloat(saved) : undefined
            } catch { return undefined }
          })(),
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error en la respuesta del servidor')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No se pudo leer el stream')

      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                accumulatedText += parsed.text
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText } : m))
                )
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `❌ **Error:** ${msg}\n\nVerificá que tengas configurada la API key correcta en tu \`.env.local\` o ingresala en la configuración (⚙️) del chat.`,
              }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentModels = PROVIDERS[provider].models

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl shadow-xl flex flex-col h-[calc(100vh-12rem)] max-h-[820px] min-h-[520px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-violet-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Pesito
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  connectionStatus === 'connected'
                    ? 'bg-habit-green shadow-lg shadow-habit-green/50 animate-pulse'
                    : connectionStatus === 'checking'
                    ? 'bg-amber-400 animate-ping'
                    : connectionStatus === 'disconnected'
                    ? 'bg-rose-500 shadow-lg shadow-rose-500/50'
                    : 'bg-slate-500'
                }`}
                title={
                  connectionStatus === 'connected'
                    ? 'Conectado a la API'
                    : connectionStatus === 'checking'
                    ? 'Verificando API...'
                    : connectionStatus === 'disconnected'
                    ? 'Desconectado o API inválida'
                    : 'Estado de API desconocido'
                }
              />
            </h2>
            <p className="text-[10px] text-slate-500">Asistente Personal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu((v) => !v)}
              className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-violet-400" />
              <span className="max-w-[120px] truncate">
                {currentModels.find((m) => m.value === selectedModel)?.label ?? selectedModel}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>

            {showModelMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 z-50 bg-slate-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                {currentModels.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setSelectedModel(m.value); setShowModelMenu(false) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                      selectedModel === m.value
                        ? 'bg-task-purple/20 text-violet-300'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Help */}
          <button
            onClick={() => {
              setShowHelp((v) => !v)
              setShowSettings(false)
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              showHelp
                ? 'text-violet-300 bg-task-purple/15'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
            title="Guía de interacciones"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              setShowSettings((v) => !v)
              setShowHelp(false)
            }}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              showSettings
                ? 'text-violet-300 bg-task-purple/15'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
            title="Configuración del proveedor"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setMessages([WELCOME_MESSAGE])}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all cursor-pointer"
            title="Limpiar chat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Help / Guide Panel ── */}
      {showHelp && (
        <div className="px-5 py-4 border-b border-white/[0.04] bg-slate-950/40 shrink-0 text-xs text-slate-300 space-y-4 max-h-[350px] overflow-y-auto scrollbar-thin">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-1.5 text-violet-300">
              <HelpCircle className="h-3.5 w-3.5" />
              Guía de interacciones con Pesito
            </h3>
            <button 
              onClick={() => setShowHelp(false)} 
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Preguntas Web / Chat */}
            <div className="space-y-2">
              <p className="font-semibold text-slate-200 border-b border-white/[0.04] pb-1">💬 ¿Qué le podés preguntar?</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                <li><span className="text-slate-300">"¿Qué tareas me faltan hoy?"</span></li>
                <li><span className="text-slate-300">"¿Cuánto llevo gastado esta semana en total?"</span></li>
                <li><span className="text-slate-300">"¿Cómo van mis hábitos de hoy?"</span></li>
                <li><span className="text-slate-300">"¿Cuál fue mi último gasto registrado?"</span></li>
                <li><span className="text-slate-300">"¿Tengo algún recordatorio próximo?"</span></li>
              </ul>
            </div>

            {/* Comandos de Telegram */}
            <div className="space-y-2">
              <p className="font-semibold text-slate-200 border-b border-white/[0.04] pb-1">🤖 Comandos en Telegram</p>
              <ul className="space-y-1 text-slate-400 font-mono text-[10px]">
                <li><span className="text-sky-400">/tareas</span> — Lista tus pendientes de hoy.</li>
                <li><span className="text-sky-400">/habitos</span> — Tus hábitos de hoy.</li>
                <li><span className="text-sky-400">/finanzas</span> — Resumen de gastos e ingresos.</li>
                <li><span className="text-sky-400">/resumen</span> — Resumen diario por IA.</li>
                <li><span className="text-sky-400">/agregar gasto [monto] [desc]</span> — Registra un gasto.</li>
                <li><span className="text-sky-400">/agregar tarea [título]</span> — Crea una tarea.</li>
              </ul>
            </div>
          </div>

          {/* Tareas del Agente y Guardrails */}
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5 space-y-1.5">
            <p className="font-semibold text-slate-200">🛡️ Tareas y Guardrails</p>
            <p className="text-[11px] text-slate-400 leading-normal">
              Pesito lee tus datos locales de la base de datos de Pesos para contestar tus dudas de productividad.
              <br />
              <strong className="text-rose-400">Límite de seguridad:</strong> Pesito no puede escribir código (HTML, JS, Python, etc.) ni realizar tareas ajenas a la organización personal.
            </p>
          </div>
        </div>
      )}

      {/* ── Provider Settings Panel ── */}
      {showSettings && (
        <div className="px-5 py-4 border-b border-white/[0.04] bg-slate-950/40 shrink-0 space-y-4">
          <div>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Proveedor de IA</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PROVIDERS) as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                    provider === p
                      ? 'bg-task-purple/20 border-task-purple/40 text-violet-300'
                      : 'border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  {PROVIDERS[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Google AI API Key (Gemini)</label>
              <input
                type="password"
                value={googleApiKey}
                onChange={(e) => {
                  const val = e.target.value
                  setGoogleApiKey(val)
                  localStorage.setItem('peso_google_api_key', val)
                }}
                placeholder="Ingresar API Key (o vaciar para usar .env.local)"
                className="w-full px-3 py-1.5 bg-slate-950/70 border border-white/[0.06] rounded-md text-[11px] text-foreground focus:outline-none focus:border-task-purple/50 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">OpenCode Go API Key</label>
              <input
                type="password"
                value={opencodeApiKey}
                onChange={(e) => {
                  const val = e.target.value
                  setOpencodeApiKey(val)
                  localStorage.setItem('peso_opencode_api_key', val)
                }}
                placeholder="Ingresar API Key (o vaciar para usar .env.local)"
                className="w-full px-3 py-1.5 bg-slate-950/70 border border-white/[0.06] rounded-md text-[11px] text-foreground focus:outline-none focus:border-task-purple/50 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => validateConnection(provider, googleApiKey, opencodeApiKey)}
              className="px-3 py-1.5 bg-task-purple/20 border border-task-purple/30 text-violet-300 text-[10px] rounded-md font-semibold hover:bg-task-purple/35 transition-all cursor-pointer flex items-center gap-1.5"
            >
              Probar Conexión
            </button>
            {connectionStatus === 'checking' && (
              <span className="text-[10px] text-slate-500">Verificando...</span>
            )}
            {connectionStatus === 'connected' && (
              <span className="text-[10px] text-habit-green font-semibold">✓ Conectado correctamente</span>
            )}
            {connectionStatus === 'disconnected' && (
              <span className="text-[10px] text-rose-400 font-semibold">✗ Error de conexión</span>
            )}
          </div>

          {validationError && (
            <p className="text-[9px] text-rose-400 leading-tight bg-rose-500/10 border border-rose-500/15 rounded p-2">{validationError}</p>
          )}

          <p className="text-[9px] text-slate-600">
            Si dejás las keys vacías, se utilizarán los valores predeterminados de tu servidor en <code className="bg-white/5 px-1 rounded">.env.local</code>.
          </p>

          <hr className="border-white/[0.04] my-1" />

          <div>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Conectar Bot de Telegram</p>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="text-[10px] text-slate-400 block mb-1">Telegram Bot Token</label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => {
                    const val = e.target.value
                    setTelegramToken(val)
                    localStorage.setItem('peso_telegram_bot_token', val)
                  }}
                  placeholder="Ingresar HTTP API Token del BotFather"
                  className="w-full px-3 py-1.5 bg-slate-950/70 border border-white/[0.06] rounded-md text-[11px] text-foreground focus:outline-none focus:border-task-purple/50 placeholder-slate-600"
                />
              </div>
              <button
                onClick={handleTelegramSetup}
                disabled={telegramSetupStatus === 'loading'}
                className="px-4 py-1.5 bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] rounded-md font-semibold hover:bg-sky-500/30 disabled:opacity-40 transition-all cursor-pointer h-8 shrink-0 flex items-center gap-1.5"
              >
                Conectar Webhook
              </button>
            </div>
            
            {telegramSetupResult && (
              <p className={`text-[10px] mt-2 p-2 rounded border ${
                telegramSetupStatus === 'success' 
                  ? 'text-habit-green bg-habit-green/10 border-habit-green/15' 
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/15'
              }`}>
                {telegramSetupResult}
              </p>
            )}

            {telegramBotUsername && (
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                🤖 Bot conectado:{' '}
                <a 
                  href={`https://t.me/${telegramBotUsername}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-sky-400 hover:underline font-semibold"
                >
                  @{telegramBotUsername}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-violet-300" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-task-purple/20 border border-task-purple/25 text-slate-100 rounded-tr-sm'
                  : 'bg-slate-900/60 border border-white/[0.04] text-slate-200 rounded-tl-sm'
              }`}
            >
              {msg.content === '' && isStreaming ? (
                <span className="flex items-center gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
              )}
            </div>

            {msg.role === 'user' && (
              <div className="h-6 w-6 rounded-md bg-task-purple/20 border border-task-purple/15 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-violet-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ── */}
      <div className="px-4 py-3 border-t border-white/[0.04] shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje o pregunta..."
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 bg-slate-950/50 border border-white/[0.06] rounded-xl text-xs text-foreground focus:outline-none focus:border-task-purple/50 focus:ring-1 focus:ring-task-purple/30 placeholder-slate-600 transition-all disabled:opacity-50"
            aria-label="Mensaje para el asistente"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-task-purple hover:bg-task-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer shrink-0 shadow-lg shadow-task-purple/10"
            aria-label="Enviar mensaje"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-slate-600 mt-1.5 text-center">
          <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5 font-mono">Enter</kbd>{' '}
          para enviar · Contexto completo enviado automáticamente
        </p>
      </div>
    </div>
  )
}
