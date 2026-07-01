# `mock-layer` — Specification

## Purpose

Documents the dual-layer data architecture in `pesos`: the **offline
SQLite mirror** (the source of truth at runtime) and the **type-only
Supabase-shaped mock** (the type contract components code against).
The two are deliberately parallel implementations, not a true
Supabase integration. This spec captures the design and the
guarantees that keep the two in sync.

## The two layers

| Layer | File | Role | Lifecycle |
| --- | --- | --- | --- |
| `sqlite-db.ts` | `src/lib/sqlite-db.ts` | **Runtime data store.** Holds the actual `better-sqlite3` connection, the `CREATE TABLE` schema, and the row-shape interfaces. Used by API route handlers on the server. | Long-lived; created on app start, persisted to `~/.config/pesos/pesos.db`. |
| `supabase.ts` | `src/lib/supabase.ts` | **Server mock.** `createAdminClient()` returns a `MockQueryChain` that validates against the same row shapes. Used by API route handlers for typed DB access. The mock does **not** hit SQLite directly; it goes through the chain. | Per-request; pure JS, no I/O. |
| `supabase-client.ts` | `src/lib/supabase-client.ts` | **Browser mock.** `createClient()` returns a similar chain that always resolves to `{ data: null, error: null }`. Used by client components for typed query shapes. | Per-render; pure JS, no I/O. |

## Why two parallel implementations

This is a **single-user, offline-first** desktop app. The "Supabase
client" was added in the original MVP for forward-compatibility (the
project was designed to one day move from local mock to a real
Supabase backend). The local mock keeps the components API-stable
while the storage layer is the local SQLite.

Concretely:
- Components written against `supabase.from('habits').select('id, title')` are identical in shape to what a real Supabase integration would look like.
- When the migration to real Supabase happens, only the chain internals change — call sites stay the same.

This is the **bridge** pattern, not a mock-to-be-replaced pattern.

## Drift risk and mitigation

The risk: someone adds a new table to `sqlite-db.ts` (the actual
schema) but forgets to update `MockDatabase` in `supabase.ts` (or
vice-versa). The runtime then either:
- Has a SQLite table the type system doesn't know about (insertion via the chain works but TS errors), or
- Has a typed table the SQLite doesn't (insertion via the chain errors with a "no such table" SQLite error).

The mitigation is twofold:

### 1. `scripts/check-mock-schema-sync.sh` (CI check)

The script extracts the table names from both:
- Schema: every `CREATE TABLE IF NOT EXISTS <name> (`
- Mock: every entry inside `MockDatabase.public.Tables`

and `comm -23` / `comm -13` the two sorted lists. Any drift exits
non-zero and prints the offending table names. Runs in < 1s.

The script is intentionally **table-name only**. Column-level
correctness is enforced by TypeScript's structural typing at compile
time — any `select` / `insert` against a mismatched row type fails
`tsc`. The CI check is the cheap, always-on safety net for the
table-name layer.

### 2. Schema promotion discipline

When a migration is added (e.g. a new column on `habits`):

1. Add the column to the `CREATE TABLE` in `sqlite-db.ts`.
2. Add the field to the corresponding `HabitsTable` interface in the same file.
3. The chain in `supabase.ts` and `supabase-client.ts` reads the type from there, so the chain updates automatically.

The reverse (adding a field to the mock type but not the schema)
should be caught by `tsc --noEmit` and by the schema-sync script.

## Known mock-surface extensions

The mock chain includes some methods that have no equivalent in the
real Supabase client — they're TypeScript-only conveniences:

- `MockQueryChain.throwOnError()` — no-op for the browser mock
  (returns the chain unchanged). Used at call sites that want to
  express "throw if `error` is non-null" without manual checks.
  Exposed for type compatibility with the real `supabase-js` chain
  signature.
- `MockPostgrestError` — a hand-rolled type that mirrors
  `PostgrestError`. The mock's `error` field is typed as
  `MockPostgrestError | null`.

These are intentional. They let the call sites compile against
`supabase-js` types while the runtime is the local mock.

## Out of scope

- The migration to a real Supabase backend (when the user count
  grows beyond 1). Tracked as a future change; not on the roadmap
  for the v1.x line.
- Auto-generating TypeScript types from the SQLite schema via a
  build step. Considered but deferred — the manual approach is
  simple enough at this scale, and the schema-sync script catches
  drift.
