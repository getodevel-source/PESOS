'use client'

import { useState } from 'react'
import { Server, HardDrive, Key, Globe, Info, Loader2, ArrowRight } from 'lucide-react'

export default function SetupWizard() {
  const [isLocal, setIsLocal] = useState<boolean>(true)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl,
          supabaseAnonKey,
          telegramBotToken,
          isLocal,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar la configuración')
      }

      // Refresh page after successfully writing .env.local
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 shadow-2xl space-y-6 flex flex-col">
        {/* Header */}
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="Pesos Logo" className="h-16 w-16 mx-auto object-contain rounded-2xl shadow-md border border-white/5 animate-pulse" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Asistente de Configuración</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Configurá tu base de datos para iniciar PESOS Personal OS.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Option Selector Cards */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setIsLocal(true)}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between h-36 transition-all duration-200 ${
                isLocal
                  ? 'bg-emerald-500/10 border-emerald-500 text-slate-100 shadow-md shadow-emerald-500/5'
                  : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-950/60 hover:text-slate-300'
              }`}
            >
              <HardDrive className={`h-6 w-6 ${isLocal ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <h3 className="text-xs font-bold">Instalación Local</h3>
                <p className="text-[10px] text-slate-500 leading-snug mt-1">
                  Usa Docker y base de datos Supabase en tu PC local.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsLocal(false)}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between h-36 transition-all duration-200 ${
                !isLocal
                  ? 'bg-indigo-500/10 border-indigo-500 text-slate-100 shadow-md shadow-indigo-500/5'
                  : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-950/60 hover:text-slate-300'
              }`}
            >
              <Globe className={`h-6 w-6 ${!isLocal ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div>
                <h3 className="text-xs font-bold">Instalación Remota / VPS</h3>
                <p className="text-[10px] text-slate-500 leading-snug mt-1">
                  Conecta a Supabase Cloud o un servidor en la nube.
                </p>
              </div>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 pt-2 border-t border-white/[0.03]">
            {isLocal ? (
              <div className="space-y-3 bg-slate-950/30 p-4 rounded-xl border border-white/[0.02]">
                <div className="flex gap-2 items-start">
                  <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    La instalación local asume que tienes levantado el servicio local de Supabase (`npx supabase start`). Se usará `http://127.0.0.1:54321` por defecto.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telegram Bot Token (Opcional)</label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="Pega el token de BotFather aquí si usas Telegram"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Supabase URL</label>
                  <input
                    type="url"
                    required
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xxxx.supabase.co"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Supabase Anon Key</label>
                  <input
                    type="password"
                    required
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="Pega tu clave anon_key pública de Supabase"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telegram Bot Token (Opcional)</label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="Pega el token de BotFather aquí"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-xs font-bold text-white rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all ${
              isLocal
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Guardar y comenzar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
