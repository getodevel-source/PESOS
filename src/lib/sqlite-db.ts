import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ─── Shared types for the SQLite-backed Supabase mock ────────────────────────
//
// The mock clients in `supabase.ts` and `supabase-client.ts` build a JSON
// payload that mirrors a Supabase query chain (select/insert/update/delete +
// filters + order) and ship it to this module. These types describe the
// shape of that payload and the result it produces, so every layer can stay
// typed without falling back to `any`.

export type QueryAction = 'select' | 'insert' | 'update' | 'delete'

export interface MockFilterClause {
  type: 'eq'
  column: string
  value: unknown
}

export interface MockOrderClause {
  column: string
  ascending: boolean
}

export interface MockQuery {
  table?: string
  action: QueryAction
  args: Record<string, unknown> | null
  filters: MockFilterClause[]
  order: MockOrderClause | null
  single: boolean
  maybeSingle: boolean
  rpcName?: string
  rpcArgs?: Record<string, unknown> | null
}

// Internal result shape used by the mock query chain's `then` method. The
// public-facing `MockQueryResult<T>` (further down) wraps this with a
// generic data type and an object-shaped error.
interface MockChainResult {
  data: unknown
  error: string | null
}

// ─── Mock Supabase Database schema ──────────────────────────────────────────
//
// The mock clients in `supabase.ts` / `supabase-client.ts` are typed as
// `SupabaseClient<MockDatabase>`. MockDatabase mirrors the SQLite schema in
// this file (see CREATE TABLE statements above) and the row shapes the
// consumer components in `src/components/*` expect. Without it, Postgrest's
// GetResult narrows `.data` to `unknown` and the existing call sites in
// `Dashboard.tsx`, `route.ts`, and `db-rls.test.ts` would all break.

type TaskStatus = 'todo' | 'done' | 'ignored'
type TransactionType = 'income' | 'expense'
type JournalEntryType = 'journal' | 'diet'

interface JournalMetadata {
  mood?: string
  tags?: string[]
  calories?: number
  macros?: { protein?: number; carbs?: number; fat?: number }
  water?: number
  weight?: number
  [key: string]: unknown
}

// Wider metadata shape accepted on insert/update. The consumer components
// (`JournalReflection.tsx`, `DietLog.tsx`) build the payload with fields
// that may be `null` (e.g. `mood: string | null`, `weight: number | null`)
// even though the read-side `JournalEntry.metadata` types those fields as
// `string | undefined` / `number | undefined`. Accepting `null` here is a
// deliberate type-vs-runtime trade-off: the `|| null` / `|| 0` patterns at
// the read sites already tolerate `null` falling through, so the only thing
// the wider Insert type buys us is making the existing call sites type-check
// without modifying the consumer files.
type JournalMetadataInput = {
  mood?: string | null
  tags?: string[] | null
  calories?: number | null
  macros?: { protein?: number | null; carbs?: number | null; fat?: number | null } | null
  water?: number | null
  weight?: number | null
  [key: string]: unknown
}

interface TasksTable {
  Row: {
    id: string
    user_id: string | null
    title: string
    description: string | null
    status: TaskStatus
    due_date: string | null
    completed_at: string | null
    created_at: string
  }
  // Insert accepts `string` (not the strict union) because the consumer
  // sources these values from AI responses / external payloads and the
  // SQLite mock does not enforce the CHECK constraint on `status`.
  Insert: {
    id?: string
    user_id?: string | null
    title: string
    description?: string | null
    status?: string
    due_date?: string | null
    completed_at?: string | null
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    title: string
    description: string | null
    status: TaskStatus
    due_date: string | null
    completed_at: string | null
    created_at: string
  }>
  Relationships: []
}

interface HabitsTable {
  // `frequency` and `description` are typed non-nullable to match the
  // consumer's `Habit` shape in HabitList.tsx; the mock always populates
  // them on insert.
  Row: {
    id: string
    user_id: string | null
    title: string
    description: string | null
    frequency: string
    created_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    title: string
    description?: string | null
    frequency?: string
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    title: string
    description: string | null
    frequency: string
    created_at: string
  }>
  Relationships: []
}

interface HabitLogsTable {
  // `habit_id` is typed non-nullable to match HabitLog in HabitList.tsx;
  // habit_logs rows only make sense with an attached habit.
  Row: {
    id: string
    user_id: string | null
    habit_id: string
    log_date: string
    created_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    habit_id?: string
    log_date?: string
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    habit_id: string
    log_date: string
    created_at: string
  }>
  Relationships: []
}

interface TransactionsTable {
  Row: {
    id: string
    user_id: string | null
    description: string
    amount: number
    type: TransactionType
    transaction_date: string
    created_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    description: string
    amount: number
    // `type` accepts `string` for the same reason as `status` above.
    type?: string
    transaction_date?: string
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    description: string
    amount: number
    type: TransactionType
    transaction_date: string
    created_at: string
  }>
  Relationships: []
}

interface JournalEntriesTable {
  // `metadata` uses the consumer's shape (all optional, no `null`) so that
  // `JournalEntry[]` is assignable to the data returned by the mock. Insert
  // and Update use the wider `JournalMetadataInput` to accept the `null`
  // values the consumer components pass.
  Row: {
    id: string
    user_id: string | null
    content: string
    entry_type: JournalEntryType
    entry_date: string
    metadata?: JournalMetadata
    created_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    content: string
    // `entry_type` accepts `string` like `status` / `type` above.
    entry_type?: string
    entry_date?: string
    metadata?: JournalMetadataInput
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    content: string
    entry_type: JournalEntryType
    entry_date: string
    metadata: JournalMetadataInput
    created_at: string
  }>
  Relationships: []
}

interface ProfilesTable {
  Row: {
    id: string
    updated_at: string
    full_name: string | null
    telegram_chat_id: number | null
    telegram_username: string | null
    timezone: string | null
    monthly_budget: number | null
    pending_transaction?: unknown
  }
  Insert: {
    id: string
    updated_at?: string
    full_name?: string | null
    telegram_chat_id?: number | null
    telegram_username?: string | null
    timezone?: string | null
    monthly_budget?: number | null
    pending_transaction?: unknown
  }
  Update: Partial<{
    id: string
    updated_at: string
    full_name: string | null
    telegram_chat_id: number | null
    telegram_username: string | null
    timezone: string | null
    monthly_budget: number | null
    pending_transaction: unknown
  }>
  Relationships: []
}

interface UserStatsTable {
  Row: {
    user_id: string
    level: number
    xp: number
    streak: number
    last_active_date: string | null
    updated_at: string
  }
  Insert: {
    user_id: string
    level?: number
    xp?: number
    streak?: number
    last_active_date?: string | null
    updated_at?: string
  }
  Update: Partial<{
    user_id: string
    level: number
    xp: number
    streak: number
    last_active_date: string | null
    updated_at: string
  }>
  Relationships: []
}

interface AchievementsTable {
  Row: {
    id: string
    title: string
    description: string
    icon: string
    xp_reward: number
    created_at: string
  }
  Insert: {
    id?: string
    title: string
    description: string
    icon: string
    xp_reward?: number
    created_at?: string
  }
  Update: Partial<{
    id: string
    title: string
    description: string
    icon: string
    xp_reward: number
    created_at: string
  }>
  Relationships: []
}

interface UserAchievementsTable {
  Row: {
    id: string
    user_id: string | null
    achievement_id: string | null
    unlocked_at: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    achievement_id?: string | null
    unlocked_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    achievement_id: string | null
    unlocked_at: string
  }>
  Relationships: []
}

// The Telegram webhook logs incoming payloads into a sidecar `inputs` table
// that the SQLite mock does not create (it just stores whatever is inserted
// into a dynamically-named table). It is included here purely so the
// Postgrest call `from('inputs').insert(...)` type-checks.
interface InputsTable {
  Row: {
    id: string
    user_id: string | null
    payload: unknown
    processed: boolean
    created_at?: string
  }
  Insert: {
    id?: string
    user_id?: string | null
    payload: unknown
    processed?: boolean
    created_at?: string
  }
  Update: Partial<{
    id: string
    user_id: string | null
    payload: unknown
    processed: boolean
    created_at: string
  }>
  Relationships: []
}

export type MockDatabase = {
  public: {
    Tables: {
      tasks: TasksTable
      habits: HabitsTable
      habit_logs: HabitLogsTable
      transactions: TransactionsTable
      journal_entries: JournalEntriesTable
      profiles: ProfilesTable
      user_stats: UserStatsTable
      achievements: AchievementsTable
      user_achievements: UserAchievementsTable
      inputs: InputsTable
    }
    Views: Record<string, never>
    Functions: {
      check_and_unlock_achievements: {
        Args: { target_user_id?: string }
        Returns: { achievement_title: string; xp_awarded: number; newly_unlocked: boolean }[]
      }
    }
  }
}

// ─── Public client surface ──────────────────────────────────────────────────
//
// The mock clients in `supabase.ts` / `supabase-client.ts` are typed with the
// `MockSupabaseClient<MockDatabase>` alias below. This is intentionally a
// hand-rolled surface (not `@supabase/supabase-js`'s `SupabaseClient`) for
// two reasons:
//
//  1. The real `SupabaseClient`'s PostgrestBuilder returns `data: null` from
//     a bare `.insert(...)` (the rows only come back after a trailing
//     `.select()`). Both the existing consumer components AND the existing
//     `db-rls.test.ts` tests assume the inserted rows are returned directly,
//     so we model the mock's return as `data: Row[]`.
//
//  2. The real `SupabaseClient` types `.error` as a `PostgrestError` (an
//     object with `.message` / `.code`). The mock's underlying `runSQLiteQuery`
//     returns a plain string error, but the existing call sites in
//     `route.ts` and `db-rls.test.ts` already access `.message` and `.code`
//     on it. We model the error as an object so those accesses keep
//     type-checking without forcing consumers to narrow or cast.
//
// Both choices are deliberate type-only trade-offs that match what the
// existing call sites already assume; the mock's runtime behavior is
// unchanged.

export interface MockPostgrestError {
  message: string
  code: string
}

export interface MockQueryResult<T> {
  data: T
  error: MockPostgrestError | null
}

// A query chain that ends in either a single-row result (`.single()` /
// `.maybeSingle()`) or a list result (everything else). The result type is
// tracked through a generic so `setTasks(tasksData || [])` keeps its `Task[]`
// target while `profile.id` from `.maybeSingle()` keeps its `Row | null` shape.
//
// `.insert()` / `.update()` / `.delete()` return the chain (not a Promise)
// so call sites can keep composing methods like `.throwOnError()` and
// `.select()` on the result, matching the real PostgrestBuilder surface.
export interface MockQueryChain<Row, Result = Row[] | null> {
  select(columns?: string): MockQueryChain<Row, Result>
  // `insert` / `update` accept `Record<string, unknown>` (not `Partial<Row>`)
  // so callers can pass loosely-typed payloads (e.g. AI-generated values
  // that may not match the strict Row union) without a cast. The mock
  // forwards whatever it receives to the SQLite runner, which only checks
  // column names, not value types.
  insert(values: Record<string, unknown>): MockQueryChain<Row, Row[]>
  update(values: Record<string, unknown>): MockQueryChain<Row, Row[]>
  delete(): MockQueryChain<Row, Row[]>
  eq(column: string, value: unknown): MockQueryChain<Row, Result>
  order(column: string, options?: { ascending: boolean }): MockQueryChain<Row, Result>
  limit(rows: number): MockQueryChain<Row, Result>
  gte(column: string, value: unknown): MockQueryChain<Row, Result>
  gt(column: string, value: unknown): MockQueryChain<Row, Result>
  single(): MockQueryChain<Row, Row | null>
  maybeSingle(): MockQueryChain<Row, Row | null>
  throwOnError(): MockQueryChain<Row, Result>
  then<TResult1 = MockQueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2>
}

export interface MockSupabaseClient<DB extends { public: { Tables: Record<string, { Row: Record<string, unknown> }> } }> {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email: string } | null }; error: MockPostgrestError | null }>
    signOut: () => Promise<{ error: MockPostgrestError | null }>
    signUp: (credentials: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => Promise<{ data: { user: { id: string; email: string } | null; session: null }; error: MockPostgrestError | null }>
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: { user: { id: string; email: string } | null; session: null }; error: MockPostgrestError | null }>
  }
  from<TableName extends keyof DB['public']['Tables'] & string>(
    table: TableName
  ): MockQueryChain<DB['public']['Tables'][TableName]['Row']>
  rpc(name: string, args?: Record<string, unknown>): Promise<MockQueryResult<unknown>>
}

// Default mock user for offline usage
export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000'
export const MOCK_USER_EMAIL = 'user@pesos.local'

// Path to SQLite database file
const dbDir = path.join(os.homedir(), '.config', 'pesos')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}
const dbPath = path.join(dbDir, 'pesos.db')

export const db = new Database(dbPath)

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    full_name TEXT,
    telegram_chat_id INTEGER UNIQUE,
    telegram_username TEXT,
    timezone TEXT DEFAULT 'UTC',
    monthly_budget REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('todo', 'done', 'ignored')) DEFAULT 'todo',
    due_date DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'daily',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    habit_id TEXT,
    log_date DATE DEFAULT (DATE('now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, log_date),
    FOREIGN KEY(user_id) REFERENCES profiles(id),
    FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount >= 0),
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    transaction_date DATE DEFAULT (DATE('now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    content TEXT NOT NULL,
    entry_type TEXT CHECK (entry_type IN ('journal', 'diet')) DEFAULT 'journal',
    entry_date DATE DEFAULT (DATE('now')),
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY,
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    xp INTEGER DEFAULT 0 CHECK (xp >= 0),
    streak INTEGER DEFAULT 0 CHECK (streak >= 0),
    last_active_date DATE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 0 CHECK (xp_reward >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    achievement_id TEXT,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id),
    FOREIGN KEY(user_id) REFERENCES profiles(id),
    FOREIGN KEY(achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
  );
`)

// Seed user profile and stats if not present
const profileExists = db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(MOCK_USER_ID)
if (!profileExists) {
  db.prepare(`
    INSERT INTO profiles (id, full_name, timezone)
    VALUES (?, 'Usuario Local', 'UTC')
  `).run(MOCK_USER_ID)

  db.prepare(`
    INSERT INTO user_stats (user_id, level, xp, streak)
    VALUES (?, 1, 0, 0)
  `).run(MOCK_USER_ID)
}

// Seed achievements if not present
const seedAchievements = [
  { id: '1', title: 'Primera Reflexión', description: 'Escribiste tu primera reflexión en el diario', icon: '📝', xp_reward: 50 },
  { id: '2', title: 'Cuerpo Consciente', description: 'Registraste tu primera entrada de dieta', icon: '🥗', xp_reward: 50 },
  { id: '3', title: 'Organizador Novato', description: 'Completaste tu primera tarea', icon: '📋', xp_reward: 50 },
  { id: '4', title: 'Constancia Inicial', description: 'Completaste todos tus hábitos por primera vez', icon: '🔥', xp_reward: 100 },
  { id: '5', title: 'Racha de 7 días', description: 'Completaste al menos un hábito cada día por 7 días', icon: '🔥', xp_reward: 150 },
  { id: '6', title: 'Mes en Verde', description: 'Cerraste un mes sin pasarte de tu presupuesto', icon: '🛡️', xp_reward: 300 }
]

const insertAchievement = db.prepare(`
  INSERT OR IGNORE INTO achievements (id, title, description, icon, xp_reward)
  VALUES (?, ?, ?, ?, ?)
`)
for (const ach of seedAchievements) {
  insertAchievement.run(ach.id, ach.title, ach.description, ach.icon, ach.xp_reward)
}

// Helper: Add XP and level up
export function addXP(userId: string, amount: number) {
  const stats = db.prepare('SELECT xp, level FROM user_stats WHERE user_id = ?').get(userId) as { xp: number; level: number } | undefined
  if (!stats) return

  const newXp = Math.max(0, stats.xp + amount)
  // Level formula: Level = floor(new_xp / 100) + 1
  const newLevel = Math.floor(newXp / 100) + 1

  db.prepare('UPDATE user_stats SET xp = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newXp, newLevel, userId)
}

// Helper: Check and unlock achievements
export function checkAndUnlockAchievements(userId: string) {
  const results: { achievement_title: string; xp_awarded: number; newly_unlocked: boolean }[] = []

  // Check 1: Primera Reflexión (>= 1 journal entry of type 'journal')
  const reflection = db.prepare("SELECT 1 FROM journal_entries WHERE user_id = ? AND entry_type = 'journal' LIMIT 1").get(userId)
  
  // Check 2: Cuerpo Consciente (>= 1 journal entry of type 'diet')
  const diet = db.prepare("SELECT 1 FROM journal_entries WHERE user_id = ? AND entry_type = 'diet' LIMIT 1").get(userId)

  // Check 3: Organizador Novato (>= 1 task done)
  const taskDone = db.prepare("SELECT 1 FROM tasks WHERE user_id = ? AND status = 'done' LIMIT 1").get(userId)

  // Check 4: Constancia Inicial (>= 1 perfect habit day)
  const totalHabitsRow = db.prepare('SELECT count(*) as count FROM habits WHERE user_id = ?').get(userId) as { count: number } | undefined
  const totalHabits = totalHabitsRow?.count ?? 0
  const perfectHabitDay = totalHabits > 0 && db.prepare(`
    SELECT 1 FROM (
      SELECT log_date, count(*) as completed_count FROM habit_logs WHERE user_id = ? GROUP BY log_date
    ) WHERE completed_count >= ? LIMIT 1
  `).get(userId, totalHabits)

  // Check 5: Racha de 7 días (streak >= 7 or 7 consecutive log days)
  const stats = db.prepare('SELECT streak FROM user_stats WHERE user_id = ?').get(userId) as { streak: number } | undefined
  const has7d = (stats && stats.streak >= 7)

  // Check 6: Mes en Verde (previous month budget vs expenses)
  const profile = db.prepare('SELECT monthly_budget FROM profiles WHERE id = ?').get(userId) as { monthly_budget: number } | undefined
  const budget = profile ? profile.monthly_budget : 0
  
  let hasGreen = false
  if (budget > 0) {
    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE user_id = ? AND type = 'expense'
      AND transaction_date >= DATE('now', 'start of month', '-1 month')
      AND transaction_date <= DATE('now', 'start of month', '-1 day')
    `).get(userId) as { total: number } | undefined
    if (expenses && expenses.total <= budget) {
      hasGreen = true
    }
  }

  // Evaluate each achievement
  const allAchievements = db.prepare('SELECT id, title, xp_reward FROM achievements').all() as { id: string; title: string; xp_reward: number }[]
  for (const ach of allAchievements) {
    let qualifies = false
    if (ach.title === 'Primera Reflexión' && reflection) qualifies = true
    if (ach.title === 'Cuerpo Consciente' && diet) qualifies = true
    if (ach.title === 'Organizador Novato' && taskDone) qualifies = true
    if (ach.title === 'Constancia Inicial' && perfectHabitDay) qualifies = true
    if (ach.title === 'Racha de 7 días' && has7d) qualifies = true
    if (ach.title === 'Mes en Verde' && hasGreen) qualifies = true

    if (qualifies) {
      const unlocked = db.prepare('SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(userId, ach.id)
      if (!unlocked) {
        // Unlock now
        db.prepare('INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id) VALUES (?, ?, ?)')
          .run(`${userId}-${ach.id}`, userId, ach.id)
        
        // Award XP
        addXP(userId, ach.xp_reward)
        results.push({ achievement_title: ach.title, xp_awarded: ach.xp_reward, newly_unlocked: true })
      } else {
        results.push({ achievement_title: ach.title, xp_awarded: 0, newly_unlocked: false })
      }
    }
  }

  return results;
}

// SQL injection-safe column checker
function cleanIdentifier(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, '')
}

// Global runner for mapping Supabase-style query JSON to better-sqlite3 execution
export function runSQLiteQuery(query: MockQuery): MockChainResult {
  try {
    const { table, action, args, filters, order, single, maybeSingle, rpcName, rpcArgs } = query

    // 1. Handle RPC calls
    if (rpcName) {
      if (rpcName === 'check_and_unlock_achievements') {
        const userId = (rpcArgs?.['target_user_id'] as string | undefined) || MOCK_USER_ID
        const results = checkAndUnlockAchievements(userId)
        return { data: results, error: null }
      }
      return { data: null, error: `RPC ${rpcName} not implemented in SQLite adapter` }
    }

    const tbl = cleanIdentifier(table ?? '')
    let sql = ''
    const params: unknown[] = []

    // 2. Pre-query XP hooks
    let oldTaskStatus: string | null = null
    if (tbl === 'tasks' && action === 'update' && filters) {
      const idFilter = filters.find((f) => f.column === 'id' && f.type === 'eq')
      if (idFilter) {
        const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(idFilter.value) as { status: string } | undefined
        if (row) oldTaskStatus = row.status
      }
    }

    let oldJournalEntry: { entry_type: string } | null = null
    if (tbl === 'journal_entries' && action === 'delete' && filters) {
      const idFilter = filters.find((f) => f.column === 'id' && f.type === 'eq')
      if (idFilter) {
        const row = db.prepare('SELECT entry_type FROM journal_entries WHERE id = ?').get(idFilter.value) as { entry_type: string } | undefined
        if (row) oldJournalEntry = row
      }
    }

    // 3. Build query
    if (action === 'select') {
      sql = `SELECT * FROM ${tbl}`
    } else if (action === 'insert') {
      const fields = args ? Object.keys(args).map(cleanIdentifier) : []
      const placeholders = fields.map(() => '?').join(', ')
      const values = args ? fields.map(f => {
        const val = args[f]
        if (typeof val === 'object' && val !== null) return JSON.stringify(val)
        return val
      }) : []
      sql = `INSERT INTO ${tbl} (${fields.join(', ')}) VALUES (${placeholders})`
      params.push(...values)
    } else if (action === 'update') {
      const fields = args ? Object.keys(args).map(cleanIdentifier) : []
      const sets = fields.map(f => `${f} = ?`).join(', ')
      const values = args ? fields.map(f => {
        const val = args[f]
        if (typeof val === 'object' && val !== null) return JSON.stringify(val)
        return val
      }) : []
      sql = `UPDATE ${tbl} SET ${sets}`
      params.push(...values)
    } else if (action === 'delete') {
      sql = `DELETE FROM ${tbl}`
    }

    // 4. Apply Filters
    if (filters && filters.length > 0) {
      const whereClauses = filters.map((f) => {
        const col = cleanIdentifier(f.column)
        if (f.type === 'eq') {
          params.push(f.value)
          return `${col} = ?`
        }
        return '1=1'
      })
      sql += ` WHERE ${whereClauses.join(' AND ')}`
    }

    // 5. Apply Order
    if (action === 'select' && order) {
      const col = cleanIdentifier(order.column)
      const dir = order.ascending ? 'ASC' : 'DESC'
      sql += ` ORDER BY ${col} ${dir}`
    }

    // 6. Execute Query
    let data: unknown = null

    if (action === 'select') {
      const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>
      const parsedRows = rows.map((row) => {
        const metadata = row['metadata']
        if (metadata && typeof metadata === 'string') {
          try { row['metadata'] = JSON.parse(metadata) } catch {}
        }
        return row
      })
      data = (single || maybeSingle) ? (parsedRows[0] || null) : parsedRows
    } else {
      const stmt = db.prepare(sql)
      const info = stmt.run(...params)
      if (action === 'insert') {
        data = { id: args?.['id'], ...args }
      } else {
        data = { changes: info.changes }
      }
    }

    // 7. Post-query XP hooks
    if (action === 'insert' && tbl === 'habit_logs') {
      addXP(MOCK_USER_ID, 15)
    } else if (action === 'delete' && tbl === 'habit_logs') {
      addXP(MOCK_USER_ID, -15)
    } else if (action === 'insert' && tbl === 'journal_entries' && args) {
      const type = args['entry_type']
      if (type === 'journal') addXP(MOCK_USER_ID, 20)
      else if (type === 'diet') addXP(MOCK_USER_ID, 15)
    } else if (action === 'delete' && tbl === 'journal_entries' && oldJournalEntry) {
      if (oldJournalEntry.entry_type === 'journal') addXP(MOCK_USER_ID, -20)
      else if (oldJournalEntry.entry_type === 'diet') addXP(MOCK_USER_ID, -15)
    } else if (action === 'update' && tbl === 'tasks' && args && args['status'] && oldTaskStatus) {
      const newStatus = args['status']
      if (oldTaskStatus !== 'done' && newStatus === 'done') {
        addXP(MOCK_USER_ID, 10)
      } else if (oldTaskStatus === 'done' && newStatus !== 'done') {
        addXP(MOCK_USER_ID, -10)
      }
    }

    return { data, error: null }
  } catch (err: unknown) {
    console.error('runSQLiteQuery failed:', err)
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

