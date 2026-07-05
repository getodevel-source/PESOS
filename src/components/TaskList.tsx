'use client'

import { useState } from 'react'
import { Plus, Check, Trash2, EyeOff, Calendar, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

export interface Task {
  id: string
  title: string
  description?: string | null
  status: 'todo' | 'done' | 'ignored'
  due_date?: string | null
  completed_at?: string | null
}

interface TaskListProps {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatTaskDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const dateFormatted = d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    })
    
    if (d.getHours() !== 0 || d.getMinutes() !== 0) {
      const timeFormatted = d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
      return `${dateFormatted} - ${timeFormatted}`
    }
    return dateFormatted
  }

  const supabase = createClient()

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      let isoDueDate: string | null = null
      if (dueDate) {
        if (dueTime) {
          isoDueDate = new Date(`${dueDate}T${dueTime}`).toISOString()
        } else {
          isoDueDate = new Date(`${dueDate}T00:00:00`).toISOString()
        }
      }

      const { error: insertError } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        status: 'todo',
        due_date: isoDueDate,
      })

      if (insertError) throw insertError

      setNewTitle('')
      setNewDesc('')
      setDueDate('')
      setDueTime('')
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear la tarea'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (taskId: string, currentStatus: 'todo' | 'done' | 'ignored') => {
    const nextStatus = currentStatus === 'todo' ? 'done' : 'todo'
    const completedAt = nextStatus === 'done' ? new Date().toISOString() : null

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: nextStatus, completed_at: completedAt })
        .eq('id', taskId)

      if (updateError) throw updateError
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al actualizar el estado'
      setError(errorMsg)
    }
  }

  const handleSetIgnored = async (taskId: string, currentStatus: 'todo' | 'done' | 'ignored') => {
    const nextStatus = currentStatus === 'ignored' ? 'todo' : 'ignored'
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', taskId)

      if (updateError) throw updateError
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al ignorar la tarea'
      setError(errorMsg)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (deleteError) throw deleteError
      onRefresh()
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al eliminar la tarea'
      setError(errorMsg)
    }
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const totalCount = tasks.length

  return (
    <div className="glass-premium rounded-2xl p-5 shadow-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Check className="h-4 w-4 text-task-purple stroke-[3px]" />
          Tareas de Hoy
        </h2>
        <span className="px-2 py-0.5 rounded bg-task-purple/10 border border-task-purple/20 text-[10px] font-bold text-violet-300">
          {doneCount} / {totalCount}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreateTask} className="mb-4 space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nueva tarea..."
          required
          className="w-full px-3 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-foreground focus:outline-none focus:border-task-purple focus:ring-1 focus:ring-task-purple placeholder-slate-650 transition-all"
          aria-label="Título de la tarea"
          title="Nueva tarea"
        />
        <input
          type="text"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Descripción (opcional)..."
          className="w-full px-3 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-foreground focus:outline-none focus:border-task-purple focus:ring-1 focus:ring-task-purple placeholder-slate-650 transition-all"
          aria-label="Descripción de la tarea"
          title="Descripción (opcional)"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 min-w-[100px] px-2 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-slate-400 focus:outline-none focus:border-task-purple focus:ring-1 focus:ring-task-purple"
            aria-label="Fecha límite"
            title="Fecha límite"
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="flex-1 min-w-[70px] px-2 py-2 bg-slate-950/40 border border-white/5 rounded-md text-xs text-slate-400 focus:outline-none focus:border-task-purple focus:ring-1 focus:ring-task-purple"
            aria-label="Hora límite"
            title="Hora límite"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-2 bg-task-purple hover:bg-task-purple/95 disabled:opacity-50 text-white text-[11px] font-bold rounded-md flex items-center gap-1 btn-tactile transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3px]" />
            Añadir
          </button>
        </div>
      </form>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No hay tareas creadas para hoy.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`py-2 px-3 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                task.status === 'done'
                  ? 'glass-premium border-purple-500/20 opacity-60'
                  : task.status === 'ignored'
                  ? 'glass-premium border-white/[0.02] opacity-35 italic'
                  : 'glass-premium border-white/5 hover:border-task-purple/30'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => handleToggleStatus(task.id, task.status)}
                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    task.status === 'done'
                      ? 'bg-task-purple border-task-purple text-white scale-105 shadow-sm shadow-task-purple/20 animate-check-glow-purple'
                      : 'border-slate-700 hover:border-slate-500 text-transparent hover:scale-105'
                  }`}
                  aria-label={task.status === 'done' ? "Marcar tarea como pendiente" : "Marcar tarea como completada"}
                  title={task.status === 'done' ? "Marcar como pendiente" : "Marcar como completada"}
                >
                  <Check className="h-2.5 w-2.5 stroke-[3px]" />
                </button>
                <div className="min-w-0 flex flex-col">
                  <p
                    className={`text-xs font-semibold leading-normal truncate transition-all ${
                      task.status === 'done' ? 'line-through text-slate-500 opacity-60' : 'text-slate-200'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-[10px] text-slate-450 truncate mt-0.5">{task.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.due_date && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-slate-400 px-1.5 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03]">
                    <Calendar className="h-2.5 w-2.5 text-task-purple" />
                    {formatTaskDate(task.due_date)}
                  </span>
                )}
                <button
                  onClick={() => handleSetIgnored(task.id, task.status)}
                  title={task.status === 'ignored' ? 'Restaurar' : 'Ignorar'}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    task.status === 'ignored'
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-slate-500 hover:text-amber-400'
                  }`}
                >
                  <EyeOff className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
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
  )
}
