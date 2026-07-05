import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

let tmpDir: string
let mockAppDir: string

vi.mock('./paths', () => {
  return {
    getAppDir: () => mockAppDir,
  }
})

describe('sqlite-db persistence & resilience', () => {
  beforeEach(() => {
    vi.resetModules()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pesos-sqlite-db-'))
    mockAppDir = tmpDir
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      // Close db if open to prevent file locking on Windows/Linux
      try {
        const { db } = require('./sqlite-db')
        db.close()
      } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('configures connection with WAL mode and busy timeout', async () => {
    const { db } = await import('./sqlite-db')
    
    const journalMode = db.pragma('journal_mode')
    const mode = Array.isArray(journalMode) ? journalMode[0]?.journal_mode : journalMode
    expect(mode).toBe('wal')

    const timeout = db.pragma('busy_timeout', { simple: true })
    expect(Number(timeout)).toBe(5000)
  })

  it('rotates backups on startup if database is healthy', async () => {
    // 1. Create a dummy healthy database first
    const dbPath = path.join(tmpDir, 'pesos.db')
    const initDb = new Database(dbPath)
    initDb.exec("CREATE TABLE dummy (id TEXT PRIMARY KEY); INSERT INTO dummy VALUES ('test');")
    initDb.close()

    // 2. Pre-create some dummy backups to verify shifting
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.0'), 'bak0', 'utf8')
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.1'), 'bak1', 'utf8')
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.2'), 'bak2', 'utf8')
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.3'), 'bak3', 'utf8')
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.4'), 'bak4', 'utf8')

    // 3. Load sqlite-db which triggers startup rotation
    const { db } = await import('./sqlite-db')

    // 4. Assert shift occurred:
    // bak.3 -> bak.4 (bak4 overwritten)
    // bak.2 -> bak.3
    // bak.1 -> bak.2
    // bak.0 -> bak.1
    // pesos.db -> bak.0
    expect(fs.readFileSync(path.join(tmpDir, 'pesos.db.bak.4'), 'utf8')).toBe('bak3')
    expect(fs.readFileSync(path.join(tmpDir, 'pesos.db.bak.3'), 'utf8')).toBe('bak2')
    expect(fs.readFileSync(path.join(tmpDir, 'pesos.db.bak.2'), 'utf8')).toBe('bak1')
    expect(fs.readFileSync(path.join(tmpDir, 'pesos.db.bak.1'), 'utf8')).toBe('bak0')
    
    // bak.0 should be a valid sqlite db (not the string 'bak0')
    const bak0Db = new Database(path.join(tmpDir, 'pesos.db.bak.0'))
    const row = bak0Db.prepare('SELECT * FROM dummy').get() as { id: string }
    expect(row.id).toBe('test')
    bak0Db.close()

    // There should be no bak.5
    expect(fs.existsSync(path.join(tmpDir, 'pesos.db.bak.5'))).toBe(false)
  })

  it('heals by quarantining corrupt db and restoring latest healthy backup', async () => {
    // 1. Create a healthy backup at bak.1
    const healthyBakPath = path.join(tmpDir, 'pesos.db.bak.1')
    const healthyDb = new Database(healthyBakPath)
    healthyDb.exec("CREATE TABLE dummy (id TEXT PRIMARY KEY); INSERT INTO dummy VALUES ('healthy-backup-1');")
    healthyDb.close()

    // 2. Create a corrupt backup at bak.0 to verify recovery skips it and tries bak.1
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.0'), 'totally-corrupt-backup-file', 'utf8')

    // 3. Create corrupt main database pesos.db
    const dbPath = path.join(tmpDir, 'pesos.db')
    fs.writeFileSync(dbPath, 'corrupt-main-db', 'utf8')
    fs.writeFileSync(dbPath + '-wal', 'wal-data', 'utf8')
    fs.writeFileSync(dbPath + '-shm', 'shm-data', 'utf8')

    // 4. Load sqlite-db to trigger recovery
    const { db } = await import('./sqlite-db')

    // 5. Assert corrupt main db was quarantined
    const files = fs.readdirSync(tmpDir)
    const corruptFile = files.find(f => f.startsWith('pesos.db.corrupt.'))
    expect(corruptFile).toBeDefined()

    // 6. Assert restored database has the data from healthy-backup-1 (bak.1)
    const row = db.prepare('SELECT * FROM dummy').get() as { id: string }
    expect(row.id).toBe('healthy-backup-1')

    // 7. Close the db connection cleanly and verify no WAL/SHM sidecars remain
    db.close()
    expect(fs.existsSync(dbPath + '-wal')).toBe(false)
    expect(fs.existsSync(dbPath + '-shm')).toBe(false)
  })

  it('falls back to fresh database if all backups are corrupt or missing', async () => {
    // 1. Create corrupt main database pesos.db
    const dbPath = path.join(tmpDir, 'pesos.db')
    fs.writeFileSync(dbPath, 'corrupt-main-db', 'utf8')

    // 2. Create corrupt backups
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.0'), 'corrupt-bak', 'utf8')
    fs.writeFileSync(path.join(tmpDir, 'pesos.db.bak.1'), 'corrupt-bak', 'utf8')

    // 3. Load sqlite-db to trigger recovery fallback
    const { db } = await import('./sqlite-db')

    // 4. Assert a fresh database was initialized and contains the standard schema (e.g. profiles table exists)
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get('00000000-0000-0000-0000-000000000000')
    expect(row).toBeDefined()
  })
})
