import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

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

  let newXp = Math.max(0, stats.xp + amount)
  // Level formula: Level = floor(new_xp / 100) + 1
  let newLevel = Math.floor(newXp / 100) + 1

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
  const totalHabits = (db.prepare('SELECT count(*) as count FROM habits WHERE user_id = ?').get(userId) as any).count
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
export function runSQLiteQuery(query: any): { data: any; error: string | null } {
  try {
    const { table, action, args, filters, order, single, maybeSingle, rpcName, rpcArgs } = query

    // 1. Handle RPC calls
    if (rpcName) {
      if (rpcName === 'check_and_unlock_achievements') {
        const userId = rpcArgs?.target_user_id || MOCK_USER_ID
        const results = checkAndUnlockAchievements(userId)
        return { data: results, error: null }
      }
      return { data: null, error: `RPC ${rpcName} not implemented in SQLite adapter` }
    }

    const tbl = cleanIdentifier(table)
    let sql = ''
    const params: any[] = []

    // 2. Pre-query XP hooks
    let oldTaskStatus: string | null = null
    if (tbl === 'tasks' && action === 'update' && filters) {
      const idFilter = filters.find((f: any) => f.column === 'id' && f.type === 'eq')
      if (idFilter) {
        const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(idFilter.value) as { status: string } | undefined
        if (row) oldTaskStatus = row.status
      }
    }

    let oldJournalEntry: { entry_type: string } | null = null
    if (tbl === 'journal_entries' && action === 'delete' && filters) {
      const idFilter = filters.find((f: any) => f.column === 'id' && f.type === 'eq')
      if (idFilter) {
        const row = db.prepare('SELECT entry_type FROM journal_entries WHERE id = ?').get(idFilter.value) as { entry_type: string } | undefined
        if (row) oldJournalEntry = row
      }
    }

    // 3. Build query
    if (action === 'select') {
      sql = `SELECT * FROM ${tbl}`
    } else if (action === 'insert') {
      const fields = Object.keys(args).map(cleanIdentifier)
      const placeholders = fields.map(() => '?').join(', ')
      const values = fields.map(f => {
        const val = args[f]
        if (typeof val === 'object' && val !== null) return JSON.stringify(val)
        return val
      })
      sql = `INSERT INTO ${tbl} (${fields.join(', ')}) VALUES (${placeholders})`
      params.push(...values)
    } else if (action === 'update') {
      const fields = Object.keys(args).map(cleanIdentifier)
      const sets = fields.map(f => `${f} = ?`).join(', ')
      const values = fields.map(f => {
        const val = args[f]
        if (typeof val === 'object' && val !== null) return JSON.stringify(val)
        return val
      })
      sql = `UPDATE ${tbl} SET ${sets}`
      params.push(...values)
    } else if (action === 'delete') {
      sql = `DELETE FROM ${tbl}`
    }

    // 4. Apply Filters
    if (filters && filters.length > 0) {
      const whereClauses = filters.map((f: any) => {
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
    let data: any = null
    
    if (action === 'select') {
      const rows = db.prepare(sql).all(...params)
      const parsedRows = rows.map((row: any) => {
        if (row.metadata && typeof row.metadata === 'string') {
          try { row.metadata = JSON.parse(row.metadata) } catch {}
        }
        return row
      })
      data = (single || maybeSingle) ? (parsedRows[0] || null) : parsedRows
    } else {
      const stmt = db.prepare(sql)
      const info = stmt.run(...params)
      if (action === 'insert') {
        data = { id: args.id, ...args }
      } else {
        data = { changes: info.changes }
      }
    }

    // 7. Post-query XP hooks
    if (action === 'insert' && tbl === 'habit_logs') {
      addXP(MOCK_USER_ID, 15)
    } else if (action === 'delete' && tbl === 'habit_logs') {
      addXP(MOCK_USER_ID, -15)
    } else if (action === 'insert' && tbl === 'journal_entries') {
      const type = args.entry_type
      if (type === 'journal') addXP(MOCK_USER_ID, 20)
      else if (type === 'diet') addXP(MOCK_USER_ID, 15)
    } else if (action === 'delete' && tbl === 'journal_entries' && oldJournalEntry) {
      if (oldJournalEntry.entry_type === 'journal') addXP(MOCK_USER_ID, -20)
      else if (oldJournalEntry.entry_type === 'diet') addXP(MOCK_USER_ID, -15)
    } else if (action === 'update' && tbl === 'tasks' && args.status && oldTaskStatus) {
      if (oldTaskStatus !== 'done' && args.status === 'done') {
        addXP(MOCK_USER_ID, 10)
      } else if (oldTaskStatus === 'done' && args.status !== 'done') {
        addXP(MOCK_USER_ID, -10)
      }
    }

    return { data, error: null }
  } catch (err: unknown) {
    console.error('runSQLiteQuery failed:', err)
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

