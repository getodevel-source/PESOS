'use client'

import { useState, useMemo } from 'react'
import { Plus, Check, Trash2, Award, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

export interface Habit {
  id: string
  title: string
  description?: string | null
  frequency: string
}

export interface HabitLog {
  id: string
  habit_id: string
  log_date: string
}

interface HabitListProps {
  habits: Habit[]
  logs: HabitLog[]
  onRefresh: () => void
}

export default function HabitList({ habits, logs, onRefresh }: HabitListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null)

  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('sv-SE')

  const isCompletedToday = (habitId: string) => {
    return logs.some(log => log.habit_id === habitId && log.log_date === todayStr)
  }

  // Calculate streaks counting consecutive days backward
  const getHabitStreak = (habitId: string) => {
    const habitLogs = logs
      .filter((l) => l.habit_id === habitId)
      .map((l) => l.log_date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    if (habitLogs.length === 0) return 0

    const uniqueDates = Array.from(new Set(habitLogs))
    let streak = 0
    let checkDate = new Date()

    const todayStrLocal = checkDate.toLocaleDateString('sv-SE')
    let hasToday = uniqueDates.includes(todayStrLocal)
    
    checkDate.setDate(checkDate.getDate() - 1)
    const yesterdayStr = checkDate.toLocaleDateString('sv-SE')
    let hasYesterday = uniqueDates.includes(yesterdayStr)

    if (!hasToday && !hasYesterday) {
      return 0
    }

    checkDate = new Date()
    
    while (true) {
      const checkStr = checkDate.toLocaleDateString('sv-SE')
      if (uniqueDates.includes(checkStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        if (checkStr === todayStrLocal) {
          checkDate.setDate(checkDate.getDate() - 1)
          continue
        }
        break
      }
    }

    return streak
  }

  // Get week days labels and date strings (Mon-Sun)
  const weekDays = useMemo(() => {
    const current = new Date()
    const day = current.getDay()
    const diff = current.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(current.setDate(diff))
    
    const days: { dateStr: string; label: string }[] = []
    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday)
      nextDay.setDate(monday.getDate() + i)
      days.push({
        dateStr: nextDay.toLocaleDateString('sv-SE'),
        label: labels[i]
      })
    }
    return days
  }, [])

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const { error: insertError } = await supabase.from('habits').insert({
        user_id: user.id,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        frequency: 'daily',
      })

      if (insertError) throw insertError

      setNewTitle('')
      setNewDesc('')
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear el hábito'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleHabit = async (habitId: string) => {
    const completed = isCompletedToday(habitId)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      if (completed) {
        const { error: deleteError } = await supabase
          .from('habit_logs')
          .delete()
          .eq('habit_id', habitId)
          .eq('log_date', todayStr)

        if (deleteError) throw deleteError
      } else {
        setAnimatingHabitId(habitId)
        setTimeout(() => setAnimatingHabitId(null), 800)

        const { error: insertError } = await supabase
          .from('habit_logs')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            log_date: todayStr,
          })

        if (insertError) throw insertError
      }
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al actualizar el registro de hábito'
      setError(errorMsg)
    }
  }

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este hábito?')) return

    try {
      const { error: deleteError } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)

      if (deleteError) throw deleteError
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar el hábito'
      setError(errorMsg)
    }
  }

  const completedCount = habits.filter((h) => isCompletedToday(h.id)).length
  const totalCount = habits.length

  return (
    <div className="glass-premium rounded-2xl p-5 shadow-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Award className="h-4 w-4 text-habit-green" />
          Hábitos Diarios
        </h2>
        <span className="px-2 py-0.5 rounded bg-habit-green/10 border border-habit-green/20 text-[10px] font-bold text-emerald-300">
          {completedCount} / {totalCount}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Add Form */}
      <form onSubmit={handleCreateHabit} className="mb-4 space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nuevo hábito (ej: Meditar)..."
          required
          className="w-full px-3 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-foreground focus:outline-none focus:border-habit-green focus:ring-1 focus:ring-habit-green placeholder-slate-650 transition-all"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Descripción corta (ej: 10 mins)..."
            className="flex-1 px-3 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-foreground focus:outline-none focus:border-habit-green focus:ring-1 focus:ring-habit-green placeholder-slate-650 transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 bg-habit-green hover:bg-habit-green/95 disabled:opacity-50 text-slate-955 text-[11px] font-bold rounded-md flex items-center gap-1 btn-tactile transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3px]" />
            Crear
          </button>
        </div>
      </form>

      {/* Habits List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-habit-green/10 border border-habit-green/20 flex items-center justify-center">
              <Award className="h-6 w-6 text-habit-green opacity-60" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Sin hábitos configurados</p>
              <p className="text-[10px] text-slate-600 mt-1">Creá tu primer hábito arriba ↑</p>
            </div>
          </div>
        ) : (
          habits.map((habit) => {
            const completed = isCompletedToday(habit.id)
            const streak = getHabitStreak(habit.id)
            return (
              <div
                key={habit.id}
                className={`py-3 px-3 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                  completed
                    ? 'glass-premium border-habit-green/20 glow-habit'
                    : 'glass-premium border-white/5 hover:border-habit-green/30'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleHabit(habit.id)}
                    className="focus:outline-none focus:ring-0 cursor-pointer"
                    aria-label={completed ? "Marcar hábito como pendiente" : "Marcar hábito como completado"}
                    title={completed ? "Marcar como pendiente" : "Marcar como completado"}
                  >
                    <span className="relative flex h-4 w-4 shrink-0">
                      {animatingHabitId === habit.id && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-habit-green/40 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-4 w-4 border items-center justify-center transition-all duration-300 ${
                        completed
                          ? 'bg-habit-green border-habit-green text-slate-950 scale-105 animate-check-glow'
                          : 'border-slate-700 hover:border-slate-500 text-transparent hover:scale-105'
                      }`}>
                        <Check className="h-2.5 w-2.5 stroke-[3px]" />
                      </span>
                    </span>
                  </button>
                  <div className="min-w-0 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p
                        className={`text-xs font-semibold leading-normal truncate transition-colors ${
                          completed ? 'text-emerald-300 line-through opacity-90' : 'text-slate-200'
                        }`}
                      >
                        {habit.title}
                      </p>
                      {streak > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-500 font-bold font-mono animate-pulse bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0">
                          🔥 {streak} {streak === 1 ? 'día' : 'días'}
                        </span>
                      )}
                    </div>
                    {habit.description && (
                      <p className="text-[10px] text-slate-450 truncate mt-0.5">{habit.description}</p>
                    )}
                    
                    {/* 7-day completion grid (Mon-Sun) */}
                    <div className="flex gap-1 mt-2.5">
                      {weekDays.map((wd) => {
                        const isLogged = logs.some((l) => l.habit_id === habit.id && l.log_date === wd.dateStr)
                        return (
                          <div
                            key={wd.dateStr}
                            className={`h-4 w-4 rounded-md flex items-center justify-center text-[7px] font-bold border select-none transition-all ${
                              isLogged
                                ? 'bg-habit-green/20 border-habit-green/45 text-emerald-350 shadow-sm shadow-habit-green/5'
                                : 'bg-slate-950/40 border-white/5 text-slate-600'
                            }`}
                            title={`${wd.dateStr}: ${isLogged ? 'Realizado' : 'Pendiente'}`}
                          >
                            {wd.label}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteHabit(habit.id)}
                  title="Eliminar"
                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
