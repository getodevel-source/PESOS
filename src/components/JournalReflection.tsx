'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Save, Check, AlertTriangle, Loader2, Tag, Smile, History } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

export interface JournalEntry {
  id: string
  content: string
  entry_type: 'journal' | 'diet'
  entry_date: string
  metadata?: {
    mood?: string
    tags?: string[]
    calories?: number
    macros?: {
      protein?: number
      carbs?: number
      fat?: number
    }
    water?: number // in ml
    weight?: number // in kg
  }
}

interface JournalReflectionProps {
  entries: JournalEntry[]
  onRefresh: () => void
}

const MOOD_OPTIONS = [
  { emoji: '😢', label: 'Triste' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '🙂', label: 'Bien' },
  { emoji: '😄', label: 'Feliz' },
  { emoji: '🤩', label: 'Excelente' },
]

const DEFAULT_TAGS = ['Personal', 'Trabajo', 'Salud', 'Metas', 'Aprendizaje', 'Relaciones']

export default function JournalReflection({ entries, onRefresh }: JournalReflectionProps) {
  const [content, setContent] = useState('')
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Historical view state
  const [viewingPastEntry, setViewingPastEntry] = useState<JournalEntry | null>(null)

  const supabase = createClient()
  const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD

  // Filter entries to only get journal reflections
  const journalEntries = entries.filter((e) => e.entry_type === 'journal')
  const todayEntry = journalEntries.find((e) => e.entry_date === todayStr)
  const pastEntries = journalEntries.filter((e) => e.entry_date !== todayStr)

  // Sync state with today's entry on load/change
  useEffect(() => {
    if (todayEntry) {
      setContent(todayEntry.content || '')
      setSelectedMood(todayEntry.metadata?.mood || null)
      setSelectedTags(todayEntry.metadata?.tags || [])
    } else {
      setContent('')
      setSelectedMood(null)
      setSelectedTags([])
    }
    setSaveSuccess(false)
  }, [todayEntry])

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSave = async () => {
    if (!content.trim()) return

    setLoading(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const metadata = {
        mood: selectedMood,
        tags: selectedTags,
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
          entry_type: 'journal',
          entry_date: todayStr,
          metadata,
        })

        if (insertError) throw insertError
      }

      setSaveSuccess(true)
      onRefresh()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar la reflexión'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 shadow-xl h-full flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400 stroke-[2.5px]" />
            Bitácora de Reflexión
          </h2>
          <span className="text-[10px] opacity-40 font-mono">{todayStr}</span>
        </div>

        {error && (
          <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mood Selector */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Smile className="h-3 w-3" /> ¿Cómo te sentís hoy?
          </label>
          <div className="flex gap-2 justify-between">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedMood(opt.emoji)}
                className={`flex-1 py-1.5 rounded-lg border text-base transition-all duration-200 ${
                  selectedMood === opt.emoji
                    ? 'bg-indigo-500/20 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-900/40 border-white/[0.05] text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title={opt.label}
              >
                {opt.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Tags Selector */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Tag className="h-3 w-3" /> Categorías / Etiquetas
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                    isSelected
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                      : 'bg-slate-900/40 text-slate-400 border border-white/[0.04] hover:bg-slate-900/70 hover:text-slate-300'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribí tus pensamientos, aprendizajes o metas del día acá..."
            className="w-full h-32 p-3 bg-slate-950/40 border border-white/10 rounded-xl text-xs text-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 placeholder-slate-600 resize-none transition-all"
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
            disabled={loading || !content.trim()}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg border border-indigo-400/20 shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 transition-all"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar reflexión
          </button>
        </div>

        {/* Historial Section */}
        {pastEntries.length > 0 && (
          <div className="pt-3 border-t border-white/[0.04] space-y-2">
            <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <History className="h-3 w-3" /> Historial de reflexiones
            </h3>
            <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10">
              {pastEntries.slice(0, 5).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setViewingPastEntry(entry)}
                  className="w-full text-left p-2 rounded bg-slate-950/20 hover:bg-slate-950/40 border border-white/[0.03] flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="truncate flex-1">
                    <p className="text-[11px] text-slate-300 truncate group-hover:text-slate-100 transition-colors">
                      {entry.content}
                    </p>
                    <div className="flex gap-1.5 items-center mt-0.5">
                      {entry.metadata?.mood && <span className="text-[10px]">{entry.metadata.mood}</span>}
                      {entry.metadata?.tags?.map((t) => (
                        <span key={t} className="text-[8px] bg-white/[0.04] px-1 rounded text-slate-500 font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">
                    {new Date(entry.entry_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Past Entry Viewer Modal / Lightbox */}
      {viewingPastEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  Reflexión del {new Date(viewingPastEntry.entry_date).toLocaleDateString('es-ES', { dateStyle: 'long' })}
                </h3>
                <div className="flex gap-2 items-center mt-1.5">
                  {viewingPastEntry.metadata?.mood && (
                    <span className="text-xs bg-white/[0.04] px-2 py-0.5 rounded-full text-slate-300 flex items-center gap-1 font-medium">
                      Mood: {viewingPastEntry.metadata.mood}
                    </span>
                  )}
                  {viewingPastEntry.metadata?.tags?.map((t) => (
                    <span key={t} className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-300 font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setViewingPastEntry(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cerrar
              </button>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto">
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {viewingPastEntry.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
