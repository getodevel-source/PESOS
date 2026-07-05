# SQLite Infallible Persistence Specification

## Requirements

### 1. Directory Path Resolution
- The application MUST resolve the database persistence directory dynamically based on the Host OS:
  - **Linux**: `~/.local/share/pesos`
  - **macOS**: `~/Library/Application Support/pesos`
  - **Windows**: `%APPDATA%\pesos`
- The application SHALL create the resolved directory and its parents if they do not exist.

### 2. WAL Mode & Timeout Constraints
- The SQLite database connection MUST enable Write-Ahead Logging (`PRAGMA journal_mode=WAL;`).
- The connection MUST set a busy timeout of exactly 5000 milliseconds (`PRAGMA busy_timeout=5000;`) to mitigate database lock contention.

### 3. Backup Rotation
- The persistence engine MUST perform a database backup before any schema migration or weekly.
- The engine MUST maintain a rotation of the last 5 backup files, deleting older backups to conserve disk space.

### 4. Corruption Detection & Self-Healing
- Upon initialization, the system MUST execute a database integrity check (`PRAGMA integrity_check;`).
- If corruption is detected or database initialization fails, the system SHALL quarantine the corrupt database and restore the latest valid backup.

---

## Scenarios

### Scenario 1: OS-Specific Path Resolution
**GIVEN** the application is running on Linux, macOS, or Windows
**WHEN** the persistence engine initializes
**THEN** it MUST resolve and verify the correct OS-specific directory path
**AND** it SHALL create the directory recursively if it is missing.

### Scenario 2: Connection Configuration (WAL & Timeout)
**GIVEN** a new database connection is requested
**WHEN** the connection is established
**THEN** the engine MUST issue `PRAGMA journal_mode=WAL;` and verify that the active mode is WAL
**AND** it MUST set `PRAGMA busy_timeout=5000;` to prevent write lock failures.

### Scenario 3: Backup Rotation Limit
**GIVEN** 5 existing backup files in the backup directory
**WHEN** a new database backup is triggered
**THEN** the engine MUST create the 6th backup file
**AND** it MUST delete the oldest backup file to ensure only the 5 most recent backups are retained.

### Scenario 4: Corruption Self-Healing
**GIVEN** a corrupt SQLite database file on disk
**WHEN** the application starts up and runs the integrity check
**THEN** the system MUST quarantine the corrupt file by renaming it with a `.corrupt` suffix
**AND** it SHALL restore the latest valid backup file to resume normal operation.
