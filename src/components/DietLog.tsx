'use client'

import { useState, useEffect } from 'react'
import { Utensils, Save, Check, AlertTriangle, Loader2, Droplet, Plus, RefreshCw, Scale } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { JournalEntry } from './JournalReflection'

interface DietLogProps {
  entries: JournalEntry[]
  onRefresh: () => void
}

const FREQUENT_FOODS = [
  { name: 'Huevo duro (1 u)', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  { name: 'Pechuga de pollo (150g)', calories: 250, protein: 46, carbs: 0, fat: 5 },
  { name: 'Manzana mediana', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Avena (50g)', calories: 190, protein: 7, carbs: 32, fat: 3 },
  { name: 'Banana mediana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  { name: 'Arroz cocido (150g)', calories: 200, protein: 4, carbs: 44, fat: 0.4 },
]

// Macro Goals
const GOALS = {
  calories: 2000,
  protein: 130,
  carbs: 220,
  fat: 70,
  water: 2000,
}

export default function DietLog({ entries, onRefresh }: DietLogProps) {
  const [content, setContent] = useState('')
  const [calories, setCalories] = useState<number>(0)
  const [protein, setProtein] = useState<number>(0)
  const [carbs, setCarbs] = useState<number>(0)
  const [fat, setFat] = useState<number>(0)
  const [water, setWater] = useState<number>(0) // in ml
  const [weight, setWeight] = useState<string>('') // weight in kg as string

  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD

  // Filter entries to only get diet logs
  const dietEntries = entries.filter((e) => e.entry_type === 'diet')
  const todayEntry = dietEntries.find((e) => e.entry_date === todayStr)

  // Sync state with today's entry on load/change
  useEffect(() => {
    if (todayEntry) {
      setContent(todayEntry.content || '')
      setCalories(todayEntry.metadata?.calories || 0)
      setProtein(todayEntry.metadata?.macros?.protein || 0)
      setCarbs(todayEntry.metadata?.macros?.carbs || 0)
      setFat(todayEntry.metadata?.macros?.fat || 0)
      setWater(todayEntry.metadata?.water || 0)
      setWeight(todayEntry.metadata?.weight ? String(todayEntry.metadata.weight) : '')
    } else {
      setContent('')
      setCalories(0)
      setProtein(0)
      setCarbs(0)
      setFat(0)
      setWater(0)
      setWeight('')
    }
    setSaveSuccess(false)
  }, [todayEntry])

  const addWater = (amount: number) => {
    setWater((w) => Math.max(0, w + amount))
  }

  const resetWater = () => {
    setWater(0)
  }

  const quickAddFood = (food: typeof FREQUENT_FOODS[0]) => {
    setCalories((c) => c + food.calories)
    setProtein((p) => p + food.protein)
    setCarbs((c) => c + food.carbs)
    setFat((f) => f + food.fat)

    // Append to description log
    setContent((prev) => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed}\n- ${food.name}` : `- ${food.name}`
    })
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const metadata = {
        calories: Number(calories) || 0,
        macros: {
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
        },
        water: Number(water) || 0,
        weight: weight.trim() ? parseFloat(weight) : null,
      }

      if (todayEntry) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('journal_entries')
          .update({
            content: content.trim(),
            metadata,
          })
          .eq('id', todayEntry.id)

        if (updateError) throw updateError
      } else {
        // Create new entry
        const { error: insertError } = await supabase.from('journal_entries').insert({
          user_id: user.id,
          content: content.trim(),
          entry_type: 'diet',
          entry_date: todayStr,
          metadata,
        })

        if (insertError) throw insertError
      }

      setSaveSuccess(true)
      onRefresh()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar la dieta'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Percentages for Progress Bars
  const calPct = Math.min((calories / GOALS.calories) * 100, 100)
  const protPct = Math.min((protein / GOALS.protein) * 100, 100)
  const carbPct = Math.min((carbs / GOALS.carbs) * 100, 100)
  const fatPct = Math.min((fat / GOALS.fat) * 100, 100)
  const waterPct = Math.min((water / GOALS.water) * 100, 100)

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-6 shadow-xl h-full flex flex-col justify-between space-y-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Utensils className="h-4 w-4 text-emerald-400 stroke-[2.5px]" />
            Registro de Alimentación & Dieta
          </h2>
          <span className="text-[10px] opacity-40 font-mono">{todayStr}</span>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weight Tracker Widget */}
          <div className="md:col-span-1 bg-slate-950/30 border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Scale className="h-3.5 w-3.5 text-emerald-400" /> Control de Peso
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="00.0"
                className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-2 text-center text-sm font-mono font-bold text-slate-200 focus:outline-none focus:border-emerald-400"
              />
              <span className="text-xs text-slate-400 font-semibold font-mono">kg</span>
            </div>
          </div>

          {/* Hydration Widget */}
          <div className="md:col-span-2 bg-slate-950/30 border border-white/[0.04] p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Droplet className="h-3.5 w-3.5 text-sky-400 fill-sky-400/25" /> Hidratación
              </label>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] font-bold font-mono text-sky-400">{water}ml / {GOALS.water}ml</span>
                <button
                  type="button"
                  onClick={resetWater}
                  className="text-slate-600 hover:text-slate-400 transition-colors"
                  title="Reiniciar agua"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
            
            <div className="h-2 rounded-full bg-slate-800/40 overflow-hidden relative border border-white/[0.02]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400 transition-all duration-500 ease-out"
                style={{ width: `${waterPct}%` }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => addWater(250)}
                className="flex-1 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[9px] font-bold rounded-lg border border-sky-500/15 flex items-center justify-center gap-0.5 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" /> 250ml
              </button>
              <button
                type="button"
                onClick={() => addWater(500)}
                className="flex-1 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[9px] font-bold rounded-lg border border-sky-500/15 flex items-center justify-center gap-0.5 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" /> 500ml
              </button>
            </div>
          </div>
        </div>

        {/* Macros and Calories Section */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-slate-950/40 border border-white/[0.04] p-3 rounded-xl text-center space-y-1">
              <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider">Calorías</label>
              <input
                type="number"
                value={calories || ''}
                onChange={(e) => setCalories(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full bg-transparent text-center text-xs font-mono font-bold text-slate-200 focus:outline-none focus:text-emerald-400"
              />
              <span className="block text-[8px] text-slate-500 font-mono font-medium">/{GOALS.calories} kcal</span>
            </div>
            <div className="bg-slate-950/40 border border-white/[0.04] p-3 rounded-xl text-center space-y-1">
              <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider">Proteína</label>
              <input
                type="number"
                value={protein || ''}
                onChange={(e) => setProtein(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full bg-transparent text-center text-xs font-mono font-bold text-slate-200 focus:outline-none focus:text-emerald-400"
              />
              <span className="block text-[8px] text-slate-500 font-mono font-medium">/{GOALS.protein}g</span>
            </div>
            <div className="bg-slate-950/40 border border-white/[0.04] p-3 rounded-xl text-center space-y-1">
              <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider">Carbos</label>
              <input
                type="number"
                value={carbs || ''}
                onChange={(e) => setCarbs(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full bg-transparent text-center text-xs font-mono font-bold text-slate-200 focus:outline-none focus:text-emerald-400"
              />
              <span className="block text-[8px] text-slate-500 font-mono font-medium">/{GOALS.carbs}g</span>
            </div>
            <div className="bg-slate-950/40 border border-white/[0.04] p-3 rounded-xl text-center space-y-1">
              <label className="block text-[8px] text-slate-500 uppercase font-bold tracking-wider">Grasas</label>
              <input
                type="number"
                value={fat || ''}
                onChange={(e) => setFat(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full bg-transparent text-center text-xs font-mono font-bold text-slate-200 focus:outline-none focus:text-emerald-400"
              />
              <span className="block text-[8px] text-slate-500 font-mono font-medium">/{GOALS.fat}g</span>
            </div>
          </div>

          {/* Goals Progress visual indicators */}
          <div className="space-y-2 bg-slate-950/20 p-3 rounded-xl border border-white/[0.03]">
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-slate-500 font-bold font-mono">
                <span>Calorías diarias</span>
                <span>{calPct.toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${calPct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-0.5">
                <div className="flex justify-between text-[8px] text-slate-500 font-bold font-mono">
                  <span>Proteína</span>
                  <span>{protPct.toFixed(0)}%</span>
                </div>
                <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 transition-all duration-300" style={{ width: `${protPct}%` }} />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[8px] text-slate-500 font-bold font-mono">
                  <span>Carbos</span>
                  <span>{carbPct.toFixed(0)}%</span>
                </div>
                <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${carbPct}%` }} />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[8px] text-slate-500 font-bold font-mono">
                  <span>Grasas</span>
                  <span>{fatPct.toFixed(0)}%</span>
                </div>
                <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${fatPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Add Preset Foods */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Añadir alimento frecuente
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {FREQUENT_FOODS.map((food) => (
              <button
                key={food.name}
                type="button"
                onClick={() => quickAddFood(food)}
                className="p-2 text-left rounded-lg bg-slate-900/40 border border-white/[0.04] hover:bg-slate-900/70 hover:text-slate-100 flex flex-col justify-between gap-1 transition-all group"
              >
                <span className="text-[10px] font-semibold text-slate-300 group-hover:text-slate-100 truncate w-full">
                  {food.name}
                </span>
                <span className="text-[8px] text-slate-500 font-mono">
                  {food.calories} kcal · P:{food.protein}g C:{food.carbs}g G:{food.fat}g
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Food Description Text Area */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Detalle de Comidas
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describí tus comidas de hoy: desayuno, almuerzo, merienda, cena, colaciones..."
            className="w-full h-24 p-3 bg-slate-950/40 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 placeholder-slate-600 resize-none transition-all"
          />
        </div>

        {/* Save button and success feedback */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {saveSuccess && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 animate-fade-in font-medium">
                <Check className="h-3.5 w-3.5" />
                Guardado
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg border border-emerald-400/20 shadow-lg shadow-emerald-600/10 flex items-center gap-1.5 transition-all"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar dieta diaria
          </button>
        </div>
      </div>
    </div>
  )
}
