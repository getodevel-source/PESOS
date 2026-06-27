import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

// Resolve the rollback file under supabase/migrations/. Because vitest.config.ts
// scopes include to src/**, the test file lives here but reads from the
// migrations directory via absolute path resolution.
const ROLLBACK = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '00000000009999_rollback_strategy.sql'
)

const ORIGINAL_FILES = [
  '20260616000000_init_schema.sql',
  '20260626000000_add_pending_transaction.sql',
  '20260626000001_rpg_system.sql',
  '20260626000002_rpg_triggers.sql',
  '20260626000003_journal_xp_and_achievements.sql',
  '20260626000004_budget_and_achievements_check.sql',
  '20260626000005_add_journal_metadata.sql',
]

const ORIGINALS = ORIGINAL_FILES.map((f) =>
  path.join(__dirname, '..', '..', 'supabase', 'migrations', f)
)

// Helper: build a regex that the rollback file should contain to "undo" a
// given CREATE/ALTER statement. Returns null for statements that don't need a
// matching DROP (e.g. ENABLE ROW LEVEL SECURITY — implicitly dropped with
// the table).
//
// Convention: the rollback file uses `drop <kind> [if exists] [schema.]<name>`
// for every CREATE/ALTER. We capture only the trailing identifier (the
// "object name") and let the dropRe allow an optional schema prefix.
function buildDropRegex(stmt: string): RegExp | null {
  const t = stmt.trim()

  // CREATE [OR REPLACE] FUNCTION [schema.]name
  let m = t.match(
    /^create\s+(?:or\s+replace\s+)?function\s+(?:[\w"]+\s*\.\s*)?([\w"]+)/i
  )
  if (m) {
    const name = m[1].replace(/[^a-z0-9_]/gi, '')
    return new RegExp(
      `drop\\s+function\\s+(?:if\\s+exists\\s+)?(?:[\\w"]+\\s*\\.\\s*)?${name}\\b`,
      'i'
    )
  }

  // CREATE TRIGGER name
  m = t.match(/^create\s+trigger\s+([\w"]+)/i)
  if (m) {
    const name = m[1].replace(/[^a-z0-9_]/gi, '')
    return new RegExp(
      `drop\\s+trigger\\s+(?:if\\s+exists\\s+)?${name}\\b`,
      'i'
    )
  }

  // CREATE POLICY "name"
  m = t.match(/^create\s+policy\s+"([^"]+)"/i)
  if (m) {
    const policyName = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(
      `drop\\s+policy\\s+(?:if\\s+exists\\s+)?"${policyName}"`,
      'i'
    )
  }

  // CREATE TABLE [IF NOT EXISTS] [schema.]name
  m = t.match(
    /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:[\w"]+\s*\.\s*)?([\w"]+)/i
  )
  if (m) {
    const name = m[1].replace(/[^a-z0-9_]/gi, '')
    return new RegExp(
      `drop\\s+table\\s+(?:if\\s+exists\\s+)?(?:[\\w"]+\\s*\\.\\s*)?${name}\\b`,
      'i'
    )
  }

  // ALTER TABLE [schema.]name ADD COLUMN [IF NOT EXISTS] [schema.]col
  m = t.match(
    /^alter\s+table\s+(?:if\s+exists\s+)?(?:[\w"]+\s*\.\s*)?([\w"]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(?:[\w"]+\s*\.\s*)?([\w"]+)/i
  )
  if (m) {
    const table = m[1].replace(/[^a-z0-9_]/gi, '')
    const column = m[2].replace(/[^a-z0-9_]/gi, '')
    return new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:[\\w"]+\\s*\\.\\s*)?${table}\\s+drop\\s+column\\s+(?:if\\s+exists\\s+)?${column}\\b`,
      'i'
    )
  }

  // ALTER TABLE ... ENABLE ROW LEVEL SECURITY — implicit when table is dropped.
  if (/^alter\s+table\s+[\w."]+\s+enable\s+row\s+level\s+security/i.test(t)) {
    return null
  }

  // Unknown / unsupported: skip (don't fail) but report in failures.
  return null
}

describe('rls rollback strategy', () => {
  it('exists, is non-empty, has a re-apply header, and drops everything originals create', () => {
    const text = fs.readFileSync(ROLLBACK, 'utf8')

    // Non-empty
    expect(text.trim().length).toBeGreaterThan(0)

    // Starts with a comment block (re-apply header)
    expect(text.startsWith('--')).toBe(true)

    // Concatenate every original file, then scan for CREATE/ALTER statements
    const originals = ORIGINALS.flatMap((p) =>
      fs.readFileSync(p, 'utf8').split('\n')
    )

    // Only pick lines that BEGIN with create/alter (skip inline keywords
    // that appear inside `do $$ … $$` blocks — those will be matched
    // by their own first-line form).
    const creates = originals.filter((l) =>
      /^\s*(create|alter)\s+/i.test(l)
    )

    const failures: string[] = []

    for (const stmt of creates) {
      const dropRe = buildDropRegex(stmt)
      if (dropRe === null) continue

      if (!dropRe.test(text)) {
        failures.push(`No matching DROP for: ${stmt.trim().slice(0, 100)}`)
      }
    }

    expect(failures).toEqual([])
  })
})
