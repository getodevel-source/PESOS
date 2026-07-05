## Exploration: sqlite-infallible-persistence

### Current State
1. **Hardcoded Configuration Paths**: In `src/lib/sqlite-db.ts`, `src/lib/ai-config.ts`, and `src/lib/env-loader.ts`, the user's config directory is hardcoded to `~/.config/pesos` regardless of the host operating system. This violates platform-standard conventions on macOS and Windows, causing potential permission issues or polluting user home folders.
2. **Naïve Database Backup**: A single backup copy (`pesos.db.bak`) is created upon initialization by copying the live file `pesos.db`. There is no rotation or history. If the live database is corrupted during initialization, the backup file gets overwritten with the corrupted version immediately, making recovery impossible.
3. **No Corruption Recovery / Boot Failure**: The database connection is instantiated directly via `new Database(dbPath)` without validating the file's integrity. If the file is corrupted, the initialization throws an exception and the Next.js/Electron bootloader crashes.
4. **No Concurrency Tuning**: The connection is opened without Write-Ahead Logging (WAL) or busy timeouts. In a concurrent Next.js + Electron environment, this frequently results in `SQLITE_BUSY` database locking errors.

### Affected Areas
- [sqlite-db.ts](file:///home/geto/Proyectos/PESOS/src/lib/sqlite-db.ts) — Main SQLite client and schema setup.
- [ai-config.ts](file:///home/geto/Proyectos/PESOS/src/lib/ai-config.ts) — AI provider settings path resolution.
- [env-loader.ts](file:///home/geto/Proyectos/PESOS/src/lib/env-loader.ts) — Path resolution for loading `.env.local`.
- `src/lib/paths.ts` — *New proposed utility file* to centralize cross-platform path resolution.

### Approaches

#### 1. Path Resolution
* **Approach A: Centralized Platform Path Resolver (`src/lib/paths.ts`)**
  Create a shared module that detects the operating system using Node's `os` and `process` modules, and resolves the standard application data/config directory:
  * Windows (`win32`): `%APPDATA%/pesos` (using `process.env.APPDATA` with fallback).
  * macOS (`darwin`): `~/Library/Application Support/pesos`.
  * Linux / POSIX: `$XDG_CONFIG_HOME/pesos` (falling back to `~/.config/pesos`).
  * **Pros**: Clean DRY code, absolute consistency across Database, AI settings, and environment loader, easily testable.
  * **Cons**: Requires creating a new utility file.
  * **Effort**: Low

* **Approach B: Inline Duplication**
  Re-implement the platform checks inside `sqlite-db.ts`, `ai-config.ts`, and `env-loader.ts`.
  * **Pros**: No new files created.
  * **Cons**: High duplication, risk of paths drifting if one is updated and others are not, higher risk of path mismatches.
  * **Effort**: Low

#### 2. Backup Rotation
* **Approach A: Shift-Based Rotation (Rolling History)**
  Maintain a rolling window of backups (`pesos.db.bak`, `pesos.db.bak.1`, `pesos.db.bak.2`) using fast file rename operations (`fs.renameSync`) for existing historical files before writing the active backup.
  * **Pros**: Inexpensive O(1) filesystem metadata operations, simple to implement without complex dependencies, robust history preservation.
  * **Cons**: None.
  * **Effort**: Low

#### 3. Corruption Check and Self-Healing
* **Approach A: Integrity Checking Bootloader**
  Wrap database instantiation in a check-and-recover loop:
  1. Open the SQLite connection.
  2. Run `PRAGMA integrity_check` on connection startup.
  3. If check fails, close the handle, try restoring the most recent healthy backup, and verify again.
  4. If all backups are corrupted or unavailable, rename the corrupt file to `pesos.db.corrupted.[timestamp]` to preserve it for forensic recovery and initialize a clean database.
  * **Pros**: Guarantees app will always boot successfully, prevents data overwrite of salvageable data, automatic self-healing.
  * **Cons**: Recovering from backup could result in minor data loss (loss of writes between backup creation and corruption), but this is vastly superior to a crashed application.
  * **Effort**: Medium

#### 4. Concurrency Optimization
* **Approach A: WAL Mode & Busy Timeout Pragmas**
  Immediately after opening the connection, execute:
  * `PRAGMA journal_mode = WAL;`
  * `PRAGMA busy_timeout = 5000;`
  * **Pros**: Drastically reduces read/write locking conflicts (readers and writers do not block each other), increases performance, handles concurrent Next.js/Electron database calls gracefully.
  * **Cons**: Creates auxiliary `-wal` and `-shm` files on the filesystem during operation, which need to be accounted for (but normal backup copy/close operations handle them seamlessly).
  * **Effort**: Low

---

### Recommendation
Implement **Approach A** for all four areas.
Specifically, create a centralized [paths.ts](file:///home/geto/Proyectos/PESOS/src/lib/paths.ts) module to resolve platform-standard folders, integrate backup rotation using `fs.renameSync`, implement an integrity-check self-healing loop on boot, and enable WAL mode + busy timeout on connection creation.

---

### Risks
* **WAL File Persistence during backups**: In WAL mode, some changes might be temporarily held in the `-wal` file. Copying only `pesos.db` could copy an incomplete snapshot.
  * *Mitigation*: Run `PRAGMA wal_checkpoint(TRUNCATE)` before copying, or close the DB connection before running the backup (which automatically merges the WAL file into the main database file). Since backup happens at startup before the DB is fully active, copying the file before initialization works perfectly.
* **Corrupted Backup Overwrite**: If the backup process runs unconditionally, a corrupted database could overwrite all rotating backups before the corruption is detected.
  * *Mitigation*: Ensure backup rotation only runs if the database successfully passes the `PRAGMA integrity_check`.

### Ready for Proposal
Yes — The technical plan is fully resolved. The orchestrator should proceed to define the specs and migration plan for the `sqlite-infallible-persistence` change.
