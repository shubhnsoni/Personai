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
| `gates.manifest.json` | the declared inventory: every harness, its package, every skip with its reason, and the assertion-evidence allowlist |
| `lib/corroborate.js` | the source-side corroboration layer: parses each harness with the TypeScript compiler API and requires a positive runtime assertion count to be backed by an executable assertion callsite |
| `selftest.js` | proves the driver goes non-zero when it should |
| `fixtures/selftest/**` | deliberately broken fixture manifests and harnesses used by `selftest.js` |
| `fixtures/selftest/evidence/**` | one fixture harness per assertion-evidence defect (silent, zero, negative, forged, stale, duplicate, malformed) plus one per recognised evidence form |
| `fixtures/selftest/corroboration/**` | one fixture harness per corroboration case: assertions only in comments and strings, a loop, an alias/wrapper chain, an unfollowable indirection, and a harness that asserts but prints no count |
| `fixtures/audit-forgery/**` | the adversarial audit's three print-only liars — no imports, no comparisons, no subject under test — wired into `selftest.js` as the headline enforcement case |
| `artifacts/` | run output (gitignored — see `.gitignore` here) |

## Two independent signals, both required

A harness counts as passed only if BOTH hold:

1. **Runtime evidence.** It printed a positive assertion count the driver can read
   (`EVIDENCE_*` findings). Exit 0 alone cannot tell a harness that proved sixty
   invariants from one that asserted nothing.
2. **Source corroboration.** Its own source contains at least one *executable*
   assertion callsite (`CORROBORATION_*` findings), found by parsing the file with
   the TypeScript compiler API.

Signal 1 on its own measures a harness's willingness to print a number. Measured:
three harnesses with no imports, no comparisons and no subject under test printed
well-formed evidence and obtained `gate ESTABLISHED` with 104153 assertions
counted; and neutering the assertion helper inside
`check-vertical-pack-candidates.ts` dropped its reported count from 447 to 14
while it still exited 0.

Signal 2 uses a parser rather than a regex because the question is whether code
*runs*, and a regex cannot tell code from text about code — a commented-out
`assert(...)`, a string literal containing `check(...)`, and a
`console.log("58/58 assertions passed")` all match a pattern and none of them can
fail. `fixtures/selftest/corroboration/prose/check-prose.js` is made only of
those, and `selftest.js` asserts that a representative regex scores it positive
while the parser scores it zero.

The two counts are **not** required to match. A loop runs one callsite many times
and an untaken branch runs it zero times, so only the zero-versus-positive
contradiction is enforced.

Corroboration can be turned off only with
`GATES_SELFTEST_FAULT=disable-corroboration`, which stamps the run void. That is
the mutation switch `selftest.js` uses to prove the layer is load bearing; it is
deliberately not a manifest field, because a manifest field would be a permanent
bypass with a reasonable-looking name.

To see the static signal for the whole corpus without running the sweep (no
database, no harness executed):

```powershell
cd aiclone
node scripts/gates/lib/corroborate.js scripts/one-off
```

## Output

Each run writes `artifacts/run-<timestamp>/`:

- `summary.json` — machine-readable. Per harness: the exact argv, cwd, start and
  end timestamp, duration, the real exit code, and the assertion evidence it
  produced. Plus counts, verdict, integrity findings, the credential-scan result
  and an `evidence` block carrying the run's assertion total, which evidence form
  each harness used, and the allowlist in full.
- `summary.md` — the same thing for a human, including the full per-harness
  inventory table, every declared skip with its reason, and the allowlist table.
- `logs/<harness>.log` — that harness's complete output, redacted.
- `evidence/` — any evidence sidecars harnesses wrote for this run.

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

## Green means assertions actually ran

Exiting 0 is not evidence. A harness that silently asserts nothing exits 0 in
exactly the same way as one that proves sixty invariants, so for as long as
"passed" meant "exit code 0", the headline **74 checks, FAILED 0** rested on 74
exit codes and nothing else.

**The contract.** Every harness the driver counts as passed must yield
machine-readable evidence carrying a harness **identity** and a **positive**
assertion count. Anything else is a failure with its own named finding:

| finding | what it caught |
|---|---|
| `EVIDENCE_MISSING` | exited 0, logged output, asserted nothing, and is not allowlisted |
| `EVIDENCE_MALFORMED` | evidence shaped right but unreadable — `assertions=undefined`, unparseable sidecar, `9/6` |
| `EVIDENCE_ZERO_ASSERTIONS` | `0/0 assertions passed` — an empty check wearing the shape of a pass |
| `EVIDENCE_NEGATIVE_ASSERTIONS` | a negative count, so the harness's own bookkeeping is broken |
| `EVIDENCE_CLAIMS_FAILURES` | `4/6 assertions passed` **and** exit 0 — a missing `process.exitCode` |
| `EVIDENCE_DUPLICATE_ID` | two harnesses claimed one identity, so one proof is filed under the wrong name |
| `EVIDENCE_IDENTITY_MISMATCH` | the evidence names a different harness: borrowed or copy-pasted proof |
| `EVIDENCE_STALE` | a sidecar carrying another run's id, or written before the harness started |
| `EVIDENCE_ORPHAN_SIDECAR` | an evidence file for a harness this run never executed |
| `EVIDENCE_ALLOWLIST_ENTRY_MISSING_ON_DISK` | an exemption for a file that no longer exists |
| `EVIDENCE_ALLOWLIST_ENTRY_INVALID` | an exemption with no reason or no `temporary`/`migrationPending` marker |
| `EVIDENCE_ALLOWLIST_PATTERN_FORBIDDEN` | an exemption written as a glob or regex instead of an exact filename |
| `EVIDENCE_ALLOWLIST_SIZE_DRIFT` | the allowlist's real length disagrees with the size the manifest declares |

**No harness was edited to make this work.** Most harnesses already print their
evidence, and the driver reads what is there:

| form | example line |
|---|---|
| `ratio-passed` | `58/58 assertions passed`, `39/39 invariants passed`, `46/46 installation route assertions passed` |
| `count-passed` | `3 assertions passed`, `1 assertion passed` |
| `summary-passed-failed` | `SUMMARY mode=normal passed=41 failed=0` |
| `json-report-count` | a `JSON.stringify(report, null, 2)` block carrying `"assertions": 41` (or `assertionCount`, `assertionsPassed`, `invariants`, `checks`) |
| `json-report-list` | the same block carrying `"assertions": [ "…", "…" ]` — the list length is the count |
| `gate-evidence-line` | `GATE-EVIDENCE harness=check-foo.ts assertions=58` — the only form that carries identity, so the only one forgery can be detected in |
| `sidecar-json` | `<evidenceDir>/<harness>.evidence.json` = `{ schema, runId, harness, assertions }` |

The sidecar channel is forward-looking: the driver hands every harness
`GATES_RUN_ID`, `GATES_EVIDENCE_DIR` and `GATES_HARNESS_ID`, and a harness that
writes a sidecar gets the strongest form of evidence — identity and count both
declared, and staleness detectable against the per-run nonce. No harness writes
one yet. A stale or mismatched sidecar is **fatal even when the log evidence is
perfect**, because silently preferring the evidence you like is how forged proof
gets absorbed into a green result.

**61 of the 74 executed harnesses are enforced. 13 are not, and they are named.**
The 13 genuinely emit no count — a JSON report with no count key, or a bare
`copilot runtime contract checks passed` — so each is listed in
`gates.manifest.json` under `evidence.allowlist` by **exact filename**, with a
concrete reason, a `temporary: true` marker and a `migrationPending` note saying
what has to change for the entry to go away. The driver refuses patterns, refuses
entries whose file is absent, refuses unreasoned entries, and refuses to run
unless `evidence.allowlistDeclaredSize` matches the list's real length — so an
exemption cannot be added without a visible, reviewable edit. Every run prints
the list's size **and its full contents** to the console and into both summaries.

That number is the honest measure of what this gate does not check. It should go
down, never up.

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

Fifty-three cases, each running the real driver against a deliberately broken
fixture and asserting both the real process exit code and the finding kind: a
red harness, a zero-byte result, a missing file, a duplicated harness, an
undeclared skip, a dropped or duplicated result record, a leaked connection
string, a filtered red suite, and the live-database refusal. Eighteen of them
cover the assertion-evidence contract, one per rejection reason plus one that
asserts the parser against the exact lines the real `check-*.ts` harnesses print
and one that asserts the summary's existing field names are untouched. Two cases
reconcile throwaway copies of the *real* manifest against the *real* harness
tree, so the production path is covered without mutating a tracked file. Nothing
here touches a database and all output goes to the OS temp directory.

| flag / env | effect |
|---|---|
| `GATES_SELFTEST_FAULT` | the driver corrupts its own bookkeeping on purpose so the guards that cannot be tripped from outside can still be proven to fire. Any run with a fault injected is stamped void and cannot establish the gate. |
| `GATES_EVIDENCE_DIR` | where evidence sidecars are read from and written to (default `<out-dir>/run-<stamp>/evidence`). The self-test points it at a temp directory holding a leftover evidence file to prove `EVIDENCE_ORPHAN_SIDECAR` fires. |
