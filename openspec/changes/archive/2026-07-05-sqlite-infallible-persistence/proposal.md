# Proposal: SQLite Infallible Persistence

## Intent
Improve the reliability, concurrency performance, and portability of local database storage by standardizing paths, enabling Write-Ahead Logging (WAL) mode, implementing rolling backups, and adding self-healing corruption recovery during startup.

## Scope
### In Scope
- Centralize directory path resolution to `src/lib/paths.ts` supporting standard Windows, macOS, and Linux conventions.
- Implement rolling backup rotation (up to 3 sequential backups: `pesos.db.bak`, `pesos.db.bak.1`, `pesos.db.bak.2`) using fast rename operations.
- Execute `PRAGMA integrity_check` on startup. If corrupt, recover automatically from the latest healthy backup or create a fresh DB while preserving the corrupted one.
- Enable WAL mode concurrency (`PRAGMA journal_mode = WAL`) and a 5-second busy timeout (`PRAGMA busy_timeout = 5000`) on SQLite connection opening.

### Out of Scope
- Local-to-cloud DB synchronization triggers (handled by Supabase sync flows).
- User UI widgets for manually triggering backup or restore.

## Capabilities
### New Capabilities
- Auto-recovery from SQLite corruption on boot.
- Support for platform-native app data directories on Windows, macOS, and Linux.
### Modified Capabilities
- Safe rolling backups instead of simple single-file backups.
- Improved database concurrency (multiple processes read/write concurrently without locking).

## Approach
1. **Path Utility**: Create `src/lib/paths.ts` to return standard OS data directories. Integrate into `sqlite-db.ts`, `ai-config.ts`, and `env-loader.ts`.
2. **Boot Check & Self-Healing**: On initialization in `sqlite-db.ts`, first copy a valid/checked DB to the backup chain. To copy, open a temporary connection, ensure checkpoints are run, then make copies. Alternatively, safely copy files before opening the main handle, or run `PRAGMA integrity_check` before rotating backups. If `integrity_check` fails, roll back to the newest healthy backup.
3. **Concurrency Optimization**: Execute WAL and busy timeout pragmas immediately after connection instantiation.

## Affected Areas
- `src/lib/paths.ts` (new path utility)
- `src/lib/sqlite-db.ts` (connection setup, backups, self-healing, WAL)
- `src/lib/ai-config.ts` (uses centralized path)
- `src/lib/env-loader.ts` (uses centralized path)

## Risks
- **Backups copying locked/dirty database handles**: In WAL mode, writes are staged in the `-wal` file. Copying `pesos.db` while it is actively written or locked can lead to inconsistent or corrupted backups.
  * *Mitigation*: Perform backup rotation and integrity verification during initialization before the main database connection is fully operational or active queries are run. Checkpoints will be flushed.

## Rollback Plan
- Revert path resolution to legacy `~/.config/pesos/` directory.
- Revert database initialization logic to the original direct `better-sqlite3` instance creation.
- Remove new `paths.ts` utility file.

## Dependencies
- Node.js native filesystem modules (`fs`, `path`, `os`)
- `better-sqlite3` driver package

## Success Criteria
- Passes `npm test` and all existing unit tests.
- DB folder resolves dynamically to standard OS path.
- App recovers and starts up with a clean or restored database when `pesos.db` is manually corrupted.
- Concurrency errors (`SQLITE_BUSY`) are eliminated.
