'use client'

import { useState } from 'react'
import { Bot, Sparkles, Key, CheckCircle2, XCircle, Loader2, ArrowRight, ExternalLink } from 'lucide-react'

interface FieldState {
  value: string
  status: 'idle' | 'validating' | 'ok' | 'error'
  message?: string
}

const defaultField = (): FieldState => ({ value: '', status: 'idle' })

// StatusIcon is hoisted to module scope. Declaring it inside the
// component would create a new component identity on every render,
// which resets state and breaks memoization downstream. The
// react-hooks/static-components rule flags exactly this pattern.
function StatusIcon({ status }: { status: FieldState['status'] }) {
  if (status === 'validating') return <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
  if (status === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-red-400" />
  return null
}

export default function SetupWizard() {
  const [telegram, setTelegram] = useState<FieldState>(defaultField())
  const [gemini, setGemini] = useState<FieldState>(defaultField())
  const [opencode, setOpencode] = useState<FieldState>(defaultField())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Validate a key against the /api/ai-chat/validate endpoint
  const validateAI = async (provider: 'gemini' | 'opencode', key: string) => {
    const setter = provider === 'gemini' ? setGemini : setOpencode
    setter((s) => ({ ...s, status: 'validating' }))

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (provider === 'gemini') headers['x-google-api-key'] = key
      else headers['x-opencode-api-key'] = key

      const res = await fetch('/api/ai-chat/validate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      setter((s) => ({
        ...s,
        status: data.valid ? 'ok' : 'error',
        message: data.valid ? 'Clave válida ✓' : (data.error || 'Clave inválida'),
      }))
    } catch {
      setter((s) => ({ ...s, status: 'error', message: 'No se pudo conectar para validar' }))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    // At least one AI key required
    if (!gemini.value && !opencode.value) {
      setSaveError('Necesitás configurar al menos una clave de IA (Gemini o OpenCode).')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramBotToken: telegram.value || undefined,
          googleAiApiKey: gemini.value || undefined,
          opencodeApiKey: opencode.value || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al guardar')
      setDone(true)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  // --- Shared input styles ---
  const inputClass = (status: FieldState['status']) =>
    `w-full bg-slate-950 border rounded-lg p-2.5 text-xs focus:outline-none transition-colors font-mono ${
      status === 'ok'
        ? 'border-emerald-500 text-emerald-300'
        : status === 'error'
        ? 'border-red-500/60 text-red-300'
        : 'border-white/10 text-slate-100 focus:border-indigo-500'
    }`

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <p className="text-sm text-slate-300">Configuración guardada. Reiniciando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="PESOS" className="h-16 w-16 mx-auto object-contain rounded-2xl shadow-md border border-white/5" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            Bienvenido a PESOS
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Configurá tus claves para activar el bot de Telegram y la inteligencia artificial.
            Todo se guarda localmente en tu máquina.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">

          {/* ── Gemini ─────────────────────────────── */}
          <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/40 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Google Gemini API Key</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">Recomendado</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
              >
                Obtener gratis <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                value={gemini.value}
                onChange={(e) => setGemini({ value: e.target.value, status: 'idle' })}
                onBlur={() => gemini.value && validateAI('gemini', gemini.value)}
                placeholder="AIza..."
                className={inputClass(gemini.status)}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <StatusIcon status={gemini.status} />
              </div>
            </div>
            {gemini.message && (
              <p className={`text-[10px] ${gemini.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {gemini.message}
              </p>
            )}
          </div>

          {/* ── OpenCode ───────────────────────────── */}
          <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/40 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-bold text-slate-200">OpenCode API Key</span>
                <span className="text-[9px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded-full font-medium">Alternativa</span>
              </div>
              <a
                href="https://opencode.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5 transition-colors"
              >
                Ver planes <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                value={opencode.value}
                onChange={(e) => setOpencode({ value: e.target.value, status: 'idle' })}
                onBlur={() => opencode.value && validateAI('opencode', opencode.value)}
                placeholder="sk-..."
                className={inputClass(opencode.status)}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <StatusIcon status={opencode.status} />
              </div>
            </div>
            {opencode.message && (
              <p className={`text-[10px] ${opencode.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {opencode.message}
              </p>
            )}
          </div>

          {/* ── Telegram ───────────────────────────── */}
          <div className="space-y-1.5 p-4 rounded-xl bg-slate-950/40 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">Telegram Bot Token</span>
                <span className="text-[9px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded-full font-medium">Opcional</span>
              </div>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors"
              >
                Crear bot <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={telegram.value}
              onChange={(e) => setTelegram({ value: e.target.value, status: 'idle' })}
              placeholder="123456:ABC-DEF..."
              className={inputClass('idle')}
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Permite usar el bot &ldquo;Pesito&rdquo; para registrar gastos y tareas por Telegram.
            </p>
          </div>

          {/* ── Error global ───────────────────────── */}
          {saveError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* ── Submit ─────────────────────────────── */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 text-xs font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Guardar y comenzar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-600 leading-relaxed">
            Las claves se guardan localmente en <code className="text-slate-500">.env.local</code> y nunca salen de tu máquina.
          </p>
        </form>
      </div>
    </div>
  )
}
