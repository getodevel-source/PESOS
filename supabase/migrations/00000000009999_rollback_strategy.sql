-- ─── ROLLBACK STRATEGY — mvp-vida-core ───────────────────────────────────────
-- Re-apply order (chronological, forward direction):
--   20260616000000_init_schema.sql
--   20260626000000_add_pending_transaction.sql
--   20260626000001_rpg_system.sql
--   20260626000002_rpg_triggers.sql
--   20260626000003_journal_xp_and_achievements.sql
--   20260626000004_budget_and_achievements_check.sql
--   20260626000005_add_journal_metadata.sql
--
-- Run this file on a Supabase project where the migrations above have been
-- applied, to drop every table / policy / trigger / function / column those
-- migrations created. DROP statements appear in REVERSE dependency order
-- (child tables first, then parent). The forward migrations are idempotent
-- (CREATE TABLE / ALTER TABLE ADD COLUMN use IF NOT EXISTS), so re-running
-- the originals re-creates the schema after a rollback.
--
-- WARNING: this is destructive. It DROPs user data via CASCADE on every
-- table. Use only when the operator intends to roll back the full schema.

-- ─── 20260626000005 — drop journal_entries.metadata ─────────────────────────
ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS metadata;

-- ─── 20260626000004 — drop check_and_unlock_achievements + monthly_budget ───
DROP FUNCTION IF EXISTS public.check_and_unlock_achievements(uuid) CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_budget;

-- ─── 20260626000003 — drop journal triggers + helpers ───────────────────────
DROP TRIGGER IF EXISTS trigger_journal_xp_insert ON public.journal_entries;
DROP TRIGGER IF EXISTS trigger_journal_xp_delete ON public.journal_entries;
DROP FUNCTION IF EXISTS public.on_journal_entry_insert() CASCADE;
DROP FUNCTION IF EXISTS public.on_journal_entry_delete() CASCADE;

-- ─── 20260626000002 — drop task/habit triggers + xp function ────────────────
DROP TRIGGER IF EXISTS trigger_task_xp ON public.tasks;
DROP TRIGGER IF EXISTS trigger_habit_log_xp ON public.habit_logs;
DROP FUNCTION IF EXISTS public.on_task_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.on_habit_log_change() CASCADE;
DROP FUNCTION IF EXISTS public.add_user_xp(uuid, integer) CASCADE;

-- ─── 20260626000001 — drop rpg_system (achievements, user_achievements, …) ──
DROP POLICY IF EXISTS "Users can read/write their achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Anyone can read achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.user_stats;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;

-- ─── 20260626000000 — drop pending_transaction column ───────────────────────
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pending_transaction;

-- ─── 20260616000000 — drop init_schema (policies, trigger, function, tables) ─
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage their own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage their own inputs" ON public.inputs;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- DROP TABLE order respects FK: child tables first.
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.inputs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
