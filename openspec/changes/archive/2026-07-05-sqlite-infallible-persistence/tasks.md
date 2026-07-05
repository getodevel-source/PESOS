# Tasks: SQLite Infallible Persistence

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Workload Forecast
- **Estimated changed lines**: 150-200 lines.
- **PR Strategy**: Single PR encompassing all phases is recommended due to low risk and small overall size (< 200 lines).

---

## Phase 1: Centralized Path Utility
- [x] **Task 1.1**: Create [paths.ts](file:///home/geto/Proyectos/PESOS/src/lib/paths.ts) exporting `getAppDir()`. Resolves standard OS data paths (`~/.local/share/pesos` on Linux, `~/Library/Application Support/pesos` on macOS, and `%APPDATA%\pesos` on Windows).
- [x] **Task 1.2**: Ensure parent directories are created recursively.
- [x] **Task 1.3**: Implement backward-compatible migration. If `~/.config/pesos` contains data and the new directory does not, copy files to prevent user data loss.

## Phase 2: Path Standardization
- [x] **Task 2.1**: Update [env-loader.ts](file:///home/geto/Proyectos/PESOS/src/lib/env-loader.ts) to resolve `.env.local` using `getAppDir()`.
- [x] **Task 2.2**: Update [ai-config.ts](file:///home/geto/Proyectos/PESOS/src/lib/ai-config.ts) to resolve `.ai-config.json` using `getAppDir()`.

## Phase 3: Backup Rotation & WAL
- [x] **Task 3.1**: Implement shift-based backup rotation (`pesos.db.bak.0` to `.4` shifting older ones) in [sqlite-db.ts](file:///home/geto/Proyectos/PESOS/src/lib/sqlite-db.ts).
- [x] **Task 3.2**: Configure database connection in [sqlite-db.ts](file:///home/geto/Proyectos/PESOS/src/lib/sqlite-db.ts) to enable WAL mode (`PRAGMA journal_mode=WAL;`) and verify active mode.
- [x] **Task 3.3**: Apply a busy timeout of 5000ms (`PRAGMA busy_timeout=5000;`) in [sqlite-db.ts](file:///home/geto/Proyectos/PESOS/src/lib/sqlite-db.ts).

## Phase 4: Corruption Recovery & Boot Check
- [x] **Task 4.1**: In [sqlite-db.ts](file:///home/geto/Proyectos/PESOS/src/lib/sqlite-db.ts), open a temporary connection on startup to perform `PRAGMA integrity_check;`.
- [x] **Task 4.2**: If corruption is found, quarantine `pesos.db` by renaming it to `pesos.db.corrupt.<timestamp>`.
- [x] **Task 4.3**: Clean up the `-wal` and `-shm` sidecar files of the quarantined database.
- [x] **Task 4.4**: Iterate through the backups (0 to 4), restoring and verifying the latest healthy backup. Fallback to clean DB initialization if all fail.

## Phase 5: Verification Unit Tests
- [x] **Task 5.1**: Write tests mocking `os.platform()` and environment variables to verify correct path resolution in `paths.ts`.
- [x] **Task 5.2**: Write tests verifying the backup rotation logic and limit of 5 files.
- [x] **Task 5.3**: Write tests simulating database corruption to assert quarantine renaming and recovery restoration.
- [x] **Task 5.4**: Write tests verifying connection parameters (WAL mode and busy timeout).

## Phase 6: Build & Manual Verification
- [x] **Task 6.1**: Run `npm run build` (or equivalent build command) to verify Next.js compiling.
- [x] **Task 6.2**: Manually corrupt the active database and verify the boot-time quarantine and self-healing backup restoration.
