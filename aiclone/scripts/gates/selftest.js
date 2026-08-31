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

const SCANNER = require("./lib/redact");

const GATES_DIR = __dirname;
const APP_DIR = path.resolve(GATES_DIR, "..", "..");
const DRIVER = path.join(GATES_DIR, "run-gates.js");
const REAL_MANIFEST = path.join(GATES_DIR, "gates.manifest.json");
const FIXTURE_MANIFESTS = path.join(GATES_DIR, "fixtures", "selftest", "manifests");
const SCANNER_FIXTURES = path.join(GATES_DIR, "fixtures", "scanner-secrets");
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

// ---------------------------------------------------------------------------
// Credential-scanner cases (appended; nothing above is renumbered).
//
// These assert on what the scanner RETURNS — which finding kind fired, what the
// redacted sample contains, that the iteration terminates — and no driver
// invocation can show any of that: summary.secretScan reports only counts, and
// every artefact the driver writes has already been redacted before it is
// scanned. So they run in-process through `probe` instead of spawning
// run-gates.js. The last case in the group DOES spawn the driver, and proves the
// new shapes are wired into the real write path rather than merely callable.
// ---------------------------------------------------------------------------

const scannerManifest = (name) =>
  `--manifest=${path.relative(APP_DIR, path.join(SCANNER_FIXTURES, name)).split(path.sep).join("/")}`;

const readScannerFixture = (name) => fs.readFileSync(path.join(SCANNER_FIXTURES, name), "utf8");

/** Every fabricated secret value that appears in scanner-leaky-output.txt. */
const FIXTURE_SECRET_MATERIAL = [
  "4f8FIXTUREb7Lm9Kd3Tz6",
  "9Zx1FIXTUREb5Kq7Ws2Ed",
  "whsec_7Hj9FIXTUREn3Op5Qr7St",
  "re_9Fk2FIXTUREp6Qr8St0Uv",
  "Zq9-fixture-pw",
  "pw%40rd-fixture",
  "hunter2",
  "svc_reader",
  "gateuser",
];

/** Sorted, deduped finding kinds for the one fixture line carrying `tag`. */
function kindsForTag(text, tag) {
  const line = text.split(/\r?\n/).find((l) => l.includes(tag));
  if (line === undefined) throw new Error(`no fixture line carries ${tag}`);
  return [...new Set(SCANNER.scanForLeaks(line).map((f) => f.pattern))].sort();
}

function sameKinds(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((k, i) => k === expected[i]);
}

/** Run an in-process scanner probe, shaped like runDriver's result. */
function runProbe(probe) {
  try {
    return { exitCode: 0, stdout: "", stderr: "", summary: null, probe: probe() };
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: `probe threw: ${error.message}`, summary: null, probe: null };
  }
}

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

  // ---- credential scanner: breadth -----------------------------------------
  {
    name: "scanner-clerk-key-assignment-forms",
    why: "CLERK_SECRET_KEY=sk_live_… is caught as KEY=v, KEY=\"v\", KEY='v', KEY = v, KEY:  v and export KEY=v",
    probe: () => {
      const text = readScannerFixture("scanner-leaky-output.txt");
      const tags = ["[form:plain]", "[form:quoted]", "[form:single]", "[form:spaced]", "[form:colon]", "[form:export]"];
      return tags.map((tag) => ({ tag, kinds: kindsForTag(text, tag) }));
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.length === 6 &&
      r.probe.every((row) => sameKinds(row.kinds, ["SECRET_ASSIGNMENT", "SECRET_KEY_SHAPE"])),
  },
  {
    name: "scanner-bare-sk-key-shape",
    why: "the sk_live_/sk_test_ shape is caught in prose too, with no assignment around it",
    probe: () => kindsForTag(readScannerFixture("scanner-leaky-output.txt"), "[key:bare]"),
    expectExit: 0,
    assert: (r) => sameKinds(r.probe, ["SECRET_KEY_SHAPE"]),
  },
  {
    name: "scanner-passwordless-dsn",
    why: "postgres://user@host:5432/db carries no password and is still a real account on a real server",
    probe: () => kindsForTag(readScannerFixture("scanner-leaky-output.txt"), "[dsn:userinfo-only]"),
    expectExit: 0,
    assert: (r) => sameKinds(r.probe, ["DSN_USERINFO_NO_PASSWORD"]),
  },
  {
    name: "scanner-percent-encoded-dsn",
    why: "an encoded ':' hides the password separator from a literal split; an encoded '@' hides the host",
    probe: () => {
      const text = readScannerFixture("scanner-leaky-output.txt");
      return {
        encodedColon: kindsForTag(text, "[dsn:encoded-colon]"),
        encodedAt: kindsForTag(text, "[dsn:encoded-at]"),
        plain: kindsForTag(text, "[dsn:plain-secret]"),
      };
    },
    expectExit: 0,
    assert: (r) =>
      sameKinds(r.probe.encodedColon, ["DSN_ENCODED_PASSWORD"]) &&
      sameKinds(r.probe.encodedAt, ["DSN_WITH_PASSWORD"]) &&
      sameKinds(r.probe.plain, ["DSN_WITH_PASSWORD"]),
  },
  {
    name: "scanner-password-keyword-forms",
    why: "the pre-existing password/pgpassword/pwd vocabulary still fires on all three separator forms",
    probe: () => {
      const text = readScannerFixture("scanner-leaky-output.txt");
      return ["[kv:env]", "[kv:spaced]", "[kv:colon]"].map((tag) => ({ tag, kinds: kindsForTag(text, tag) }));
    },
    expectExit: 0,
    assert: (r) => r.probe.length === 3 && r.probe.every((row) => sameKinds(row.kinds, ["PASSWORD_KV"])),
  },
  {
    name: "scanner-secret-named-assignments",
    why: "a key name carrying secret/token/api_key is enough, whatever vendor prefix the value has",
    probe: () => {
      const text = readScannerFixture("scanner-leaky-output.txt");
      return ["[kv:webhook]", "[kv:apikey]"].map((tag) => ({ tag, kinds: kindsForTag(text, tag) }));
    },
    expectExit: 0,
    assert: (r) => r.probe.length === 2 && r.probe.every((row) => sameKinds(row.kinds, ["SECRET_ASSIGNMENT"])),
  },
  {
    name: "scanner-env-secret-key-is-critical",
    why: "a Clerk key that is really in the environment is a critical leak, not a shape, and is still never quoted",
    probe: () => {
      // Assembled rather than written out: a committed file carrying a full
      // sk_live_-shaped literal is what trips vendor push protection.
      const key = `sk_${"live"}_7Lm9FIXTUREd3Tz6Rw1Yv`;
      const literals = SCANNER.collectSecretLiterals({ CLERK_SECRET_KEY: key });
      const findings = SCANNER.scanForLeaks(`[app] using CLERK_SECRET_KEY=${key}`, { secretLiterals: literals });
      return {
        collected: literals.length,
        kinds: [...new Set(findings.map((f) => f.pattern))].sort(),
        severities: [...new Set(findings.map((f) => f.severity))].sort(),
        quoted: JSON.stringify(findings).includes("7Lm9FIXTUREd3Tz6Rw1Yv"),
      };
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.collected === 1 &&
      r.probe.kinds.includes("SECRET_LITERAL") &&
      r.probe.severities.includes("critical") &&
      r.probe.quoted === false,
  },

  // ---- credential scanner: no value leakage, no false positives ------------
  {
    name: "scanner-never-emits-the-secret-value",
    why: "a finding that quotes the credential is worse than no finding, so no secret may appear anywhere in the output",
    probe: () => {
      const text = readScannerFixture("scanner-leaky-output.txt");
      const findings = SCANNER.scanForLeaks(text, { label: "leaky-fixture" });
      const serialised = JSON.stringify(findings);
      const redacted = SCANNER.redact(text, []);
      return {
        findingCount: findings.length,
        checked: FIXTURE_SECRET_MATERIAL.length,
        leaked: FIXTURE_SECRET_MATERIAL.filter((s) => serialised.includes(s) || redacted.includes(s)),
      };
    },
    expectExit: 0,
    assert: (r) => r.probe.findingCount === 22 && r.probe.checked === 9 && r.probe.leaked.length === 0,
  },
  {
    name: "scanner-safe-fixture-does-not-fire",
    why: "a doc placeholder, an example DSN whose password is the word password, a base64 blob, a comment about the scanner and publishable keys are not findings",
    probe: () => {
      const text = readScannerFixture("scanner-safe-output.txt");
      const redacted = SCANNER.redact(text, []);
      return {
        findings: SCANNER.scanForLeaks(text, { label: "safe-fixture" }).map((f) => `${f.pattern}@line${f.line}`),
        publishableKeySurvives: redacted.includes("pk_live_4f8FIXTUREb7Lm9Kd3Tz6"),
        base64Survives: redacted.includes("dGhpcyBpcyBub3QgYSBrZXksIGp1c3QgYmFzZTY0IHRleHQ="),
        digestSurvives: redacted.includes("9f2c1b7d4e6a8c0f2b4d6e8a0c2e4f6a8b0d2f4e6a8c0e2f4b6d8a0c2e4f6b8d"),
      };
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.findings.length === 0 &&
      r.probe.publishableKeySurvives === true &&
      r.probe.base64Survives === true &&
      r.probe.digestSurvives === true,
  },
  {
    name: "scanner-redaction-is-a-scan-fixed-point",
    why: "redacted text must be stable under redaction and silent under the scan, or a summary would report its own samples",
    probe: () =>
      ["scanner-leaky-output.txt", "scanner-safe-output.txt"].map((name) => {
        const once = SCANNER.redact(readScannerFixture(name), []);
        return {
          name,
          idempotent: once === SCANNER.redact(once, []),
          findingsAfterRedaction: SCANNER.scanForLeaks(once, {}).length,
        };
      }),
    expectExit: 0,
    assert: (r) =>
      r.probe.length === 2 && r.probe.every((row) => row.idempotent === true && row.findingsAfterRedaction === 0),
  },

  // ---- credential scanner: termination -------------------------------------
  {
    name: "scanner-patterns-cannot-match-empty",
    why: "the empty-match guard is live, which is what makes the historical spin impossible by construction instead of by a loop counter",
    probe: () => {
      const iterated = Object.entries(SCANNER.ITERATED_PATTERNS).map(([name, pattern]) => ({
        name,
        canMatchEmpty: SCANNER.patternCanMatchEmpty(pattern),
      }));
      const rejected = [];
      for (const bad of [/x*/g, /(?:)/g, /(?<=a)b?/g]) {
        try {
          SCANNER.assertPatternsCannotMatchEmpty({ bad });
        } catch {
          rejected.push(String(bad));
        }
      }
      return {
        iterated,
        rejected,
        realSetAccepted: SCANNER.assertPatternsCannotMatchEmpty(SCANNER.ITERATED_PATTERNS),
      };
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.iterated.length === 4 &&
      r.probe.iterated.every((p) => p.canMatchEmpty === false) &&
      r.probe.rejected.length === 3 &&
      r.probe.realSetAccepted === true,
  },
  {
    name: "scanner-empty-match-iteration-terminates",
    why: "the historical hang was a /g regex whose index never advanced; the iteration step must terminate even when handed a pattern that CAN match empty",
    probe: () => {
      const spanStartedAt = Date.now();
      const spans = [...SCANNER.matchSpans("aaaa", /x*/g)];
      const spanMs = Date.now() - spanStartedAt;
      // 200 credential spans on ONE line. Each finding calls redact() to build its
      // sample, and redact() running over the scanned line is exactly what used to
      // rewind the scan into an unbounded loop.
      const pathological = `${"postgres://u:p@h ".repeat(200)}password=x secret=Yq3Lm8Kd2Tz6Rw1`;
      const scanStartedAt = Date.now();
      const findings = SCANNER.scanForLeaks(pathological, {});
      return {
        spans: spans.length,
        emptySpans: spans.filter((s) => s[0].length === 0).length,
        spanMs,
        findings: findings.length,
        scanMs: Date.now() - scanStartedAt,
      };
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.spans === 5 &&
      r.probe.emptySpans === 5 &&
      r.probe.findings === 202 &&
      r.probe.spanMs < 1000 &&
      r.probe.scanMs < 10000,
  },
  {
    name: "scanner-has-no-hand-written-match-loop",
    why: "the termination argument rests on there being no manual iteration left to get wrong, so the absence is asserted rather than described",
    probe: () => {
      const source = fs.readFileSync(path.join(GATES_DIR, "lib", "redact.js"), "utf8");
      const codeLines = source.split(/\r?\n/).filter((line) => {
        const trimmed = line.trim();
        return trimmed !== "" && !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      });
      return {
        codeLines: codeLines.length,
        offenders: codeLines.filter((line) => /\blastIndex\b/.test(line) || /\bwhile\s*\(/.test(line)),
      };
    },
    expectExit: 0,
    assert: (r) => r.probe.codeLines > 50 && r.probe.offenders.length === 0,
  },

  // ---- credential scanner: end to end through the driver -------------------
  {
    name: "scanner-e2e-driver-redacts-new-shapes",
    why: "a harness printing a Clerk key and a passwordless DSN stays green while neither reaches the log or either summary",
    args: [scannerManifest("scanner-e2e.json")],
    expectExit: 0,
    assert: (r) => {
      const rec = r.summary && r.summary.harnesses.find((h) => h.file === "check-scanner-leak.js");
      if (!rec || rec.exitCode !== 0) return false;
      const log = fs.readFileSync(rec.logPath, "utf8");
      const summaryJson = fs.readFileSync(path.join(r.outDir, "latest.json"), "utf8");
      const summaryMd = fs.readFileSync(path.join(r.outDir, "latest.md"), "utf8");
      const material = ["4f8FIXTUREb7Lm9Kd3Tz6", "svc_reader"];
      return (
        r.summary.verdict === "PASS" &&
        r.summary.secretScan.passed === true &&
        log.includes("sk_live_<redacted>") &&
        log.includes("postgres://<redacted>@<redacted>/appdb") &&
        material.every((s) => !log.includes(s) && !summaryJson.includes(s) && !summaryMd.includes(s))
      );
    },
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
    // `probe` cases assert on the scanner in-process; everything else spawns the driver.
    const r = c.probe ? runProbe(c.probe) : runDriver(args, c.env || {});
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
