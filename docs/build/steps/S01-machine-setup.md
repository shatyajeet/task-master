---
step: S01
title: "Machine setup"
status: not-started
started:
completed:
---

# S01 · Machine setup

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [architecture: Installing the services](../../architecture.md#installing-the-services)

**Needs:** nothing. This is manual work with administrator rights.

**Do**, as the architecture's "Installing the services" section describes:

1. Install Postgres 19 with the EDB installer: port 5432, and a password for the `postgres` superuser.
2. Install Python 3.14: `winget install -e --id Python.Python.3.14`.
3. Install LibreOffice: `winget install -e --id TheDocumentFoundation.LibreOffice`.
4. Build and install pgvector 0.8.7 with `nmake`, following the architecture's commands.
5. In `postgresql.conf`, set `listen_addresses = 'localhost'`. In `pg_hba.conf`, keep only `host all all 127.0.0.1/32 scram-sha-256` and `host all all ::1/128 scram-sha-256`. Restart the `postgresql-x64-19` service.
6. Create the app role as `postgres`: `CREATE ROLE taskmaster LOGIN PASSWORD '<pw>';`.
7. Create the folders `C:\taskmaster-data\uploads`, `C:\taskmaster-data\out` and `C:\taskmaster-data\models`.
8. Make sure the repository is not inside OneDrive.

**Verify**, in PowerShell:

```text
& "C:\Program Files\PostgreSQL\19\bin\psql.exe" -U postgres -h 127.0.0.1 -c "SHOW server_version; SHOW listen_addresses; SELECT default_version FROM pg_available_extensions WHERE name='vector';"
py -3.14 --version
& "C:\Program Files\LibreOffice\program\soffice.exe" --version
node --version
```

Expected output: `19.x`, `localhost` and `0.8.7`; then `Python 3.14.10` or later; then `LibreOffice 26.8.3` or later; then `v26.13.1` or later.

## Finish

1. Every **Verify** command above exits 0.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S01 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S01: Machine setup`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.
