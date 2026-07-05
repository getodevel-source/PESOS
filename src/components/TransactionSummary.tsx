'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Trash2, DollarSign, ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, Target, ChevronDown, ChevronUp, Sliders, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

// Budget status type exported for Dashboard weather system
export type BudgetStatus = 'ok' | 'warning' | 'critical'

const BUDGET_KEY = 'pesos_monthly_budget_limit'

function getMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── ARS Amount Formatter ────────────────────────────────────────
// Converts raw number to ARS display string: 800000 -> "800.000"
function toARSDisplay(num: number): string {
  if (isNaN(num) || num === 0) return ''
  // Split integer and decimal parts
  const intPart = Math.floor(Math.abs(num))
  const decimalStr = (() => {
    const dec = num - Math.floor(num)
    if (dec === 0) return ''
    // Show up to 2 decimal places, trim trailing zeros
    return dec.toFixed(2).slice(1) // e.g. ".50"
  })()
  // Format integer with dots as thousand separators
  const formatted = intPart.toLocaleString('es-AR').replace(/,/g, '.')
  return formatted + decimalStr.replace('.', ',')
}

// Parses ARS display string to numeric value: "800.000,50" -> 800000.50
function parseARSInput(raw: string): number {
  if (!raw) return 0
  // Remove dots (thousand separators) and replace comma with dot (decimal)
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const val = parseFloat(normalized)
  return isNaN(val) ? 0 : val
}

// Formats a string input progressively as the user types
function formatARSOnChange(input: string): string {
  // Allow only digits, dots and one comma (decimal)
  // Strip non-numeric chars except comma
  let cleaned = input.replace(/[^0-9,]/g, '')
  // Only allow one comma
  const commaIdx = cleaned.indexOf(',')
  if (commaIdx !== -1) {
    cleaned = cleaned.slice(0, commaIdx + 1) + cleaned.slice(commaIdx + 1).replace(/,/g, '')
  }
  // Split on comma to handle decimal
  const parts = cleaned.split(',')
  const intPart = parts[0].replace(/^0+/, '') || '0'
  const decPart = parts[1] !== undefined ? ',' + parts[1].slice(0, 2) : ''
  // Format integer part with dots
  const formatted = Number(intPart).toLocaleString('es-AR').replace(/,/g, '.')
  return (formatted === '0' && !cleaned ? '' : formatted === '0' ? '' : formatted) + decPart
}
// ─────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  transaction_date: string
}

interface TransactionSummaryProps {
  transactions: Transaction[]
  onRefresh: () => void
  onBudgetStatusChange?: (status: BudgetStatus, pct: number, limit: number) => void
}

export default function TransactionSummary({ transactions, onRefresh, onBudgetStatusChange }: TransactionSummaryProps) {
  const [desc, setDesc] = useState('')
  // ARS amount: display is formatted with dots, raw is the actual number
  const [amountDisplay, setAmountDisplay] = useState('') // e.g. "800.000"
  const [amountRaw, setAmountRaw] = useState(0)          // e.g. 800000
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Currency state
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [mepRate, setMepRate] = useState<{ compra: number; venta: number; fechaActualizacion: string } | null>(null)
  const [mepLoading, setMepLoading] = useState(false)
  const [mepError, setMepError] = useState<string | null>(null)
  const fetchedMepOnce = useRef(false)

  // Budget state
  const [budgetLimit, setBudgetLimit] = useState<number>(0)
  const [budgetInput, setBudgetInput] = useState<string>('')
  const [isBudgetOpen, setIsBudgetOpen] = useState(true)
  const [sliderValue, setSliderValue] = useState<number>(0)

  const supabase = useMemo(() => createClient(), [])
  const todayStr = new Date().toLocaleDateString('sv-SE')

  // Load budget limit from profiles table on mount (or fallback to localStorage)
  useEffect(() => {
    async function loadBudget() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('monthly_budget')
          .eq('id', user.id)
          .maybeSingle()
        
        if (error) throw error
        
        if (profileData && profileData.monthly_budget !== null && Number(profileData.monthly_budget) > 0) {
          const val = Number(profileData.monthly_budget)
          setBudgetLimit(val)
          setSliderValue(val)
          setBudgetInput(toARSDisplay(val))
        } else {
          // fallback to localStorage
          const saved = localStorage.getItem(BUDGET_KEY)
          if (saved) {
            const val = parseFloat(saved)
            if (!isNaN(val) && val > 0) {
              setBudgetLimit(val)
              setSliderValue(val)
              setBudgetInput(toARSDisplay(val))
              // Sync to DB
              await supabase.from('profiles').update({ monthly_budget: val }).eq('id', user.id)
            }
          }
        }
      } catch (err) {
        console.error('Error loading budget from DB:', err)
        // fallback to localStorage
        const saved = localStorage.getItem(BUDGET_KEY)
        if (saved) {
          const val = parseFloat(saved)
          if (!isNaN(val) && val > 0) {
            setBudgetLimit(val)
            setSliderValue(val)
            setBudgetInput(toARSDisplay(val))
          }
        }
      }
    }
    loadBudget()
  }, [supabase])

  // Fetch MEP rate when USD selected
  const fetchMepRate = useCallback(async () => {
    setMepLoading(true)
    setMepError(null)
    try {
      const res = await fetch('/api/exchange-rate')
      if (!res.ok) throw new Error('Error al obtener el tipo de cambio')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMepRate(data)
    } catch (err) {
      setMepError(err instanceof Error ? err.message : 'Error al obtener cotización')
    } finally {
      setMepLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currency === 'USD' && !fetchedMepOnce.current) {
      fetchedMepOnce.current = true
      fetchMepRate()
    }
  }, [currency, fetchMepRate])

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const balance = totalIncome - totalExpense

  // Monthly expense (current calendar month)
  const monthKey = getMonthKey()
  const monthlyExpense = transactions
    .filter((t) => {
      if (t.type !== 'expense') return false
      const d = new Date(t.transaction_date)
      const tKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return tKey === monthKey
    })
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Budget derived values
  const budgetPct = budgetLimit > 0 ? Math.min((monthlyExpense / budgetLimit) * 100, 100) : 0
  const budgetOverflow = budgetLimit > 0 && monthlyExpense > budgetLimit
  const budgetStatus: BudgetStatus =
    budgetLimit === 0
      ? 'ok'
      : budgetPct >= 100
      ? 'critical'
      : budgetPct >= 75
      ? 'warning'
      : 'ok'

  const budgetBarColor =
    budgetStatus === 'critical'
      ? 'from-red-600 to-rose-500'
      : budgetStatus === 'warning'
      ? 'from-amber-500 to-yellow-400'
      : 'from-emerald-500 to-teal-400'

  const budgetTextColor =
    budgetStatus === 'critical'
      ? 'text-rose-400'
      : budgetStatus === 'warning'
      ? 'text-amber-400'
      : 'text-emerald-400'

  // Notify parent of budget status changes
  const notifyParent = useCallback((status: BudgetStatus, pct: number, limit: number) => {
    onBudgetStatusChange?.(status, pct, limit)
  }, [onBudgetStatusChange])

  useEffect(() => {
    notifyParent(budgetStatus, budgetPct, budgetLimit)
  }, [budgetStatus, budgetPct, budgetLimit, notifyParent])

  const saveBudget = async (val: number) => {
    setBudgetLimit(val)
    setSliderValue(val)
    setBudgetInput(toARSDisplay(val))
    if (typeof window !== 'undefined') {
      localStorage.setItem(BUDGET_KEY, String(val))
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ monthly_budget: val })
          .eq('id', user.id)
      }
    } catch (err) {
      console.error('Error saving budget to DB:', err)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!desc.trim() || amountRaw <= 0) return
    if (currency === 'USD' && !mepRate) {
      setError('Esperando cotización del dólar MEP. Intentá en un momento.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      // Convert USD to ARS if needed
      const arsAmount = currency === 'USD' && mepRate
        ? Math.round(amountRaw * mepRate.venta * 100) / 100
        : amountRaw

      // Tag description with USD info for traceability
      const finalDesc = currency === 'USD' && mepRate
        ? `${desc.trim()} (USD ${amountRaw % 1 === 0 ? amountRaw.toFixed(0) : amountRaw.toFixed(2)} @ $${toARSDisplay(mepRate.venta)})`
        : desc.trim()

      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id,
        description: finalDesc,
        amount: arsAmount,
        type,
        transaction_date: todayStr,
      })

      if (insertError) throw insertError

      setDesc('')
      setAmountDisplay('')
      setAmountRaw(0)
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar la transacción'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransaction = async (transId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta transacción?')) return

    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transId)

      if (deleteError) throw deleteError
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar la transacción'
      setError(errorMsg)
    }
  }

  // Generate SVG Sparkline Trend data
  const sparkline = (() => {
    if (transactions.length < 2) return null
    // Get last 8 transactions in chronological order to plot progress
    const sorted = [...transactions].slice(0, 8).reverse()
    // Compute the running balance in a single pass. Using reduce avoids
    // mutating a render-scope `let` variable, which the
    // react-hooks/immutability rule flags as a side effect inside what
    // should be a pure expression.
    const pointsArray = sorted.reduce<{ point: number; balances: number[] }>(
      (acc, t) => {
        const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
        const next = acc.point + delta
        acc.balances.push(next)
        return { point: next, balances: acc.balances }
      },
      { point: 0, balances: [] }
    ).balances

    const max = Math.max(...pointsArray)
    const min = Math.min(...pointsArray)
    const valRange = max - min === 0 ? 1 : max - min

    const w = 320
    const h = 45
    const pad = 4

    const coordinates = pointsArray.map((val, idx) => {
      const x = (idx / (pointsArray.length - 1)) * (w - pad * 2) + pad
      const y = h - ((val - min) / valRange) * (h - pad * 2) - pad
      return { x, y }
    })

    const pathD = `M ${coordinates[0].x} ${coordinates[0].y} ` + coordinates.slice(1).map(c => `L ${c.x} ${c.y}`).join(' ')
    const areaD = `${pathD} L ${coordinates[coordinates.length - 1].x} ${h} L ${coordinates[0].x} ${h} Z`

    const lastBalance = pointsArray[pointsArray.length - 1] ?? 0
    return { pathD, areaD, isPositive: lastBalance >= 0 }
  })()

  return (
    <div className="glass-premium rounded-2xl p-5 shadow-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-finance-blue stroke-[3px]" />
            Finanzas de Hoy
          </h2>
          <TrendingUp className="h-4 w-4 text-finance-blue/40" />
        </div>

        {/* ── Monthly Budget Panel ─────────────────────────────────── */}
        <div className="mb-4 rounded-xl border border-white/[0.06] glass-premium overflow-hidden">
          <button
            type="button"
            onClick={() => setIsBudgetOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-finance-blue" />
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Presupuesto Mensual</span>
            </div>
            <div className="flex items-center gap-2">
              {budgetLimit > 0 && (
                <span className={`text-[10px] font-bold font-mono ${budgetTextColor}`}>
                  ${toARSDisplay(monthlyExpense) || '0'} / ${toARSDisplay(budgetLimit) || '0'}
                </span>
              )}
              {isBudgetOpen ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
            </div>
          </button>

          {isBudgetOpen && (
            <div className="px-3.5 pb-3.5 space-y-3">
              {budgetLimit > 0 ? (
                <>
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Consumido este mes</span>
                      <span className={`text-[11px] font-bold font-mono ${budgetTextColor}`}>
                        {budgetPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-850 overflow-hidden relative border border-white/[0.02]">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${budgetBarColor} transition-all duration-700 ease-out relative ${budgetStatus === 'critical' ? 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' : budgetStatus === 'warning' ? 'shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}
                        style={{ width: `${budgetPct}%` }}
                      >
                        {budgetPct > 10 && (
                          <div className="absolute inset-0 bg-white/10 animate-pulse rounded-full" style={{ animationDuration: '3s' }} />
                        )}
                      </div>
                    </div>
                    {budgetOverflow && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] text-rose-455 font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.25)]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>¡Superaste el límite por ${toARSDisplay(monthlyExpense - budgetLimit)}!</span>
                      </div>
                    )}
                    {!budgetOverflow && budgetStatus === 'warning' && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Más del 75% del presupuesto consumido</span>
                      </div>
                    )}
                  </div>

                  {/* Remaining */}
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Disponible</span>
                    <span className={`font-bold font-mono ${budgetOverflow ? 'text-rose-400' : 'text-slate-300'}`}>
                      {budgetOverflow ? '-' : ''}${toARSDisplay(Math.abs(budgetLimit - monthlyExpense)) || '0'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-slate-500 text-center py-1">Establecé tu límite mensual de gastos</p>
              )}

              {/* Budget Slider + Input */}
              <div className="space-y-2 pt-1 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Sliders className="h-3 w-3 text-slate-500 shrink-0" />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold flex-1">Ajustar límite</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(e) => {
                        const formatted = formatARSOnChange(e.target.value)
                        setBudgetInput(formatted)
                        setSliderValue(parseARSInput(formatted))
                      }}
                      onBlur={() => {
                        const val = parseARSInput(budgetInput)
                        if (!isNaN(val) && val >= 0) {
                          saveBudget(val)
                          setBudgetInput(toARSDisplay(val) || '0')
                        } else {
                          setBudgetInput(toARSDisplay(budgetLimit) || '0')
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseARSInput(budgetInput)
                          if (!isNaN(val) && val >= 0) {
                            saveBudget(val)
                            setBudgetInput(toARSDisplay(val) || '0')
                          }
                        }
                      }}
                      placeholder="0"
                      className="w-24 px-2 py-0.5 bg-slate-900/60 border border-white/10 rounded text-[10px] font-mono text-slate-200 focus:outline-none focus:border-finance-blue transition-colors text-right"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(sliderValue * 1.5, 50000)}
                  step="500"
                  value={sliderValue}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setSliderValue(val)
                    setBudgetInput(toARSDisplay(val) || '0')
                  }}
                  onMouseUp={() => saveBudget(sliderValue)}
                  onTouchEnd={() => saveBudget(sliderValue)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-finance-blue"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 ${budgetLimit > 0 ? (sliderValue / Math.max(sliderValue * 1.5, 50000)) * 100 : 0}%, #1e293b ${budgetLimit > 0 ? (sliderValue / Math.max(sliderValue * 1.5, 50000)) * 100 : 0}%)`
                  }}
                />
              </div>
            </div>
          )}
        </div>
        {/* ────────────────────────────────────────────────────────── */}

        {error && (
          <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Custom SVG Sparkline Trend Chart */}
        {sparkline && (
          <div className="mb-4 bg-slate-950/30 border border-white/5 rounded-xl p-2 flex flex-col justify-between overflow-hidden">
            <span className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold mb-1 px-1">Tendencia de Hoy</span>
            <svg viewBox="0 0 320 45" className="w-full h-[45px] overflow-visible">
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkline.isPositive ? '#3b82f6' : '#ef4444'} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={sparkline.isPositive ? '#3b82f6' : '#ef4444'} stopOpacity="0.00" />
                </linearGradient>
              </defs>
              {/* Grid Line */}
              <line x1="0" y1="22.5" x2="320" y2="22.5" stroke="rgba(255,255,255,0.03)" strokeDasharray="2,2" />
              {/* Fill Area */}
              <path d={sparkline.areaD} fill="url(#sparklineGrad)" />
              {/* Line path */}
              <path d={sparkline.pathD} fill="none" stroke={sparkline.isPositive ? '#3b82f6' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="glass-premium p-2.5 rounded-lg border border-white/5 hover:border-habit-green/30 text-center flex flex-col justify-between glow-habit">
            <p className="text-[9px] uppercase tracking-wider text-habit-green font-bold flex items-center justify-center gap-0.5">
              <ArrowUpRight className="h-2.5 w-2.5 stroke-[2.5px]" />
              Ingresos
            </p>
            <p className="text-xs font-bold text-slate-200 mt-1 font-mono">${toARSDisplay(totalIncome) || '0'}</p>
          </div>
          <div className="glass-premium p-2.5 rounded-lg border border-white/5 hover:border-rose-500/30 text-center flex flex-col justify-between shadow-[0_0_12px_rgba(239,68,68,0.25)]">
            <p className="text-[9px] uppercase tracking-wider text-rose-455 font-bold flex items-center justify-center gap-0.5">
              <ArrowDownRight className="h-2.5 w-2.5 stroke-[2.5px]" />
              Gastos
            </p>
            <p className="text-xs font-bold text-slate-200 mt-1 font-mono">${toARSDisplay(totalExpense) || '0'}</p>
          </div>
          <div className="glass-premium p-2.5 rounded-lg border border-white/5 hover:border-finance-blue/30 text-center flex flex-col justify-between glow-transaction">
            <p className="text-[9px] uppercase tracking-wider text-finance-blue font-bold">Balance</p>
            <p className={`text-xs font-bold mt-1 font-mono ${balance >= 0 ? 'text-habit-green' : 'text-rose-455'}`}>
              ${toARSDisplay(balance) || '0'}
            </p>
          </div>
        </div>

        {/* Quick Transaction Form */}
        <form onSubmit={handleAddTransaction} className="mb-4 space-y-2">
          {/* Currency toggle */}
          <div className="flex items-center gap-1.5">
            <div className="flex bg-slate-950/50 p-0.5 rounded border border-white/5 w-fit">
              <button
                type="button"
                onClick={() => setCurrency('ARS')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                  currency === 'ARS'
                    ? 'bg-finance-blue/10 text-finance-blue border border-finance-blue/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                $ ARS
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrency('USD')
                  if (!fetchedMepOnce.current) {
                    fetchedMepOnce.current = true
                    fetchMepRate()
                  }
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 ${
                  currency === 'USD'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                U$D
              </button>
            </div>
            {currency === 'USD' && (
              <div className="flex items-center gap-1.5 flex-1">
                {mepLoading ? (
                  <span className="flex items-center gap-1 text-[9px] text-slate-500">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Obteniendo cotización...
                  </span>
                ) : mepError ? (
                  <button
                    type="button"
                    onClick={fetchMepRate}
                    className="text-[9px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Reintentar
                  </button>
                ) : mepRate ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] text-emerald-400 font-bold font-mono whitespace-nowrap">
                      MEP ${toARSDisplay(mepRate.venta)}
                    </span>
                    <button
                      type="button"
                      onClick={fetchMepRate}
                      title="Actualizar cotización"
                      className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors rounded"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={currency === 'USD' ? 'Descripción (ej: Netflix)...' : 'Descripción (ej: Almuerzo)...'}
              required
              className="flex-1 px-3 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-foreground focus:outline-none focus:border-finance-blue focus:ring-1 focus:ring-finance-blue placeholder-slate-650 transition-all"
            />
            <div className="relative">
              <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none ${
                currency === 'USD' ? 'text-emerald-500' : 'text-slate-500'
              }`}>
                {currency === 'USD' ? 'U$' : '$'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={(e) => {
                  const formatted = formatARSOnChange(e.target.value)
                  setAmountDisplay(formatted)
                  setAmountRaw(parseARSInput(formatted))
                }}
                onBlur={() => {
                  if (amountRaw > 0) setAmountDisplay(toARSDisplay(amountRaw))
                }}
                placeholder="0"
                required
                className={`w-32 pl-7 pr-3 py-2 bg-slate-950/40 border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 placeholder-slate-650 transition-all font-mono text-right ${
                  currency === 'USD'
                    ? 'border-emerald-500/20 focus:border-emerald-400 focus:ring-emerald-400/20'
                    : 'border-white/5 focus:border-finance-blue focus:ring-finance-blue'
                }`}
              />
            </div>
          </div>

          {/* USD conversion preview */}
          {currency === 'USD' && mepRate && amountRaw > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[10px]">
              <DollarSign className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="text-slate-400">Equivale a</span>
              <span className="font-bold font-mono text-emerald-400">${toARSDisplay(Math.round(amountRaw * mepRate.venta))}</span>
              <span className="text-slate-500">ARS al MEP venta</span>
            </div>
          )}

          <div className="flex gap-2 items-center justify-between">
            <div className="flex bg-slate-950/50 p-0.5 rounded border border-white/5">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`px-3 py-1 rounded text-[10px] font-semibold btn-tactile transition-all cursor-pointer ${
                  type === 'expense'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`px-3 py-1 rounded text-[10px] font-semibold btn-tactile transition-all cursor-pointer ${
                  type === 'income'
                    ? 'bg-emerald-500/10 text-habit-green border border-emerald-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Ingreso
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || (currency === 'USD' && mepLoading)}
              className="px-3 py-1.5 bg-finance-blue hover:bg-finance-blue/95 disabled:opacity-50 text-slate-950 text-[11px] font-bold rounded-md flex items-center gap-1.5 btn-tactile transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3px]" />
              Registrar
            </button>
          </div>
        </form>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[160px] pr-1">
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No hay transacciones hoy.</p>
          ) : (
            transactions.map((trans) => (
              <div
                key={trans.id}
                className="py-2 px-3 rounded-lg bg-slate-950/20 border border-white/5 flex items-center justify-between gap-2.5 text-xs hover:border-white/10 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-200 truncate">{trans.description}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {trans.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`font-semibold font-mono ${
                      trans.type === 'income' ? 'text-habit-green' : 'text-rose-455'
                    }`}
                  >
                    {trans.type === 'income' ? '+' : '-'}${toARSDisplay(Number(trans.amount)) || '0'}
                  </span>
                  <button
                    onClick={() => handleDeleteTransaction(trans.id)}
                    title="Eliminar"
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
