# AGENTS.md

TaskMaster v0 is built in 25 numbered steps. This file says how a coding agent works through them, one step per session. [CLAUDE.md](CLAUDE.md) imports it.

## Where things are

| Path | What it is |
| --- | --- |
| [README.md](README.md) | The front page for anyone new to the repository. Every step keeps it true: see [Keeping README.md current](#keeping-readmemd-current). |
| [docs/architecture.md](docs/architecture.md) | The final design. Read-only. |
| [docs/build/README.md](docs/build/README.md) | Rules for every step, the step index, and choices the architecture leaves open (G1 to G15) |
| [docs/build/contracts.md](docs/build/contracts.md) | Ports, environment variables, APIs, job payloads, run events, run status changes |
| [docs/build/steps/](docs/build/steps/) | One file per step. Each starts with a `status:` field. |
| [docs/build/progress.md](docs/build/progress.md) | What each finished step built, and how it differed from its plan |
| [docs/build/allowed-dependencies.json](docs/build/allowed-dependencies.json) | Every dependency each manifest may declare |
| `scripts/check-architecture.mjs` (from S02 on) | `yarn check:arch`: automatic checks that the code still matches the architecture |

## Read only what the step needs

To keep context small, read only these, in this order:

1. This file.
2. [docs/build/README.md](docs/build/README.md). The root `README.md` is read only at step 7 below, when you update it.
3. [docs/build/progress.md](docs/build/progress.md).
4. The current step file.
5. The sections of `contracts.md` or `architecture.md` that the step's **Read before starting** line links to.
6. Existing code only where the step edits it, or where `progress.md` points to it.

Do not read other step files, the rest of the architecture, or the whole codebase. If you need something that isn't in those six places, the plan has a gap: see [When the plan doesn't fit](#when-the-plan-doesnt-fit).

## Working on a step

1. **Find the step.** Run `git grep -n "^status:" -- docs/build/steps`.
   - If any step is `blocked`, stop. Tell the user which step it is, and what its **Blocked** section says.
   - Otherwise, resume the first `in-progress` step. Compare what exists against its **Creates** list and `git status` to see where the last session stopped.
   - Otherwise, start the first `not-started` step.
   - If the user names a step, work on it only if every earlier step is `done`.
2. **Check the starting point.** `git status` must show no changes except this step's own partial work. If it shows anything else, stop and ask the user.
3. **Read** the files listed above.
4. **Mark it started.** In the step file, set `status: in-progress` and `started: <YYYY-MM-DD>`.
5. **Build exactly what the step says**, following every rule in the build README.
6. **Verify.** Run every command in the step's **Verify** section, then `yarn check:arch` (from S02 on), and report the real output.
   - If one fails, fix the code and run all of them again.
   - If `yarn check:arch` fails, change the code so it meets the architecture. Never reword code just to slip past a rule's pattern. If meeting the rule is impossible, that is an architecture change: see below.
   - If you can't make them pass, block the step (see below).
7. **Update the README and record the step.**
   - Update [README.md](README.md) as [Keeping README.md current](#keeping-readmemd-current) describes, then run `yarn check:arch` again (from S02 on).
   - Add the step's entry to the bottom of `progress.md`, using its template.
8. **Mark it done and commit.**
   - Set `status: done` and `completed: <YYYY-MM-DD>`.
   - Commit everything in one commit, with the message `S<NN>: <step title>` (without backticks).
   - Do not push.
9. **Stop and report:** what was built, the Verify results, and any deviations. Do not start the next step unless the user asks you to continue.

S01 is installation work that needs administrator rights, and the user does it. An agent may run S01's Verify commands and, if they all pass, mark it done.

## Architecture changes

An architecture change is anything that makes the code differ from [docs/architecture.md](docs/architecture.md). It includes changing, adding or removing:

- a component, process, port or data store
- a technology, library, model or version choice, including any dependency not in `allowed-dependencies.json`
- how data moves between services, or where it is stored
- a security control: binding, Host checks, tokens, CORS, approvals, path checks, output rendering
- what a tool may do, or what needs approval
- what leaves the laptop
- any behavior the architecture describes, such as OCR for every format except `.txt` and `.md`, extraction at ingest, 2 OCR workers with 4 threads each, the limits and timeouts, and how runs, jobs and events work

**If you are unsure whether something is an architecture change, treat it as one.** It is never a small detail, and never just a deviation.

When a step seems to need one:

1. **Stop before writing that code.** Set `status: blocked`, and write the proposal in the step's **Blocked** section.
2. **Tell the user:**
   - what the architecture says now, quoting the section
   - what you propose instead
   - why the step can't be built as written
   - what else it affects: contracts, later steps, security, memory, and `check:arch` rules
3. **If the user agrees:**
   1. Edit `docs/architecture.md`: the change itself, the revision number in its Status line, and a one-line note of what changed. Update every section the change touches.
   2. Commit only that file, as `ARCH: <summary>`. `yarn check:arch` rule A8 fails if anything outside `docs/` is changed at the same time.
   3. Update the affected plan files (`contracts.md`, step files, `allowed-dependencies.json`, `check-architecture.mjs`) as part of the step's work, and list them under **Plan files changed**. Update `README.md` in the step commit as well, never in the `ARCH:` commit.
   4. Set the step back to `in-progress`, and build.
4. **If the user declines,** build the step as written. If that is impossible, leave it `blocked`.

The user reviews every changed file, including `architecture.md`, before the work goes anywhere.

## Keeping README.md current

[README.md](README.md) is the front page of the repository. After every step, it must describe the repository as it actually is.

### When to change it

In every step, compare the README with what the step built. Update it in the step's own commit when the step:

- makes a planned command, feature or setup instruction work, or changes how one works
- adds or changes a command, a group of environment variables, a port, a requirement, or a folder in the repository layout
- changes a number the README quotes, such as a version, an OCR timing or a memory figure
- follows an agreed architecture change

If none of these apply, the progress entry says `README: no change needed`, with the reason.

### The status block

The block at the top of the README changes with the build:

| When | The block's first line reads exactly |
| --- | --- |
| Until S02 is done | `> **Status: designed, not built yet.**` (as it is now) |
| From S02 to S24 | `> **Status: being built. Steps S01 to S<NN> of 25 are done.**` |
| After S25 | `> **Status: v0 is built and accepted with <LLM_MODEL>.**` |

Keep the `git grep` status command below that line until S25 is done.

### Planned and working

- From S02 on, anything in the README that doesn't work yet (a command, a feature or a setup instruction) is marked *(planned, S<NN>)*, naming the step that builds it. Take the step from the index in [docs/build/README.md](docs/build/README.md).
- The step that builds it removes the mark, and only for what its own Verify commands exercised.
- Never describe something as working that this step hasn't run.

### How the README should look

- **Audience.** Someone new to the repository. Answer, in this order: what TaskMaster is, how it works, how to install it, how to run and use it, and where to read more.
- **Sections.** Keep the existing sections in their order. Add or remove a `##` section only with the user's agreement. The **Contents** list must match the `##` headings exactly.
- **Headings.** One `#` title; `##` for sections; `###` only when a section really needs subsections. Use sentence-case headings, with no emoji, and no badges for things that don't exist.
- **Summarize and link; don't copy.** Details live in `architecture.md`, `contracts.md` and the step files. Don't list every environment variable, route or schema column.
- **Commands** go in `text` code blocks, one per line, ready to paste into Windows PowerShell from the repository root.
- **Format.** Use tables for reference facts such as versions, ports and commands, and short paragraphs or lists for explanation. Write short sentences in plain words.
- **Numbers** say whether they are measured or estimated.
- **Links** are relative, and every link and `#anchor` must resolve.
- **Length.** Keep it under 450 lines.
- **Never put in it:** build history or deviations (those go in `progress.md`), secrets, real passwords, personal names or email addresses, paths other than the documented `C:\taskmaster-data` folders, dates except for measurements, or claims about features that don't exist.

`yarn check:arch` rule A9 checks the links, the Contents list, the single title and the length. Everything else on this list is up to you.

## When the plan doesn't fit

- **The step is ambiguous, contradicts itself or another file, or won't work as written.** Stop and ask the user, with a concrete proposed edit. Once they agree:
  1. Edit the step file, and `contracts.md` if needed.
  2. List the edit under **Plan files changed** in the progress entry.
  3. Then build.
- **A small detail the step doesn't cover**, such as a private helper's name. If it changes no contract, no other step, and nothing in the architecture (see [Architecture changes](#architecture-changes)), choose the simplest option and record it under **Deviations**.
- **Something outside your control is missing or broken**, such as an installation, administrator rights, or a service that won't start.
  1. Set `status: blocked`.
  2. Fill in the step's **Blocked** section: what failed, the exact error, and what the user needs to do or decide.
  3. Stop.
- **A `done` step's Verify fails later.** Stop and tell the user. Do not change the earlier step's status or code without their agreement.

## Never

- Edit [docs/architecture.md](docs/architecture.md), except for an architecture change the user agreed to, committed alone as `ARCH: <summary>`.
- Change `contracts.md`, another step's file, `allowed-dependencies.json` or `check-architecture.mjs` without the user's agreement.
- Get past a `check:arch` rule by rewording or hiding code, instead of meeting it.
- Finish a step with `README.md` describing something that is no longer true.
- Mark a step `done` unless every Verify command passed in the current session.
- Weaken, skip or delete a test to make Verify pass.
- Call a real model or the internet from a test.
- Add a dependency the step doesn't name.
- Commit `.env`, passwords or tokens.
- Push, amend or rewrite commits.
- Put two steps in one commit.

## Environment

- **Shells.** The machine runs Windows 11. PowerShell 5.1 is the default shell, and Verify commands are written for it. Git Bash is also available.
- **Python.** Run Python through `node scripts/py.mjs <agent|ocr> <args>` once S02 has created it, and with `py -3.14` before that.
- **Node** 26 runs TypeScript directly, so the API has no build step.
- **Memory is tight**, often 1.5 to 4 GB free. Run at most one `yarn dev` at a time, and stop it when a step's Verify is finished.
