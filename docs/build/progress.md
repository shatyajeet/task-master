# Build progress

What each finished step actually built, so an agent starting the next step knows the state of the code without reading all of it. Read this before starting any step.

The agent that finishes a step adds that step's entry at the bottom, in the same commit as the code.

## How to write an entry

- Keep each entry under 20 lines. Link to files; don't paste code.
- Record facts a later step needs: names, entry points, commands, versions the lockfile resolved, and anything surprising.
- **Deviations** are anything that differs from the step file: a different file name, an API that didn't behave as the plan assumed, an extra helper. Say why for each one. If there were none, write "None".
- **Plan files changed** lists every edit to `contracts.md`, a later step file, `allowed-dependencies.json` or `check-architecture.mjs` made in this step, each agreed with the user. If there were none, write "None".
- **README** is required. Either list the README sections this step changed, or write `no change needed` with the reason.
- **Architecture impact** is required. Either name the architecture sections you checked this step's work against and confirm it matches them, or name the `ARCH:` commit the user agreed to. An entry without it is incomplete, and so is the step.

Template:

```markdown
### S<NN> · <title> (<YYYY-MM-DD>)

- **Built:** what now exists and works, in one to three lines.
- **Key files:** [path](../../path), [path](../../path)
- **Commands:** new or changed commands, if any.
- **Deviations:** None. | What differs from the step file, and why.
- **Plan files changed:** None. | `contracts.md` § Fastify REST API: what changed. `S12`: what changed.
- **README:** Updated § Everyday commands, § Setup; status block now S01 to S<NN>. | No change needed: <reason>.
- **Architecture impact:** None; matches § OCR service, § Local-only access. | Agreed change in commit `ARCH: <summary>`.
- **Notes for later steps:** what the next steps should know, if anything.
```

## Entries

### S01 · Machine setup (2026-11-29)

- **Built:** The laptop now has Postgres 19.0 on `localhost` only, pgvector 0.8.7, Python 3.14.10, LibreOffice 26.8.3.1, Node v26.13.1, the `taskmaster` role, and the three folders under `C:\taskmaster-data`. The repository is outside OneDrive. No repository code changed.
- **Key files:** [S01-machine-setup.md](steps/S01-machine-setup.md)
- **Commands:** None. Run `py -3.14` for Python until S02 adds `scripts/py.mjs`.
- **Deviations:**
  - Python 3.14 came from the Python install manager (`py install`), not `winget`, because it was already in place. `py -3.14 --version` reports 3.14.10.
  - `pg_hba.conf` has only the two loopback `host` lines, so local-socket and replication lines were removed (the step says to keep only these two). The originals are saved beside the files as `*.bak-s01`.
  - `soffice --version` prints nothing in a console on Windows, so 26.8.3.1 was read from the exe's file version.
  - The user ran the `psql` Verify command with the `postgres` password, which the agent does not have. It printed `19.0`, `localhost` and `0.8.7`. The user created the `taskmaster` role, and the agent did not check its login.
- **Plan files changed:** None.
- **README:** No change needed: S02 is not done yet, so the status block stays as is, and the setup text still matches the machine.
- **Architecture impact:** None; matches § Installing the services.
- **Notes for later steps:**
  - Postgres data folder is `C:\Program Files\PostgreSQL\19\data`.
  - pgvector was built in `%TEMP%\pgvector`, which can be deleted.
  - `PG_ADMIN_URL` and the `taskmaster` password go in `.env` (S02 onward), never in a commit.
