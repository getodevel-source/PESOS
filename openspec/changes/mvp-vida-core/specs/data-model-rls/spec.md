# `data-model-rls` Specification

## Purpose

The persistent data model. The v1 app targets Postgres (Supabase) with a local SQLite mirror that exposes the same schema via the `runSQLiteQuery` adapter. All user-owned tables are RLS-protected so the same schema can survive a future Supabase cut-over.

## Requirements

### Requirement 1 — Tables and columns

The schema MUST include exactly the following tables with the columns and constraints defined in the canonical migrations:

- `profiles` — `id uuid PK → auth.users`, `updated_at`, `full_name`, `telegram_chat_id` (unique), `telegram_username`, `timezone`, `pending_transaction` (jsonb, migration `20260626000000`), `monthly_budget` (numeric, migration `20260626000004`).
- `inputs` — `id uuid PK`, `user_id → profiles.id` (nullable), `payload jsonb`, `processed boolean`, `created_at`.
- `tasks` — `id uuid PK`, `user_id → profiles.id`, `title`, `description`, `status` (CHECK `todo`/`done`/`ignored`), `due_date`, `completed_at`, `created_at`.
- `habits` — `id uuid PK`, `user_id → profiles.id`, `title` (legacy migration uses `title`; current SQLite adapter uses `name`), `description`, `frequency`, `created_at`.
- `habit_logs` — `id uuid PK`, `user_id → profiles.id`, `habit_id → habits.id`, `log_date`, `created_at`, `UNIQUE (habit_id, log_date)`.
- `transactions` — `id uuid PK`, `user_id → profiles.id`, `description`, `amount numeric(12,2) CHECK >= 0`, `type` (CHECK `income`/`expense`), `transaction_date`, `created_at`.
- `journal_entries` — `id uuid PK`, `user_id → profiles.id`, `content`, `entry_type` (CHECK `journal`/`diet`), `entry_date`, `metadata` (jsonb, migration `20260626000005`), `created_at`.
- `user_stats` — `user_id PK → profiles.id`, `level integer CHECK >= 1`, `xp integer CHECK >= 0`, `streak integer CHECK >= 0`, `last_active_date`, `updated_at`.
- `achievements` — `id uuid PK`, `title`, `description`, `icon`, `xp_reward`, `created_at`.
- `user_achievements` — `id uuid PK`, `user_id → profiles.id`, `achievement_id → achievements.id`, `unlocked_at`, `UNIQUE (user_id, achievement_id)`.

- Reference: `supabase/migrations/20260616000000_init_schema.sql:1-71`, `supabase/migrations/20260626000001_rpg_system.sql:1-28`.

### Requirement 2 — RLS policies

Every user-owned table (`profiles`, `inputs`, `tasks`, `habits`, `habit_logs`, `transactions`, `journal_entries`, `user_stats`, `user_achievements`) MUST have:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- A policy of the form `for all using (auth.uid() = <owner_column>)` where `<owner_column>` is `id` (for `profiles`) or `user_id` (for the rest).

- Reference: `supabase/migrations/20260616000000_init_schema.sql:73-102`, `supabase/migrations/20260626000001_rpg_system.sql:30-43`.

### Requirement 3 — Public catalog of achievements

The `achievements` table MUST be readable by all authenticated users (the catalog is public). The `user_achievements` join table itself MUST remain RLS-protected.

- Reference: `supabase/migrations/20260626000001_rpg_system.sql:39-43` — `create policy "Anyone can read achievements" on public.achievements for select using (true);`.

### Requirement 4 — `handle_new_user` trigger

A `handle_new_user()` trigger on `auth.users` MUST auto-create a `profiles` row and a `user_stats (level=1, xp=0, streak=0)` row on signup. Existing profiles MUST be backfilled with a `user_stats` row on `on conflict (user_id) do nothing`.

- Reference: `supabase/migrations/20260616000000_init_schema.sql:105-123`, `supabase/migrations/20260626000001_rpg_system.sql:52-77`.

### Requirement 5 — SQLite mirror parity

The local SQLite adapter (`src/lib/sqlite-db.ts`) MUST:

- Mirror the same tables, types, and CHECK constraints as the Postgres schema.
- Seed the catalog of achievements on init (six rows: `Primera Reflexión`, `Cuerpo Consciente`, `Organizador Novato`, `Constancia Inicial`, `Racha de 7 días`, `Mes en Verde`).
- Seed a single `MOCK_USER_ID` profile (`00000000-0000-0000-0000-000000000000`, email `user@pesos.local`) and `user_stats` row for offline use.

- Reference: `src/lib/sqlite-db.ts:7-15, 20-128, 131-147`.

### Requirement 6 — Rollback strategy

The `supabase/migrations/00000000009999_rollback_strategy.sql` file MUST exist, MUST be syntactically valid SQL, and MUST contain — in dependency order — a reverse statement (DROP) for every CREATE / ALTER / POLICY / TRIGGER / FUNCTION introduced by migrations `20260616000000` through `20260626000005`. The file MUST include a re-apply script header (comment block) listing the original migrations in chronological order. See `deltas/rls-rollback-strategy` for the detailed behavior contract.

## Scenarios

### Scenario: Postgres RLS blocks cross-user select
- GIVEN an authenticated user A and a row owned by user B
- WHEN A selects `tasks`
- THEN 0 rows are returned (RLS).

### Scenario: Postgres RLS allows self insert
- GIVEN A inserts a `tasks` row with `user_id = auth.uid()`
- WHEN committed
- THEN the row is persisted.

### Scenario: SQLite mirror insert + XP hook
- GIVEN a `tasks` insert via `runSQLiteQuery` with `args.user_id = MOCK_USER_ID` and `args.status = 'done'`
- WHEN committed
- THEN the row is in the local DB and `user_stats.xp += 10`.

### Scenario: Achievement seed on first run
- GIVEN a fresh SQLite DB
- WHEN the adapter inits
- THEN the `achievements` table contains all six seed entries.

### Scenario: Rollback file is parseable SQL
- GIVEN `00000000009999_rollback_strategy.sql` exists
- WHEN run through the test harness SQL parser
- THEN the file parses with no syntax errors.

### Scenario: Rollback reverses migrations in dependency order
- GIVEN all migrations `20260616000000`..`20260626000005` are applied
- WHEN the rollback is read
- THEN every CREATE / ALTER / POLICY from the originals has a matching DROP in the correct dependency order (e.g. `DROP TABLE tasks` precedes `DROP TABLE profiles`).

## Out of scope

- The route-handler-side date helpers (`new Date().toLocaleDateString('sv-SE')`, etc.).
- A real `auth.users` table (the app mirrors against `MOCK_USER_ID`).
- Migration tooling beyond the `supabase/migrations/*.sql` convention.
- Schema additions to the data model in this slice (proposal marks schema additions as out of scope).
- Backwards-compatibility shims for the `tasks.title` vs `tasks.name` discrepancy between the legacy migration and the current SQLite adapter.
