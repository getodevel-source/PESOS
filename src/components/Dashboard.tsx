'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { LogOut, CheckCircle2, User, Cloud, Sun, CloudLightning, Calendar, CheckSquare, Smile, RefreshCw, X, LayoutDashboard, Award, BookOpen, DollarSign, Bot, Utensils, Download, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { type MockDatabase } from '@/lib/sqlite-db'
import AuthGate from './AuthGate'
import TaskList, { Task } from './TaskList'
import HabitList, { Habit, HabitLog } from './HabitList'
import JournalReflection, { JournalEntry } from './JournalReflection'
import DietLog from './DietLog'
import TransactionSummary, { Transaction, BudgetStatus } from './TransactionSummary'
import TaskCalendar from './TaskCalendar'
import ChatBot from './ChatBot'
import ErrorBoundary from './ErrorBoundary'

// Row shapes pulled from the SQLite-backed Supabase mock schema in
// `src/lib/sqlite-db.ts`. Using the mock's `MockDatabase` type keeps the
// dashboard's `.map((row) => ...)` callbacks in lockstep with the columns
// the mock actually returns, so adding a column to the schema surfaces here
// as a real type error instead of an `any` escape hatch.
type AchievementRow = MockDatabase['public']['Tables']['achievements']['Row']
type UserAchievementRow = MockDatabase['public']['Tables']['user_achievements']['Row']

// Weather system
type WeatherState = 'sunny' | 'cloudy' | 'stormy'

const WEATHER_GRADIENTS: Record<WeatherState, string> = {
  sunny:  'from-violet-900/20 via-slate-950 to-emerald-950/20',
  cloudy: 'from-slate-700/15 via-slate-950 to-orange-950/15',
  stormy: 'from-slate-800/20 via-slate-950 to-red-950/20',
}

const WEATHER_ICONS: Record<WeatherState, React.ReactNode> = {
  sunny:  <Sun className="h-3.5 w-3.5 text-emerald-400" />,
  cloudy: <Cloud className="h-3.5 w-3.5 text-amber-400" />,
  stormy: <CloudLightning className="h-3.5 w-3.5 text-rose-400" />,
}

const WEATHER_LABELS: Record<WeatherState, string> = {
  sunny:  'Soleado',
  cloudy: 'Nublado',
  stormy: 'Tormenta',
}

interface DashboardProps {
  initialUser: {
    id: string
    email?: string
  }
}

export default function Dashboard({ initialUser }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'tasks' | 'habits' | 'journal' | 'diet' | 'finances' | 'ai'>('overview')

  // RPG states
  const [stats, setStats] = useState<{ level: number; xp: number; streak: number } | null>(null)
  const [achievements, setAchievements] = useState<{ id: string; title: string; description: string; icon: string; xp_reward: number; unlocked: boolean }[]>([])

  // Weather / budget state
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>('ok')
  const [budgetPct, setBudgetPct] = useState(0)
  const [budgetLimit, setBudgetLimit] = useState(0)

  // Close day modal state
  const [isCloseDayOpen, setIsCloseDayOpen] = useState(false)

  // Update states (electron-updater flow)
  // status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateCurrentVersion, setUpdateCurrentVersion] = useState('')
  const [updateAvailableVersion, setUpdateAvailableVersion] = useState<string | null>(null)
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const todayStr = new Date().toLocaleDateString('sv-SE')

  // Poll the updater state. Always-on while the dashboard is mounted so the
  // user sees progress from a download started earlier, or the auto-check
  // that runs 5s after the app starts.
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('/api/update')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (typeof data.status === 'string') setUpdateStatus(data.status)
        if (typeof data.currentVersion === 'string') setUpdateCurrentVersion(data.currentVersion)
        if (data.availableVersion === null || typeof data.availableVersion === 'string') {
          setUpdateAvailableVersion(data.availableVersion ?? null)
        }
        if (typeof data.progress === 'number') setUpdateProgress(data.progress)
        if (data.error === null || typeof data.error === 'string') {
          setUpdateError(data.error ?? null)
        }
      } catch (err) {
        console.error('Failed to poll updater state:', err)
      }
    }
    poll()
    const interval = setInterval(poll, 1500)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const sendUpdateAction = async (action: 'check' | 'download' | 'install') => {
    setUpdateBusy(true)
    setUpdateError(null)
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Falló la acción '${action}'.`)
      }
      // Optimistic status bump; the poller will reconcile.
      if (action === 'check') setUpdateStatus('checking')
      if (action === 'download') setUpdateStatus('downloading')
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : 'Error al solicitar la actualización.')
    } finally {
      setUpdateBusy(false)
    }
  }

  const checkAppUpdate = () => sendUpdateAction('check')
  const handleStartDownload = () => sendUpdateAction('download')
  const handleInstall = () => sendUpdateAction('install')

  // Notification states and refs
  const notifiedTasksRef = useRef<Set<string>>(new Set())
  const isFirstRun = useRef(true)

  // Load notified tasks on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pesos_notified_tasks')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            notifiedTasksRef.current = new Set(parsed)
          }
        }
      } catch (e) {
        console.error('Error loading notified tasks:', e)
      }
    }
  }, [])

  // Request notifications permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [])

  // Seed notified tasks on startup to avoid spamming old tasks
  useEffect(() => {
    if (tasks.length > 0 && isFirstRun.current) {
      isFirstRun.current = false
      const now = new Date()
      let updated = false
      tasks.forEach((task) => {
        if (task.status !== 'todo' || !task.due_date) return
        const dueTimeMs = new Date(task.due_date).getTime()
        // Seed if due time is in the past (older than 2 minutes)
        if (dueTimeMs <= now.getTime() - 2 * 60 * 1000) {
          if (!notifiedTasksRef.current.has(task.id)) {
            notifiedTasksRef.current.add(task.id)
            updated = true
          }
        }
      })
      if (updated) {
        try {
          localStorage.setItem(
            'pesos_notified_tasks',
            JSON.stringify(Array.from(notifiedTasksRef.current))
          )
        } catch (e) {
          console.error('Error saving notified tasks:', e)
        }
      }
    }
  }, [tasks])

  // Notification loop
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const checkTasks = () => {
      if (Notification.permission !== 'granted') return

      const now = new Date()
      const nowMs = now.getTime()
      let updated = false

      tasks.forEach((task) => {
        if (task.status !== 'todo' || !task.due_date) return
        if (notifiedTasksRef.current.has(task.id)) return

        const dueTimeMs = new Date(task.due_date).getTime()

        // Check if due time has passed AND task is not older than 24 hours
        if (dueTimeMs <= nowMs && dueTimeMs >= nowMs - 24 * 60 * 60 * 1000) {
          try {
            new Notification('Recordatorio de Pesos', {
              body: task.title + (task.description ? `\n${task.description}` : ''),
              icon: '/logo.png',
              tag: task.id,
            })
            notifiedTasksRef.current.add(task.id)
            updated = true
          } catch (err) {
            console.error('Error triggering notification:', err)
          }
        }
      })

      if (updated) {
        try {
          localStorage.setItem(
            'pesos_notified_tasks',
            JSON.stringify(Array.from(notifiedTasksRef.current))
          )
        } catch (e) {
          console.error('Error saving notified tasks:', e)
        }
      }
    }

    // Check immediately when tasks are updated or loaded
    checkTasks()

    // Periodically check every 30 seconds
    const interval = setInterval(checkTasks, 30000)
    return () => clearInterval(interval)
  }, [tasks])

  const handleRefresh = () => setRefreshKey((prev) => prev + 1)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Fetch tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })

        // Fetch habits
        const { data: habitsData } = await supabase
          .from('habits')
          .select('*')
          .order('created_at', { ascending: false })

        // Fetch habit logs for today
        const { data: logsData } = await supabase
          .from('habit_logs')
          .select('*')
          .eq('log_date', todayStr)

        // Fetch journal entries
        const { data: journalData } = await supabase
          .from('journal_entries')
          .select('*')
          .order('created_at', { ascending: false })

        // Fetch transactions
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })

        // Run achievement check and unlock logic
        await supabase.rpc('check_and_unlock_achievements', { target_user_id: initialUser.id })

        // Fetch RPG stats
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', initialUser.id)
          .maybeSingle()

        // Fetch achievements & unlocked ones
        const { data: allAchievements } = await supabase
          .from('achievements')
          .select('*')
          .order('created_at', { ascending: true })

        const { data: unlockedAchievements } = await supabase
          .from('user_achievements')
          .select('achievement_id')
          .eq('user_id', initialUser.id)

        const unlockedIds = new Set((unlockedAchievements || []).map((ua: UserAchievementRow) => ua.achievement_id))
        const achievementsWithUnlock = (allAchievements || []).map((ach: AchievementRow) => ({
          ...ach,
          unlocked: unlockedIds.has(ach.id)
        }))

        setTasks(tasksData || [])
        setHabits(habitsData || [])
        setHabitLogs(logsData || [])
        setJournalEntries(journalData || [])
        setTransactions(transactionsData || [])
        setStats(statsData || { level: 1, xp: 0, streak: 0 })
        setAchievements(achievementsWithUnlock)
      } catch (err) {
        console.error('Error cargando los datos del dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [refreshKey, supabase, todayStr, initialUser.id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  // Filter tasks to show today's tasks
  const todayTasks = tasks.filter((t) => {
    if (!t.due_date) return true
    const taskDate = new Date(t.due_date).toLocaleDateString('sv-SE')
    return taskDate <= todayStr
  })

  // Close Day Stats
  const completedTasksCount = todayTasks.filter((t) => t.status === 'done').length
  const totalTasksCount = todayTasks.length
  const completedHabitsCount = habits.filter((h) =>
    habitLogs.some((l) => l.habit_id === h.id && l.log_date === todayStr)
  ).length
  const totalHabitsCount = habits.length
  const hasJournalToday = journalEntries.some(
    (e) => e.entry_type === 'journal' && e.entry_date === todayStr
  )

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Compute weather state from budget + overdue tasks
  const overdueCriticalTasks = tasks.filter((t) => {
    if (t.status !== 'todo' || !t.due_date) return false
    return new Date(t.due_date) < new Date()
  }).length

  const weather: WeatherState =
    budgetStatus === 'critical' || overdueCriticalTasks >= 3
      ? 'stormy'
      : budgetStatus === 'warning' || overdueCriticalTasks >= 1
      ? 'cloudy'
      : 'sunny'

  const handleBudgetStatusChange = useCallback((status: BudgetStatus, pct: number, limit: number) => {
    setBudgetStatus(status)
    setBudgetPct(pct)
    setBudgetLimit(limit)
  }, [])

  return (
    <AuthGate>
    <div className={`min-h-screen flex text-slate-100 transition-all duration-1000 bg-gradient-to-br ${WEATHER_GRADIENTS[weather]}`} style={{ backgroundColor: '#020617' }}>
      {/* Sticky Vertical Left Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-white/5 bg-slate-950/40 backdrop-blur-xl h-screen sticky top-0 shrink-0 select-none">
        {/* Sidebar Header / Logo */}
        <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Pesos Logo" className="h-7 w-7 object-contain rounded-md" />
            <div>
              <h1 className="text-xs font-bold tracking-tight text-foreground">
                Pesos
              </h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold">
                Habits & Finances
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-1 text-slate-500 hover:text-brand-indigo rounded transition-all"
            title="Refrescar datos"
            aria-label="Refrescar datos"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Routing Tabs */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => setSidebarTab('overview')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'overview'
                ? 'bg-task-purple/10 text-task-purple border-task-purple/20 shadow-sm shadow-task-purple/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Vista General
          </button>
          <button
            onClick={() => setSidebarTab('tasks')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'tasks'
                ? 'bg-task-purple/10 text-task-purple border-task-purple/20 shadow-sm shadow-task-purple/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Tareas de Hoy
          </button>
          <button
            onClick={() => setSidebarTab('habits')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'habits'
                ? 'bg-habit-green/10 text-habit-green border-habit-green/20 shadow-sm shadow-habit-green/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Hábitos Diarios
          </button>
          <button
            onClick={() => setSidebarTab('journal')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'journal'
                ? 'bg-task-purple/10 text-task-purple border-task-purple/20 shadow-sm shadow-task-purple/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Bitácora Diario
          </button>
          <button
            onClick={() => setSidebarTab('diet')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'diet'
                ? 'bg-habit-green/10 text-habit-green border-habit-green/20 shadow-sm shadow-habit-green/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Utensils className="h-3.5 w-3.5" />
            Registro Dieta
          </button>
          <button
            onClick={() => setSidebarTab('finances')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'finances'
                ? 'bg-finance-blue/10 text-finance-blue border-finance-blue/20 shadow-sm shadow-finance-blue/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Finanzas de Hoy
          </button>

          {/* Separator */}
          <div className="mx-2 my-2 border-t border-white/[0.03]" />

          <button
            onClick={() => setSidebarTab('ai')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              sidebarTab === 'ai'
                ? 'bg-violet-500/10 text-violet-300 border-violet-500/20 shadow-sm shadow-violet-500/5'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            IA Chat
          </button>
        </nav>

        {/* Sidebar Footer & User Info & Logout */}
        <div className="p-3 border-t border-border-primary space-y-2 bg-background/30">
          {/* RPG Level Card */}
          {stats && (
            <div className="p-3 rounded-lg border border-white/[0.05] bg-slate-950/50 space-y-2 select-none">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  ⚔️ Niv. {stats.level}
                </span>
                <span className="text-[9px] font-bold text-violet-400 font-mono">{stats.xp} XP</span>
              </div>
              {/* Progress bar to next level */}
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden border border-white/[0.02]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-700 ease-out"
                    style={{ width: `${stats.xp % 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Progreso</span>
                  <span>{100 - (stats.xp % 100)} XP para Niv. {stats.level + 1}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-panel border border-border-primary overflow-hidden">
            <User className="h-3.5 w-3.5 text-brand-indigo shrink-0" />
            <span className="text-[10px] text-slate-300 font-medium truncate" title={initialUser.email}>
              {initialUser.email}
            </span>
          </div>
          <button
            onClick={checkAppUpdate}
            disabled={updateBusy || updateStatus === 'checking'}
            className="w-full flex items-center gap-2 px-2 py-1.5 bg-panel border border-border-primary hover:border-indigo-500/20 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 text-[10px] font-semibold rounded transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
            {updateStatus === 'checking' ? 'Buscando...' : 'Buscar actualizaciones'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 bg-panel border border-border-primary hover:border-red-500/20 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-[10px] font-semibold rounded transition-all"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Cerrar Sesión
          </button>
          {/* Update Section (electron-updater state) */}
          {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded') && (
            <div className="p-2.5 rounded border border-indigo-500/20 bg-indigo-500/5 space-y-2 flex flex-col">
              <div className="flex items-center gap-1.5 text-indigo-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Nueva actualización</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-snug">
                {updateCurrentVersion && <>Versión actual: {updateCurrentVersion}.<br /></>}
                Versión {updateAvailableVersion} disponible.
              </p>

              {updateStatus === 'available' && (
                <button
                  type="button"
                  onClick={handleStartDownload}
                  disabled={updateBusy}
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold rounded transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
                >
                  <Download className="h-3 w-3 shrink-0" />
                  Descargar
                </button>
              )}

              {updateStatus === 'downloading' && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-500 font-medium">
                    <span>Descargando...</span>
                    <span>{updateProgress}%</span>
                  </div>
                </div>
              )}

              {updateStatus === 'downloaded' && (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={updateBusy}
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold rounded transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50"
                >
                  <Download className="h-3 w-3 shrink-0" />
                  Instalar y reiniciar
                </button>
              )}

              {updateError && (
                <span className="text-[8px] text-rose-400 block text-center mt-1">
                  {updateError}
                </span>
              )}
            </div>
          )}

          {updateStatus === 'error' && (
            <div className="p-2.5 rounded border border-rose-500/20 bg-rose-500/5 space-y-1.5 flex flex-col">
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Error de actualización</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-snug">
                {updateError || 'No se pudo verificar la actualización.'}
              </p>
              <button
                type="button"
                onClick={checkAppUpdate}
                disabled={updateBusy}
                className="w-full flex items-center justify-center gap-1 py-1.5 bg-panel border border-border-primary hover:border-rose-500/20 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 text-[9px] font-bold rounded transition-all disabled:opacity-50"
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="text-[9px] text-center text-slate-500 hover:text-slate-400 transition-colors pt-1">
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
      </aside>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border-primary bg-panel/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Pesos Logo" className="h-5 w-5 object-contain rounded-md" />
            <span className="text-xs font-bold text-foreground">Pesos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              className="p-1.5 text-slate-400 hover:text-brand-indigo rounded transition-all"
              title="Refrescar datos"
              aria-label="Refrescar datos"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-all"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Tabs */}
        <div className="md:hidden flex p-1 bg-panel/30 border-b border-border-primary overflow-x-auto gap-1 select-none shrink-0 scrollbar-none">
          <button
            onClick={() => setSidebarTab('overview')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'overview' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Vista General
          </button>
          <button
            onClick={() => setSidebarTab('tasks')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'tasks' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Tareas
          </button>
          <button
            onClick={() => setSidebarTab('habits')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'habits' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Hábitos
          </button>
          <button
            onClick={() => setSidebarTab('journal')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'journal' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Bitácora
          </button>
          <button
            onClick={() => setSidebarTab('diet')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'diet' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Dieta
          </button>
          <button
            onClick={() => setSidebarTab('finances')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all ${
              sidebarTab === 'finances' ? 'bg-white/5 text-foreground border border-white/5' : 'text-slate-400'
            }`}
          >
            Finanzas
          </button>
          <button
            onClick={() => setSidebarTab('ai')}
            className={`px-3 py-1 rounded text-[11px] font-semibold shrink-0 transition-all flex items-center gap-1 ${
              sidebarTab === 'ai' ? 'bg-white/5 text-violet-300 border border-white/5' : 'text-slate-400'
            }`}
          >
            <Bot className="h-3 w-3" />
            IA
          </button>
        </div>

        {/* Main Dashboard Container */}
        <main className="flex-1 p-4 md:p-6 space-y-6 max-w-6xl w-full mx-auto">
          {/* Header Row: Date, Weather & Close Day Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-panel border border-border-primary p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-brand-indigo" />
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hoy</p>
                <h2 className="text-xs font-semibold text-slate-200">
                  {new Date().toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Weather Badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all duration-700 ${
                weather === 'stormy'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : weather === 'cloudy'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {WEATHER_ICONS[weather]}
                <span>{WEATHER_LABELS[weather]}</span>
                {budgetLimit > 0 && (
                  <span className="opacity-60 font-mono normal-case">·&nbsp;{budgetPct.toFixed(0)}%</span>
                )}
              </div>

              <button
                onClick={() => setIsCloseDayOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white text-xs font-semibold rounded-md border border-white/10 shadow-lg shadow-brand-indigo/10 flex items-center justify-center gap-1.5 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                Cerrar Día
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-brand-indigo" />
              <p className="text-xs">Sincronizando Pesos...</p>
            </div>
          ) : (
            <>
              {/* Vista General (All elements in a grid) */}
              {sidebarTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Today's Tasks */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Tareas">
                      <TaskList tasks={todayTasks} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>

                  {/* Daily Habits */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Hábitos">
                      <HabitList habits={habits} logs={habitLogs} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>

                  {/* Reflections */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Reflexiones">
                      <JournalReflection entries={journalEntries} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>

                  {/* Diet Log */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Dieta">
                      <DietLog entries={journalEntries} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>

                  {/* Quick Transactions */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Finanzas">
                      <TransactionSummary transactions={transactions} onRefresh={handleRefresh} onBudgetStatusChange={handleBudgetStatusChange} />
                    </ErrorBoundary>
                  </div>

                  {/* Next Reminders / Calendar */}
                  <div className="lg:col-span-1">
                    <ErrorBoundary fallbackTitle="Error en Calendario">
                      <TaskCalendar tasks={tasks} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>

                  {/* RPG Achievements and Logros */}
                  <div className="lg:col-span-1 glass-panel glass-panel-hover rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                      <h2 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                        <Award className="h-4 w-4 text-violet-400" />
                        Logros & Hazañas
                      </h2>
                      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {loading ? (
                          <p className="text-xs text-slate-500 text-center py-6">Cargando logros...</p>
                        ) : achievements.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-6">No hay logros disponibles aún.</p>
                        ) : (
                          achievements.map((ach) => (
                            <div
                              key={ach.id}
                              className={`flex gap-3 items-start p-2.5 rounded-lg border transition-all ${
                                ach.unlocked
                                  ? 'bg-violet-950/20 border-violet-500/10 text-slate-200'
                                  : 'bg-slate-950/20 border-white/5 opacity-40 text-slate-400 select-none'
                              }`}
                            >
                              <span className="text-xl shrink-0" role="img" aria-label={ach.title}>{ach.icon}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-baseline">
                                  <h3 className="text-xs font-bold truncate">{ach.title}</h3>
                                  {ach.unlocked && (
                                    <span className="text-[8px] font-bold text-violet-400 font-mono shrink-0">+{ach.xp_reward} XP</span>
                                  )}
                                </div>
                                <p className="text-[10px] leading-normal text-slate-400">{ach.description}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.03] text-[9px] text-slate-500 leading-normal">
                      Completá hábitos, escribí reflexiones y registrá tu dieta para ganar XP. Cerrá un mes bajo presupuesto para desbloquear logros.
                    </div>
                  </div>
                </div>
              )}

              {/* Tareas View */}
              {sidebarTab === 'tasks' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ErrorBoundary fallbackTitle="Error en Tareas">
                      <TaskList tasks={todayTasks} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>
                  <div className="lg:col-span-1 flex flex-col">
                    <ErrorBoundary fallbackTitle="Error en Calendario">
                      <TaskCalendar tasks={tasks} onRefresh={handleRefresh} />
                    </ErrorBoundary>
                  </div>
                </div>
              )}

              {/* Hábitos View */}
              {sidebarTab === 'habits' && (
                <div className="max-w-3xl mx-auto">
                  <ErrorBoundary fallbackTitle="Error en Hábitos">
                    <HabitList habits={habits} logs={habitLogs} onRefresh={handleRefresh} />
                  </ErrorBoundary>
                </div>
              )}

              {/* Journal/Reflexiones View */}
              {sidebarTab === 'journal' && (
                <div className="max-w-3xl mx-auto">
                  <ErrorBoundary fallbackTitle="Error en Reflexiones">
                    <JournalReflection entries={journalEntries} onRefresh={handleRefresh} />
                  </ErrorBoundary>
                </div>
              )}

              {/* Diet Log View */}
              {sidebarTab === 'diet' && (
                <div className="max-w-3xl mx-auto">
                  <ErrorBoundary fallbackTitle="Error en Dieta">
                    <DietLog entries={journalEntries} onRefresh={handleRefresh} />
                  </ErrorBoundary>
                </div>
              )}

              {/* Finances View */}
              {sidebarTab === 'finances' && (
                <div className="max-w-3xl mx-auto">
                  <ErrorBoundary fallbackTitle="Error en Finanzas">
                    <TransactionSummary transactions={transactions} onRefresh={handleRefresh} onBudgetStatusChange={handleBudgetStatusChange} />
                  </ErrorBoundary>
                </div>
              )}

              {/* IA Chat View */}
              {sidebarTab === 'ai' && (
                <div className="max-w-4xl mx-auto">
                  <ErrorBoundary fallbackTitle="Error en IA Chat">
                    <ChatBot />
                  </ErrorBoundary>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Cerrar Dia Modal */}
      {isCloseDayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-panel border border-border-primary rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-5">
            <button
              onClick={() => setIsCloseDayOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-250 hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="mx-auto h-10 w-10 rounded-full bg-brand-indigo/10 flex items-center justify-center text-brand-indigo">
                <Smile className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Cierre de Día</h3>
              <p className="text-xs text-slate-400">Excelente trabajo reflexionando sobre tu día.</p>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border border-border-primary space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-450">Tareas completadas</span>
                <span className="font-semibold text-slate-200">
                  {completedTasksCount} / {totalTasksCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-455">Hábitos realizados</span>
                <span className="font-semibold text-slate-200">
                  {completedHabitsCount} / {totalHabitsCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-455">Gastos registrados</span>
                <span className="font-semibold text-rose-400">${totalExpense.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-455">¿Bitácora escrita?</span>
                <span className={`font-semibold ${hasJournalToday ? 'text-emerald-450' : 'text-slate-500'}`}>
                  {hasJournalToday ? 'Sí' : 'No'}
                </span>
              </div>
            </div>

            <div className="text-center italic text-xs text-brand-indigo leading-snug">
              {"\"El éxito es la suma de pequeños esfuerzos repetidos día tras día.\""}
            </div>

            <button
              onClick={() => setIsCloseDayOpen(false)}
              className="w-full py-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white text-xs font-semibold rounded-md border border-white/10 shadow-md transition-colors"
            >
              Completado por hoy
            </button>
          </div>
        </div>
      )}
    </div>
    </AuthGate>
  )
}
