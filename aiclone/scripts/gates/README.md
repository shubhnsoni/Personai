# Gate sweep

The sweep is this repository's primary gate: every `scripts/one-off/check-*.ts`
harness, run against a disposable database, with a single reasoned exclusion.

```powershell
cd aiclone
node scripts/gates/run-gates.js
```

That is the whole command. It needs no argument, no environment variable and no
file outside this repository beyond `aiclone/.env` (or an exported
`DATABASE_URL`). It resolves the app directory from its own location, so it
behaves identically in any clone or worktree and always tests the checkout it is
part of.

## Why this exists

For weeks the headline figure "74 checks, FAILED 0" came from a PowerShell script
in a per-user `%TEMP%` directory, hardwired to one developer's absolute paths and
calling a second temp file to rewrite the database name. No reader of this
repository could reproduce the number, the single skipped harness was an
unexplained entry in a `$skip` array, and deleting either temp file would have
destroyed the project's primary gate. This directory replaces that pair.

## Files

| Path | Role |
|---|---|
| `run-gates.js` | the driver |
| `gates.manifest.json` | the declared inventory: every harness, its package, and every skip with its reason |
| `selftest.js` | proves the driver goes non-zero when it should |
| `fixtures/selftest/**` | deliberately broken fixture manifests and harnesses used by `selftest.js` |
| `artifacts/` | run output (gitignored — see `.gitignore` here) |

## Output

Each run writes `artifacts/run-<timestamp>/`:

- `summary.json` — machine-readable. Per harness: the exact argv, cwd, start and
  end timestamp, duration, and the real exit code. Plus counts, verdict,
  integrity findings and the credential-scan result.
- `summary.md` — the same thing for a human, including the full per-harness
  inventory table and every declared skip with its reason.
- `logs/<harness>.log` — that harness's complete output, redacted.

`artifacts/latest.json` and `artifacts/latest.md` are copies of the most recent
run, for scripts and links that want a stable path.

## Exit codes

| code | meaning |
|---|---|
| 0 | green full sweep, a clean `--list`/`--integrity-only`, or an explicitly accepted partial run |
| 1 | at least one executed harness failed or timed out |
| 2 | the inventory, database-safety or credential layer failed — **the result is void, not merely red** |
| 3 | a filter was applied and `--accept-partial` was not passed |

## The manifest is the answer to "why is this not run?"

Every harness on disk has an entry. Every entry has a file on disk. The driver
exits 2 rather than quietly producing a smaller or larger sweep when:

- a manifest entry has no file on disk (`MANIFEST_ENTRY_MISSING_ON_DISK`);
- a harness on disk has no manifest entry (`ON_DISK_NOT_IN_MANIFEST`);
- the same harness is listed twice, or two harnesses are byte-identical
  (`DUPLICATE_HARNESS_CONTENT`);
- an entry has `run: false` without a `skip` block carrying `reason`,
  `requires`, `howToRunManually` and `declaredBy`;
- a selected harness produced no result, a duplicate result, or a **zero-byte
  log** — a harness that emits nothing cannot be shown to have asserted
  anything, so its exit 0 is not evidence;
- the executed count drifts from `expected.executedChecks`. Investigate the
  drift; do not edit the expectation to make a run agree with it.

There is currently exactly one skip, `check-order-stream.ts`, and its reason,
its precondition and the command to run it by hand are all in the manifest.

## Focused runs cannot establish the gate

```powershell
node scripts/gates/run-gates.js --package=fieldjob
node scripts/gates/run-gates.js --filter=schema-invariants
node scripts/gates/run-gates.js --filter=/^check-appointment-/
```

A filter narrows what runs, so such a run exits **3**, is stamped
`"partial": true` and `"gateEstablished": false`, and its Markdown summary opens
with a `PARTIAL RUN` line naming how many of the runnable harnesses it selected.
`--accept-partial` relaxes the exit code to 0 for local convenience; it does not
change the stamping. Filtering the failing harness out of a red suite still
refuses to report success — `selftest.js` asserts exactly that.

## Database safety

DB-backed harnesses run only against a disposable rehearsal database. The driver
takes `DATABASE_URL`, rewrites the database name, then asserts the result:
the live `personalink` database is refused outright, and a target whose name does
not look disposable is refused unless `GATES_ALLOW_UNRECOGNISED_DATABASE=1` is
set deliberately. Both refusals happen before any harness is spawned.

No credential, DSN, host, user or password is written anywhere. Only the bare
database **name** appears in a summary. Harness output is redacted on its way to
the log file, and after the run the driver re-reads every artefact it wrote —
including on the failure path — and fails the run if anything credential-shaped
survived.

## Harnesses run serially

Deliberately. `check-due-work-preview-api.ts` proves "a preview request writes
nothing" by taking global row counts across 18 tables before and after. Any
harness seeding rows in parallel would make that assertion go red for a reason
unrelated to the code under test. There is no concurrency flag.

Each harness gets a bounded timeout (15 minutes by default,
`--timeout-ms=` to change). On timeout the child **process tree** is killed —
`taskkill /T /F` on Windows, the process group elsewhere — because the harness
runs three processes deep and an orphaned one keeps a database connection open
and poisons whatever runs next.

## Other flags

| flag | effect |
|---|---|
| `--list` | print the declared inventory and exit; runs nothing |
| `--integrity-only` | reconcile the manifest against disk and exit; runs nothing (seconds) |
| `--timeout-ms=<n>` | override the per-harness timeout |
| `--manifest=<path>` | use an alternate manifest, relative to `aiclone/` |
| `--out-dir=<path>` | write artefacts elsewhere |
| `--help` | usage |

## Proving the gate can fail

```powershell
cd aiclone
node scripts/gates/selftest.js
```

Nineteen cases, each running the real driver against a deliberately broken
fixture and asserting both the real process exit code and the finding kind: a
red harness, a zero-byte result, a missing file, a duplicated harness, an
undeclared skip, a dropped or duplicated result record, a leaked connection
string, a filtered red suite, and the live-database refusal. Two cases reconcile
throwaway copies of the *real* manifest against the *real* harness tree, so the
production path is covered without mutating a tracked file. Nothing here touches
a database and all output goes to the OS temp directory.

`GATES_SELFTEST_FAULT` lets the driver corrupt its own bookkeeping on purpose so
the guards that cannot be tripped from outside can still be proven to fire. Any
run with a fault injected is stamped void and cannot establish the gate.
