#!/usr/bin/env bash
# check-mock-schema-sync.sh
#
# Verifies that the table names in the offline mock (src/lib/supabase.ts,
# MockDatabase type) match the CREATE TABLE statements in the SQLite
# schema (src/lib/sqlite-db.ts). Catches drift early — if someone adds a
# new table to one but forgets the other, this fails.
#
# Does NOT verify column-level correctness — TypeScript's structural
# typing handles that (any .insert() / .select() that doesn't match the
# mock row type fails to compile). This is a table-name-level check.
#
# Runs in < 1 second. No dependencies beyond grep/sort/comm/diff.
#
# Exit codes:
#   0  schema and mock are in sync
#   1  drift detected (table in schema but not mock, or vice versa)
#   2  script error (file missing, etc.)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${REPO_ROOT}/src/lib/sqlite-db.ts"
MOCK_TYPE_FILE="${REPO_ROOT}/src/lib/sqlite-db.ts"  # MockDatabase is defined here

# Sanity
[ -f "${SCHEMA_FILE}" ] || { echo "FATAL: ${SCHEMA_FILE} not found" >&2; exit 2; }

# 1. Tables in the schema: lines like "CREATE TABLE IF NOT EXISTS <name> ("
SCHEMA_TABLES=$(grep -oE 'CREATE TABLE IF NOT EXISTS [a-z_]+' "${SCHEMA_FILE}" \
  | awk '{print $6}' \
  | sort -u)

# 2. Tables in the mock: entries like "      <name>: <Type>Table" inside
#    the MockDatabase type definition (the public: { Tables: { ... } } block).
#    We match lines that look like "      name: SomeNameTable" — no
#    trailing comma required (last entry doesn't have one).
MOCK_TABLES=$(awk '
  /^export type MockDatabase/,/^}/ { print }
' "${MOCK_TYPE_FILE}" \
  | grep -oE '^      [a-z_]+: [A-Z][A-Za-z_]*Table' \
  | awk '{print $1}' \
  | tr -d ':' \
  | sort -u)

# Diff
ONLY_IN_SCHEMA=$(comm -23 <(echo "${SCHEMA_TABLES}") <(echo "${MOCK_TABLES}"))
ONLY_IN_MOCK=$(comm -13 <(echo "${SCHEMA_TABLES}") <(echo "${MOCK_TABLES}"))

# Report
if [ -z "${ONLY_IN_SCHEMA}" ] && [ -z "${ONLY_IN_MOCK}" ]; then
  echo "OK: schema and mock are in sync."
  echo "  Tables in sync: $(echo "${SCHEMA_TABLES}" | wc -l)"
  exit 0
fi

echo "DRIFT DETECTED:" >&2
if [ -n "${ONLY_IN_SCHEMA}" ]; then
  echo "  Tables in schema (sqlite-db.ts) but NOT in the mock:" >&2
  echo "${ONLY_IN_SCHEMA}" | sed 's/^/    /' >&2
fi
if [ -n "${ONLY_IN_MOCK}" ]; then
  echo "  Tables in the mock (MockDatabase) but NOT in the schema:" >&2
  echo "${ONLY_IN_MOCK}" | sed 's/^/    /' >&2
fi
echo "" >&2
echo "Fix: add a matching CREATE TABLE in sqlite-db.ts, or remove the table" >&2
echo "     from MockDatabase. They must agree." >&2
exit 1
