'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Next.js Page Error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-100">Algo salió mal</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Se produjo un error al cargar la página o al conectarse con los servicios de base de datos.
          </p>
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-[10px] font-mono text-rose-300 text-left overflow-auto max-h-24">
            {error.message || 'Error del sistema de renderizado'}
          </div>
        </div>

        <button
          onClick={() => reset()}
          className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-650/90 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar Carga
        </button>
      </div>
    </div>
  )
}
