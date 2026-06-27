# `rpg-progression` Specification

## Purpose

A small RPG layer that turns productivity into XP, levels, streaks, and unlockable achievements. XP hooks fire on `habit_logs`, `journal_entries`, and `tasks` mutations. A `checkAndUnlockAchievements` RPC evaluates achievement criteria idempotently.

## Requirements

### Requirement 1 — `user_stats` schema + level formula

The system MUST persist `user_stats` with `(user_id PK, level, xp, streak, last_active_date)` and a level formula:

```
level = max(1, floor(xp / 100) + 1)
```

- Reference: `supabase/migrations/20260626000002_rpg_triggers.sql:2-44`, `src/lib/sqlite-db.ts:148-158`.
- XP MUST be floored at 0 (negative XP from undo operations MUST clamp to 0).

### Requirement 2 — XP grants and deductions

The system MUST grant XP for the following events and MUST mirror-grant negative XP for the inverse events:

| Event | XP |
| --- | --- |
| Task status moves from `todo`/`ignored` → `done` | +10 |
| Task status moves from `done` → `todo`/`ignored` | −10 |
| `habit_logs` row inserted | +15 |
| `habit_logs` row deleted | −15 |
| `journal_entries` row inserted (entry_type `journal`) | +20 |
| `journal_entries` row inserted (entry_type `diet`) | +15 |
| `journal_entries` row deleted (entry_type `journal`) | −20 |
| `journal_entries` row deleted (entry_type `diet`) | −15 |

- Reference: `supabase/migrations/20260626000002_rpg_triggers.sql:46-90`, `supabase/migrations/20260626000003_journal_xp_and_achievements.sql:1-47`, `src/lib/sqlite-db.ts:344-362`.

### Requirement 3 — Achievement criteria

The `check_and_unlock_achievements(target_user_id)` RPC MUST evaluate exactly these six criteria, idempotently:

| Achievement | Criterion |
| --- | --- |
| `Primera Reflexión` | ≥ 1 `journal_entries` row with `entry_type='journal'` |
| `Cuerpo Consciente` | ≥ 1 `journal_entries` row with `entry_type='diet'` |
| `Organizador Novato` | ≥ 1 `tasks` row with `status='done'` |
| `Constancia Inicial` | ≥ 1 day where `count(habit_logs for that day) >= count(active habits for that user)`, with at least one habit |
| `Racha de 7 días` | `user_stats.streak >= 7`, OR 7 consecutive `habit_logs` days via `dense_rank` window |
| `Mes en Verde` | previous calendar month's expenses ≤ `profiles.monthly_budget`, only when `monthly_budget > 0` |

- Reference: `supabase/migrations/20260626000004_budget_and_achievements_check.sql:17-118`.

### Requirement 4 — Idempotent unlock + one-time XP award

Each achievement MUST be unlocked at most once per user. The `INSERT` into `user_achievements` MUST use `ON CONFLICT (user_id, achievement_id) DO NOTHING`, and the XP reward MUST be granted only on the first unlock (i.e. only when the insert actually inserted a row).

- Reference: `supabase/migrations/20260626000004_budget_and_achievements_check.sql:120-150`.

### Requirement 5 — SQLite adapter mirrors Postgres behavior

The local SQLite adapter (`runSQLiteQuery` → `checkAndUnlockAchievements`) MUST mirror the Postgres behavior so the local app shows the same unlocks without a real Supabase backend.

- Reference: `src/lib/sqlite-db.ts:160-230, 243-248`.
- Both backends MUST yield the same set of unlocked achievements for a given set of user data.

## Scenarios

### Scenario: XP grant on task completion
- GIVEN a user with `xp=0`
- WHEN a task moves from `todo` to `done`
- THEN `user_stats.xp=10` and `user_stats.level=1`.

### Scenario: XP grant on habit log
- GIVEN a user with `xp=10`
- WHEN a `habit_log` row is inserted
- THEN `user_stats.xp=25`.

### Scenario: XP grant on journal vs diet
- GIVEN a `journal` entry is inserted
- WHEN committed
- THEN `xp += 20`.
- GIVEN a `diet` entry is inserted
- WHEN committed
- THEN `xp += 15`.

### Scenario: XP floors at zero
- GIVEN `xp=5` and a −15 deduction is applied
- WHEN committed
- THEN `xp=0` and `level=1` (no negative XP).

### Scenario: Level up
- GIVEN `xp=95` and a `+10` grant
- WHEN applied
- THEN `xp=100` and `level=2`.

### Scenario: Idempotent achievement unlock
- GIVEN `Organizador Novato` was already unlocked for the user
- WHEN `checkAndUnlockAchievements` runs again
- THEN no new `user_achievements` row is inserted and no XP is re-awarded.

### Scenario: `Mes en Verde` is gated by `monthly_budget > 0`
- GIVEN `monthly_budget=0` and previous-month expenses of 0
- WHEN the check runs
- THEN `Mes en Verde` is NOT unlocked.

### Scenario: `Mes en Verde` unlocks with budget
- GIVEN `monthly_budget=50000` and previous-month expenses of 30000
- WHEN the check runs
- THEN `Mes en Verde` is unlocked and `+300 XP` is granted.

### Scenario: `Constancia Inicial` requires ≥ 1 habit
- GIVEN the user has zero habits but ≥ 1 `habit_log` row
- WHEN the check runs
- THEN `Constancia Inicial` is NOT unlocked.

## Out of scope

- Streak recomputation logic (the spec only mandates the trigger sources for `streak`; the actual streak counter is a future concern).
- Custom user-defined achievements.
- Decay / time-limited achievements.
- Leaderboards (single-user app).
- A `user_stats.streak` incrementer (the migration `20260626000002_rpg_triggers.sql` does not implement it; v1 reads `streak` but the `Racha de 7 días` fallback path uses the `dense_rank` window over `habit_logs`).
