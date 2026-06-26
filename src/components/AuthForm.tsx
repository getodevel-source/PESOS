'use client'

import { useState } from 'react'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              telegram_username: telegramUsername,
            },
          },
        })

        if (signUpError) throw signUpError
        
        if (data?.session) {
          window.location.reload()
        } else {
          setMessage('¡Registro exitoso! Ya puedes iniciar sesión.')
          setIsSignUp(false)
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        window.location.reload()
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Ocurrió un error inesperado'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="relative w-full max-w-sm bg-panel border border-border-primary rounded-xl p-8 shadow-2xl">
        {isSignUp && (
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false)
              setError(null)
              setMessage(null)
            }}
            className="absolute left-6 top-6 text-slate-400 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
            title="Volver al inicio de sesión"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
        )}
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Pesos Logo" className="h-20 w-20 mb-3 object-contain rounded-2xl shadow-md border border-white/5" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pesos
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {isSignUp ? 'Crea tu cuenta de Pesos' : 'Inicia sesión en tu panel personal'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-primary rounded-md text-sm text-foreground placeholder-slate-600 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
                  Usuario de Telegram
                </label>
                <input
                  type="text"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border-primary rounded-md text-sm text-foreground placeholder-slate-600 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
                  placeholder="@usuario"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border-primary rounded-md text-sm text-foreground placeholder-slate-600 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-450 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2 bg-background border border-border-primary rounded-md text-sm text-foreground placeholder-slate-600 focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 mt-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-medium rounded-md border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
          >
            {loading ? 'Procesando...' : isSignUp ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs space-y-4">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setMessage(null)
            }}
            className="text-brand-indigo hover:text-accent-violet font-medium transition-colors cursor-pointer hover:underline"
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
          <div className="text-[10px] text-slate-500 pt-2 border-t border-white/[0.02]">
            Developed by{' '}
            <a
              href="https://instagram.com/geto_dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-indigo font-semibold hover:underline"
            >
              @geto_dev
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
