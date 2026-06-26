'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

interface Props {
  children?: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900/60 backdrop-blur-md border border-red-500/25 rounded-xl shadow-lg flex flex-col items-center justify-center text-center space-y-3 min-h-[180px]">
          <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {this.props.fallbackTitle || 'Error en el módulo'}
            </h3>
            <p className="text-xs text-slate-450 mt-1 max-w-xs leading-normal">
              {this.state.error?.message || 'Ocurrió un error al cargar este componente.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded-lg transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
