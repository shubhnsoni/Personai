#!/usr/bin/env node
"use strict";

/**
 * selftest.js — proves the gate driver fails when it should.
 *
 * A gate that cannot go red is decoration. This runs run-gates.js against
 * deliberately broken fixture manifests and asserts the REAL process exit code
 * and the finding kind for each defect. It also runs two reconciliation cases
 * against the real check-*.ts inventory using throwaway copies of the real
 * manifest in the OS temp directory, so the production reconciliation path is
 * exercised without mutating a single tracked file.
 *
 *   cd aiclone
 *   node scripts/gates/selftest.js
 *
 * Exit code 0 means every guard behaved as declared. Nothing here touches a
 * database (fixture harnesses are plain node) and nothing writes into the
 * repository: artefacts go to the OS temp directory.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const GATES_DIR = __dirname;
const APP_DIR = path.resolve(GATES_DIR, "..", "..");
const DRIVER = path.join(GATES_DIR, "run-gates.js");
const REAL_MANIFEST = path.join(GATES_DIR, "gates.manifest.json");
const FIXTURE_MANIFESTS = path.join(GATES_DIR, "fixtures", "selftest", "manifests");
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "personai-gates-selftest-"));

function runDriver(args, env = {}) {
  const outDir = fs.mkdtempSync(path.join(TMP_ROOT, "out-"));
  const result = spawnSync(process.execPath, [DRIVER, ...args, `--out-dir=${outDir}`], {
    cwd: APP_DIR,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  let summary = null;
  try {
    summary = JSON.parse(fs.readFileSync(path.join(outDir, "latest.json"), "utf8"));
  } catch {
    /* a manifest rejected before any summary is written has none */
  }
  return {
    exitCode: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    summary,
    outDir,
  };
}

/** Copy the real manifest, apply a mutation, write it to temp, return the path. */
function realManifestVariant(name, mutate) {
  const parsed = JSON.parse(fs.readFileSync(REAL_MANIFEST, "utf8"));
  mutate(parsed);
  const target = path.join(TMP_ROOT, `real-${name}.json`);
  fs.writeFileSync(target, JSON.stringify(parsed, null, 2), "utf8");
  return target;
}

const fixture = (name) =>
  `--manifest=${path.relative(APP_DIR, path.join(FIXTURE_MANIFESTS, name)).split(path.sep).join("/")}`;

const CASES = [
  {
    name: "baseline-green",
    why: "a clean fully-declared fixture sweep is green and establishes its gate",
    args: [fixture("baseline.json")],
    expectExit: 0,
    assert: (r) =>
      r.summary &&
      r.summary.verdict === "PASS" &&
      r.summary.gateEstablished === true &&
      r.summary.counts.executed === 2 &&
      r.summary.counts.failed === 0 &&
      r.summary.counts.declaredSkips === 3,
  },
  {
    name: "harness-forced-red",
    why: "a red harness makes the run red and its REAL exit code is recorded",
    args: [fixture("red.json")],
    expectExit: 1,
    assert: (r) => {
      const red = r.summary && r.summary.harnesses.find((h) => h.file === "check-red.js");
      return (
        r.summary.verdict === "FAIL" &&
        r.summary.gateEstablished === false &&
        r.summary.counts.failed === 1 &&
        red &&
        red.exitCode === 1 &&
        red.rawExitCode === 1
      );
    },
  },
  {
    name: "result-zero-byte",
    why: "a harness that exits 0 while emitting nothing is not evidence",
    args: [fixture("zero-byte.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "RESULT_LOG_ZERO_BYTE"),
  },
  {
    name: "manifest-entry-missing-on-disk",
    why: "a declared harness with no file on disk fails instead of shrinking the sweep",
    args: [fixture("missing-on-disk.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "MANIFEST_ENTRY_MISSING_ON_DISK"),
  },
  {
    name: "duplicate-harness-content",
    why: "two byte-identical harnesses are a duplicate, not two checks",
    args: [fixture("duplicate-content.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "DUPLICATE_HARNESS_CONTENT"),
  },
  {
    name: "duplicate-manifest-entry",
    why: "the same harness listed twice is rejected, not run twice",
    args: [fixture("duplicate-entry.json")],
    expectExit: 2,
    assert: (r) => /DUPLICATE manifest entry/.test(r.stderr),
  },
  {
    // Q3-C found that only expected.executedChecks was ever read, so a harness could be ADDED to the
    // tree with a run:false entry and never run while the gate still reported success. Both remaining
    // expectations are asserted now, and these two cases are why that is a guard rather than a claim:
    // the fixture manifests did not declare harnessesOnDisk, so root's first version of the check threw
    // a ReferenceError on the real manifest while the self-test stayed green at 19/19.
    name: "expected-on-disk-drift",
    why: "a harness added to the tree but declared run:false no longer passes silently",
    args: [fixture("expected-on-disk-drift.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "ON_DISK_COUNT_DRIFT"),
  },
  {
    name: "expected-declared-skips-drift",
    why: "a newly declared skip must be a reviewed decision, not an absorbed one",
    args: [fixture("expected-declared-skips-drift.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "DECLARED_SKIP_COUNT_DRIFT"),
  },
  {
    name: "undeclared-skip",
    why: "run:false without a reason is exactly the old buried $skip array and is rejected",
    args: [fixture("undeclared-skip.json")],
    expectExit: 2,
    assert: (r) => /skip must be declared and reasoned/.test(r.stderr),
  },
  {
    name: "result-missing",
    why: "a selected harness that produces no result record is caught",
    args: [fixture("baseline.json")],
    env: { GATES_SELFTEST_FAULT: "drop-result" },
    expectExit: 2,
    assert: (r) => hasFinding(r, "RESULT_MISSING"),
  },
  {
    name: "result-duplicated",
    why: "a duplicated result record is caught before it inflates the count",
    args: [fixture("baseline.json")],
    env: { GATES_SELFTEST_FAULT: "duplicate-result" },
    expectExit: 2,
    assert: (r) => hasFinding(r, "DUPLICATE_RESULT"),
  },
  {
    name: "credential-leak-assertion",
    why: "a connection string reaching driver output fails the run",
    args: [fixture("baseline.json")],
    env: { GATES_SELFTEST_FAULT: "leak" },
    expectExit: 2,
    assert: (r) => hasFinding(r, "CREDENTIAL_LEAK") && r.summary.secretScan.passed === false,
  },
  {
    name: "harness-output-is-redacted",
    why: "a harness that prints a DSN with a password has it redacted before the log is written",
    args: [fixture("redaction.json")],
    expectExit: 0,
    assert: (r) => {
      const rec = r.summary && r.summary.harnesses.find((h) => h.file === "check-leaky.js");
      if (!rec || rec.exitCode !== 0) return false;
      const log = fs.readFileSync(rec.logPath, "utf8");
      return log.includes("<redacted>") && !log.includes("hunter2");
    },
  },
  {
    name: "filter-marks-run-partial",
    why: "a filtered run is stamped partial and cannot establish the gate",
    args: [fixture("baseline.json"), "--filter=alpha"],
    expectExit: 3,
    assert: (r) =>
      r.summary.verdict === "PARTIAL-PASS" &&
      r.summary.partial === true &&
      r.summary.gateEstablished === false &&
      r.summary.counts.executed === 1 &&
      r.summary.counts.runnable === 2,
  },
  {
    name: "filter-cannot-turn-red-green",
    why: "filtering the red harness out of a red suite still refuses to report success",
    args: [fixture("red.json"), "--filter=alpha"],
    expectExit: 3,
    assert: (r) => r.summary.gateEstablished === false && r.summary.partial === true,
  },
  {
    name: "accepted-partial-stays-partial",
    why: "--accept-partial relaxes the exit code but never claims the gate",
    args: [fixture("baseline.json"), "--filter=alpha", "--accept-partial"],
    expectExit: 0,
    assert: (r) => r.summary.partial === true && r.summary.gateEstablished === false,
  },
  {
    name: "live-database-refused",
    why: "the live database is refused before any harness is spawned",
    args: [fixture("baseline.json")],
    env: { GATES_DATABASE_NAME: "personalink" },
    expectExit: 2,
    assert: (r) => hasFinding(r, "DATABASE_TARGET_REFUSED") && r.summary.counts.executed === 0,
  },
  {
    name: "unrecognised-database-refused",
    why: "a target that does not look disposable is refused unless explicitly overridden",
    args: [fixture("baseline.json")],
    env: { GATES_DATABASE_NAME: "some_production_looking_db" },
    expectExit: 2,
    assert: (r) => hasFinding(r, "DATABASE_TARGET_REFUSED"),
  },
  {
    name: "real-inventory-missing-entry",
    why: "against the REAL manifest, a fabricated entry with no file on disk fails reconciliation",
    lazyArgs: () => [
      `--manifest=${realManifestVariant("ghost", (m) => {
        m.harnesses.push({ file: "check-this-harness-does-not-exist.ts", package: "fixture", run: true });
      })}`,
      "--integrity-only",
    ],
    expectExit: 2,
    assert: (r) => hasFinding(r, "MANIFEST_ENTRY_MISSING_ON_DISK"),
  },
  {
    name: "real-inventory-unmanifested-harness",
    why: "against the REAL tree, a harness on disk with no manifest entry fails reconciliation",
    lazyArgs: () => [
      `--manifest=${realManifestVariant("dropped", (m) => {
        m.harnesses = m.harnesses.filter((h) => h.file !== "check-tenant-isolation.ts");
      })}`,
      "--integrity-only",
    ],
    expectExit: 2,
    assert: (r) => hasFinding(r, "ON_DISK_NOT_IN_MANIFEST"),
  },
  {
    name: "real-inventory-clean",
    why: "the committed manifest reconciles exactly against the working tree",
    args: ["--integrity-only"],
    expectExit: 0,
    assert: (r) =>
      r.summary.verdict === "INTEGRITY-OK" &&
      r.summary.integrityFindings.length === 0 &&
      r.summary.counts.onDisk === r.summary.counts.manifestEntries &&
      r.summary.counts.declaredSkips === 1 &&
      r.summary.gateEstablished === false,
  },
];

function hasFinding(r, kind) {
  return Boolean(r.summary && r.summary.integrityFindings.some((f) => f.kind === kind));
}

function main() {
  const rows = [];
  let failures = 0;

  for (const c of CASES) {
    const args = c.lazyArgs ? c.lazyArgs() : c.args;
    const r = runDriver(args, c.env || {});
    const exitOk = r.exitCode === c.expectExit;
    let assertOk = false;
    let assertError = null;
    try {
      assertOk = Boolean(c.assert(r));
    } catch (error) {
      assertError = error.message;
    }
    const ok = exitOk && assertOk;
    if (!ok) failures += 1;
    rows.push({ name: c.name, why: c.why, expected: c.expectExit, actual: r.exitCode, exitOk, assertOk, assertError, ok });
    process.stdout.write(
      `${ok ? "ok  " : "FAIL"} ${c.name.padEnd(36)} expected exit ${c.expectExit}, got ${String(r.exitCode).padEnd(4)} ` +
        `assert ${assertOk ? "ok" : "FAILED"}${assertError ? ` (${assertError})` : ""}\n`,
    );
    if (!ok) {
      process.stdout.write(`     why: ${c.why}\n`);
      if (r.summary) {
        process.stdout.write(`     verdict ${r.summary.verdict}, findings: ${r.summary.integrityFindings.map((f) => f.kind).join(", ") || "none"}\n`);
      }
      process.stdout.write(`     stderr: ${r.stderr.split(/\r?\n/).slice(0, 4).join(" | ").slice(0, 300)}\n`);
    }
  }

  process.stdout.write(`\n${rows.length - failures}/${rows.length} guards behaved as declared\n`);
  process.stdout.write(`artefacts: ${TMP_ROOT} (outside the repository)\n`);
  return failures === 0 ? 0 : 1;
}

process.exit(main());
