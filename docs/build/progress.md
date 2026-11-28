# Build progress

What each finished step actually built, so an agent starting the next step knows the state of the code without reading all of it. Read this before starting any step.

The agent that finishes a step adds that step's entry at the bottom, in the same commit as the code.

## How to write an entry

- Keep each entry under 20 lines. Link to files; don't paste code.
- Record facts a later step needs: names, entry points, commands, versions the lockfile resolved, and anything surprising.
- **Deviations** are anything that differs from the step file: a different file name, an API that didn't behave as the plan assumed, an extra helper. Say why for each one. If there were none, write "None".
- **Plan files changed** lists every edit to `contracts.md`, a later step file, `allowed-dependencies.json` or `check-architecture.mjs` made in this step, each agreed with the user. If there were none, write "None".
- **Architecture impact** is required. Either name the architecture sections you checked this step's work against and confirm it matches them, or name the `ARCH:` commit the user agreed to. An entry without it is incomplete, and so is the step.

Template:

```markdown
### S<NN> · <title> (<YYYY-MM-DD>)

- **Built:** what now exists and works, in one to three lines.
- **Key files:** [path](../../path), [path](../../path)
- **Commands:** new or changed commands, if any.
- **Deviations:** None. | What differs from the step file, and why.
- **Plan files changed:** None. | `contracts.md` § Fastify REST API: what changed. `S12`: what changed.
- **Architecture impact:** None; matches § OCR service, § Local-only access. | Agreed change in commit `ARCH: <summary>`.
- **Notes for later steps:** what the next steps should know, if anything.
```

## Entries

None yet.
