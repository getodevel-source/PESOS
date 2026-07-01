'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, CheckSquare } from 'lucide-react'
import { Task } from './TaskList'

interface TaskCalendarProps {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskCalendar({ tasks, onRefresh: _onRefresh }: TaskCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(
    new Date().toLocaleDateString('sv-SE')
  )

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Day of the week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
  // We align with Monday-first (0 = Monday, ..., 6 = Sunday)
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // Create an array for the grid cells
  const calendarCells: (Date | null)[] = []
  
  // Fill preceding empty cells (days of the previous month)
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null)
  }

  // Fill cells for current month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(new Date(year, month, day))
  }

  // Get tasks for a specific date (formatted as YYYY-MM-DD local time)
  const getTasksForDate = (date: Date) => {
    const dateStr = date.toLocaleDateString('sv-SE') // YYYY-MM-DD
    return tasks.filter((task) => {
      if (!task.due_date) return false
      const taskDateStr = new Date(task.due_date).toLocaleDateString('sv-SE')
      return taskDateStr === dateStr
    })
  }

  const selectedDateTasks = selectedDateStr
    ? tasks.filter((task) => {
        if (!task.due_date) return false
        const taskDateStr = new Date(task.due_date).toLocaleDateString('sv-SE')
        return taskDateStr === selectedDateStr
      })
    : []

  const formattedSelectedDate = selectedDateStr
    ? new Date(`${selectedDateStr}T12:00:00`).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  const todayStr = new Date().toLocaleDateString('sv-SE')

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 shadow-xl flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-task-purple" />
          Calendario de Tareas
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-foreground transition-colors cursor-pointer"
            title="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-slate-350 min-w-[90px] text-center capitalize">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-foreground transition-colors cursor-pointer"
            title="Siguiente mes"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center mb-4">
        {/* Day labels */}
        {dayLabels.map((label) => (
          <span key={label} className="text-[10px] font-bold text-slate-500 py-1 uppercase tracking-wider">
            {label}
          </span>
        ))}

        {/* Day cells */}
        {calendarCells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="aspect-square" />
          }

          const dateStr = date.toLocaleDateString('sv-SE')
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDateStr
          const dayTasks = getTasksForDate(date)
          const pendingTasks = dayTasks.filter(t => t.status === 'todo')
          const completedTasks = dayTasks.filter(t => t.status === 'done')

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDateStr(dateStr)}
              className={`aspect-square relative rounded-lg flex flex-col items-center justify-center border transition-all text-xs font-semibold cursor-pointer ${
                isSelected
                  ? 'bg-task-purple/25 border-task-purple text-white shadow-sm shadow-task-purple/20'
                  : isToday
                  ? 'bg-slate-900/60 border-slate-700 text-task-purple font-bold hover:bg-slate-900/80'
                  : 'bg-slate-950/20 border-white/[0.03] text-slate-300 hover:bg-white/[0.02] hover:border-white/[0.08]'
              }`}
            >
              <span>{date.getDate()}</span>
              {/* Task indicators */}
              {dayTasks.length > 0 && (
                <div className="absolute bottom-1.5 flex gap-0.5 justify-center w-full px-1">
                  {pendingTasks.map((t) => (
                    <span key={t.id} className="h-1 w-1 rounded-full bg-task-purple shadow-sm shadow-task-purple/50 shrink-0" />
                  ))}
                  {completedTasks.map((t) => (
                    <span key={t.id} className="h-1 w-1 rounded-full bg-emerald-450 shadow-sm shadow-emerald-450/50 shrink-0" />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Day Task List Container */}
      <div className="flex-1 border-t border-white/[0.04] pt-4 mt-auto">
        {selectedDateStr && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-bold text-slate-400 capitalize flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-task-purple" />
                {formattedSelectedDate}
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/[0.03] text-[9px] font-bold text-slate-400">
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'tarea' : 'tareas'}
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {selectedDateTasks.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No hay tareas programadas para este día.</p>
              ) : (
                selectedDateTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`py-2 px-3 rounded-lg border flex items-center justify-between gap-2.5 ${
                      task.status === 'done'
                        ? 'bg-slate-950/15 border-white/[0.01] opacity-55'
                        : task.status === 'ignored'
                        ? 'bg-slate-950/10 border-white/[0.01] opacity-35 italic'
                        : 'bg-slate-950/20 border-white/[0.04]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold leading-normal truncate ${
                          task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-350'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-[9px] text-slate-500 truncate mt-0.5">{task.description}</p>
                      )}
                    </div>
                    {task.due_date && (
                      <span className="shrink-0 text-[8px] text-slate-500 font-bold bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/[0.02]">
                        {new Date(task.due_date).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
