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
// The driver is required (not spawned) for the evidence-parser probes: the parser must be
// asserted against the exact output shapes the real check-*.ts harnesses print, and no
// spawned run can show which recogniser fired or what it read. run-gates.js guards its own
// main() behind require.main === module, so this require does not launch a sweep.
const EVIDENCE = require("./run-gates");

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
  {
    name: "scanner-short-word-password-does-not-poison-innocent-output",
    why: "a short dictionary-word password must not make the driver report its OWN summary as a critical leak, while a real credential is still caught",
    probe: () => {
      // Text of the kind the driver genuinely writes into its own summary. It
      // contains "post" and "true" as ordinary substrings.
      const innocent =
        'database: "postgres_rehearsal_20260826" host: localhost verdict: PASS trueDepth: 3';

      // FALSE-POSITIVE DIRECTION. Measured before the fix: each of these
      // produced 1 SECRET_LITERAL/critical against innocent text and rewrote it
      // mid-word, so the gate could never go green on such a machine.
      const poisoning = ["post", "true", "postgres"].map((pw) => {
        const literals = SCANNER.collectSecretLiterals({ PGPASSWORD: pw });
        return {
          pw,
          collected: literals.length,
          findings: SCANNER.scanForLeaks(innocent, { secretLiterals: literals }).length,
          corrupted: SCANNER.redact(innocent, literals) !== innocent,
        };
      });

      // TRUE-POSITIVE DIRECTION. A real credential must still be collected,
      // reported critical, redacted out of the text, and never quoted back.
      const real = `S3cr3t${"Passw"}0rd99xyz`;
      const realLiterals = SCANNER.collectSecretLiterals({ PGPASSWORD: real });
      const realText = `[db] connecting with PGPASSWORD=${real} to localhost`;
      const realFindings = SCANNER.scanForLeaks(realText, { secretLiterals: realLiterals });
      const realRedacted = SCANNER.redact(realText, realLiterals);

      // The whole DSN must still be redacted wholesale, which is the channel a
      // short password keeps relying on after the fix.
      const dsnLiterals = SCANNER.collectSecretLiterals({
        DATABASE_URL: "postgresql://appuser:post@localhost:5432/personalink_rehearsal",
      });
      const dsnText = "url=postgresql://appuser:post@localhost:5432/personalink_rehearsal";

      return {
        poisoning,
        realCollected: realLiterals.length,
        realCritical: realFindings.some((f) => f.severity === "critical"),
        realRedactedOut: !realRedacted.includes(real),
        realQuoted: JSON.stringify(realFindings).includes(real),
        dsnRedactedOut: !SCANNER.redact(dsnText, dsnLiterals).includes(":post@"),
      };
    },
    expectExit: 0,
    assert: (r) =>
      // No short word-shaped password is ever hunted as a bare substring, so
      // innocent output is neither flagged nor rewritten.
      r.probe.poisoning.every((p) => p.collected === 0 && p.findings === 0 && p.corrupted === false) &&
      // A real credential is still collected, still critical, still removed, still never echoed.
      r.probe.realCollected === 1 &&
      r.probe.realCritical === true &&
      r.probe.realRedactedOut === true &&
      r.probe.realQuoted === false &&
      // And a short password inside a DSN is still redacted with the DSN.
      r.probe.dsnRedactedOut === true,
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

  // ---- assertion-evidence contract (appended; nothing above is renumbered) --
  //
  // WHAT THESE ARE FOR. Before them, "passed" meant "exited 0". A harness that asserted
  // nothing and a harness that proved sixty invariants produced the same record, so the
  // headline "74 checks, FAILED 0" rested entirely on 74 exit codes. The cases below pin the
  // contract down defect by defect: each one is a harness that the PREVIOUS guards all pass -
  // real exit 0, non-empty log, no duplicate, no leak - and which must still fail.
  {
    name: "evidence-every-recognised-form-passes",
    why: "all five evidence forms the parser recognises are accepted with a positive count and no allowlist entry",
    args: [fixture("evidence-good.json")],
    expectExit: 0,
    assert: (r) => {
      const ev = r.summary && r.summary.evidence;
      if (!ev) return false;
      const byHarness = new Map(ev.records.map((x) => [x.harness, x]));
      const expected = [
        ["check-gamma.js", "gate-evidence-line", 4, "declared-by-harness"],
        ["check-ratio.js", "ratio-passed", 6, "attributed-by-driver"],
        ["check-json.js", "json-report-count", 12, "attributed-by-driver"],
        ["check-jsonlist.js", "json-report-list", 3, "attributed-by-driver"],
        ["check-summaryline.js", "summary-passed-failed", 41, "attributed-by-driver"],
      ];
      return (
        r.summary.verdict === "PASS" &&
        r.summary.gateEstablished === true &&
        ev.enforced === true &&
        ev.counts.evidenced === 5 &&
        ev.counts.unevidenced === 0 &&
        ev.counts.allowlisted === 0 &&
        ev.counts.totalAssertions === 66 &&
        expected.every(([file, form, assertions, identity]) => {
          const rec = byHarness.get(file);
          return rec && rec.form === form && rec.assertions === assertions && rec.identitySource === identity;
        })
      );
    },
  },
  {
    name: "evidence-missing-fails-silent-success",
    why: "THE HEADLINE CASE: a harness that exits 0, logs output and asserts nothing must fail, because exit 0 is not evidence",
    args: [fixture("evidence-mute.json")],
    expectExit: 2,
    assert: (r) =>
      hasFinding(r, "EVIDENCE_MISSING") &&
      r.summary.verdict === "INTEGRITY-FAILURE" &&
      r.summary.gateEstablished === false &&
      // Every pre-existing guard passes this harness: it really did exit 0 and really did log.
      r.summary.counts.failed === 0 &&
      r.summary.harnesses[0].exitCode === 0 &&
      r.summary.harnesses[0].logBytes > 0 &&
      r.summary.evidence.unevidenced.includes("check-mute.js"),
  },
  {
    name: "evidence-zero-assertions-fails",
    why: "\"0/0 assertions passed\" is an empty check wearing the shape of a pass",
    args: [fixture("evidence-zero.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_ZERO_ASSERTIONS") && r.summary.evidence.counts.evidenced === 0,
  },
  {
    name: "evidence-negative-assertions-fails",
    why: "a negative count means the harness's own bookkeeping is broken, and is reported distinctly from zero",
    args: [fixture("evidence-negative.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_NEGATIVE_ASSERTIONS") && !hasFinding(r, "EVIDENCE_ZERO_ASSERTIONS"),
  },
  {
    name: "evidence-forged-identity-fails",
    why: "a real positive count that names a different harness is borrowed proof, and only the identity check can catch it",
    args: [fixture("evidence-forged.json")],
    expectExit: 2,
    assert: (r) =>
      hasFinding(r, "EVIDENCE_IDENTITY_MISMATCH") &&
      r.summary.integrityFindings.some((f) => f.detail.includes("check-somewhere-else.js")),
  },
  {
    name: "evidence-duplicate-id-fails",
    why: "two harnesses claiming the same identity means one set of assertions is counted under a name that is not its own",
    args: [fixture("evidence-twins.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_DUPLICATE_ID") && r.summary.counts.failed === 0,
  },
  {
    name: "evidence-stale-sidecar-fails",
    why: "a sidecar from an earlier run is rejected even though the same harness printed perfect log evidence",
    args: [fixture("evidence-stale.json")],
    expectExit: 2,
    assert: (r) =>
      hasFinding(r, "EVIDENCE_STALE") &&
      // The point of the case: good log evidence existed and was NOT quietly used instead.
      r.summary.evidence.counts.evidenced === 0 &&
      r.summary.harnesses[0].exitCode === 0,
  },
  {
    name: "evidence-orphan-sidecar-fails",
    why: "an evidence file for a harness this run never executed is a leftover and must not sit beside this run's artefacts",
    lazyArgs: () => [fixture("evidence-good.json")],
    env: (() => {
      const dir = fs.mkdtempSync(path.join(TMP_ROOT, "orphan-evidence-"));
      fs.writeFileSync(
        path.join(dir, "check-ghost.js.evidence.json"),
        `${JSON.stringify({ schema: "personai.gates.evidence/1", runId: "run-from-an-earlier-sweep", harness: "check-ghost.js", assertions: 99 }, null, 2)}\n`,
        "utf8",
      );
      return { GATES_EVIDENCE_DIR: dir };
    })(),
    expectExit: 2,
    assert: (r) =>
      hasFinding(r, "EVIDENCE_ORPHAN_SIDECAR") &&
      r.summary.integrityFindings.some((f) => f.kind === "EVIDENCE_ORPHAN_SIDECAR" && f.harness === "check-ghost.js"),
  },
  {
    name: "evidence-malformed-fails",
    why: "an evidence line whose count is the string \"undefined\" is rejected rather than coerced to NaN or zero",
    args: [fixture("evidence-malformed.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_MALFORMED"),
  },
  {
    name: "evidence-claiming-failures-while-green-fails",
    why: "\"4/6 assertions passed\" with exit 0 is a harness that forgot to set its exit code",
    args: [fixture("evidence-claims.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_CLAIMS_FAILURES") && r.summary.counts.failed === 0,
  },
  {
    name: "evidence-allowlist-admits-one-named-harness",
    why: "an exactly-named, reasoned, temporary allowlist entry lets the silent harness pass, and the allowlist is reported in full",
    args: [fixture("evidence-mute-allowlisted.json")],
    expectExit: 0,
    assert: (r) => {
      const ev = r.summary && r.summary.evidence;
      const md = fs.readFileSync(path.join(r.outDir, "latest.md"), "utf8");
      return (
        r.summary.verdict === "PASS" &&
        ev.counts.evidenced === 0 &&
        ev.counts.unevidenced === 0 &&
        ev.allowlist.actualSize === 1 &&
        ev.allowlist.declaredSize === 1 &&
        ev.allowlist.files.join(",") === "check-mute.js" &&
        ev.allowlist.entries[0].temporary === true &&
        // Size AND contents must reach the human-readable summary, or the list can grow unseen.
        md.includes("1 of the executed harnesses are NOT evidence-enforced") &&
        md.includes("check-mute.js") &&
        r.stdout.includes("evidence allowlist: 1 entry (declared 1) -> check-mute.js")
      );
    },
  },
  {
    name: "evidence-allowlist-ghost-entry-fails",
    why: "an allowlisted filename that is not on disk overstates the unenforced count and hides what it covered",
    args: [fixture("evidence-allowlist-ghost.json"), "--integrity-only"],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_ALLOWLIST_ENTRY_MISSING_ON_DISK") && r.summary.counts.executed === 0,
  },
  {
    name: "evidence-allowlist-wildcard-refused",
    why: "a glob entry would exempt harnesses added later while the declared size still read 1, so patterns are refused outright",
    args: [fixture("evidence-allowlist-wildcard.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_ALLOWLIST_PATTERN_FORBIDDEN"),
  },
  {
    name: "evidence-allowlist-size-drift-fails",
    why: "the allowlist cannot grow silently: its real length must match the size the manifest declares",
    args: [fixture("evidence-allowlist-size-drift.json")],
    expectExit: 2,
    assert: (r) =>
      hasFinding(r, "EVIDENCE_ALLOWLIST_SIZE_DRIFT") &&
      // The same manifest allowlists a harness that does emit evidence, so the redundant
      // report fires too — an exemption that is no longer needed should be deleted.
      r.summary.evidence.allowlist.redundant.some((x) => x.file === "check-gamma.js"),
  },
  {
    name: "evidence-allowlist-unreasoned-entry-fails",
    why: "an entry with no reason and no temporary marker is how an exemption becomes permanent by omission",
    args: [fixture("evidence-allowlist-unreasoned.json")],
    expectExit: 2,
    assert: (r) => hasFinding(r, "EVIDENCE_ALLOWLIST_ENTRY_INVALID"),
  },
  {
    name: "evidence-parser-reads-the-real-harness-forms",
    why: "the parser is asserted against the exact lines the real check-*.ts harnesses print, not only against fixture lines",
    probe: () => {
      // Every string here is a form that exists in scripts/one-off/ today.
      const cases = [
        ["58/58 assertions passed", "ratio-passed", 58],
        ["43/43 assertions passed", "ratio-passed", 43],
        ["39/39 invariants passed", "ratio-passed", 39],
        ["46/46 installation route assertions passed", "ratio-passed", 46],
        ["57/57 installation runtime assertions passed", "ratio-passed", 57],
        ["53/53 blueprint preview assertions passed", "ratio-passed", 53],
        ["75/75 assertions passed", "ratio-passed", 75],
        ["12/12 due-work planning assertions passed", "ratio-passed", 12],
        ["[fixture:alpha] 3 assertions passed", "count-passed", 3],
        ["1 assertion passed", "count-passed", 1],
        ["SUMMARY mode=normal passed=41 failed=0", "summary-passed-failed", 41],
        ["GATE-EVIDENCE harness=check-x.ts assertions=7", "gate-evidence-line", 7],
      ];
      const parsed = cases.map(([line, form, count]) => {
        const got = EVIDENCE.parseEvidenceFromLog(`preamble\n${line}\n`);
        return { line, wantForm: form, wantCount: count, gotForm: got && got.form, gotCount: got && Number(got.rawCount) };
      });
      const jsonNumeric = EVIDENCE.parseEvidenceFromLog(
        `${JSON.stringify({ result: "PASS", assertions: 41, failures: [] }, null, 2)}\n`,
      );
      const jsonList = EVIDENCE.parseEvidenceFromLog(
        `${JSON.stringify({ result: "PASS", assertions: ["a", "b", "c", "d", "e"] }, null, 2)}\n`,
      );
      const jsonChecksKey = EVIDENCE.parseEvidenceFromLog(
        `${JSON.stringify({ result: "PASS", checks: 17, failures: [] }, null, 2)}\n`,
      );
      // The shapes that must NOT be read as evidence, because they are not assertion counts.
      const notEvidence = [
        '{\n  "result": "PASS",\n  "failures": []\n}',
        "copilot runtime contract checks passed",
        "All foundation contract checks passed.",
        "Assertion calls examined: 3412.",
        '{\n  "database": "x",\n  "lines": 3,\n  "events": 4\n}',
        "",
      ].map((text) => EVIDENCE.parseEvidenceFromLog(text));
      return {
        parsed,
        mismatches: parsed.filter((p) => p.gotForm !== p.wantForm || p.gotCount !== p.wantCount),
        jsonNumeric: jsonNumeric && { form: jsonNumeric.form, count: jsonNumeric.rawCount },
        jsonList: jsonList && { form: jsonList.form, count: jsonList.rawCount },
        jsonChecksKey: jsonChecksKey && { form: jsonChecksKey.form, count: jsonChecksKey.rawCount },
        falsePositives: notEvidence.filter((x) => x !== null).length,
      };
    },
    expectExit: 0,
    assert: (r) =>
      r.probe.parsed.length === 12 &&
      r.probe.mismatches.length === 0 &&
      r.probe.jsonNumeric.form === "json-report-count" &&
      r.probe.jsonNumeric.count === 41 &&
      r.probe.jsonList.form === "json-report-list" &&
      r.probe.jsonList.count === 5 &&
      r.probe.jsonChecksKey.form === "json-report-count" &&
      r.probe.jsonChecksKey.count === 17 &&
      r.probe.falsePositives === 0,
  },
  {
    name: "evidence-real-manifest-allowlist-is-honest",
    why: "the committed allowlist is exactly 13 exactly-named, reasoned, on-disk harnesses out of 74 executed — the number root will check",
    args: ["--integrity-only"],
    expectExit: 0,
    assert: (r) => {
      const ev = r.summary && r.summary.evidence;
      if (!ev) return false;
      const runnable = r.summary.counts.runnable;
      return (
        r.summary.integrityFindings.length === 0 &&
        ev.required === true &&
        ev.allowlist.actualSize === 13 &&
        ev.allowlist.declaredSize === 13 &&
        runnable === 74 &&
        // Honest arithmetic: 74 runnable = 61 enforced + 13 allowlisted.
        runnable - ev.allowlist.actualSize === 61 &&
        ev.allowlist.files.length === new Set(ev.allowlist.files).size &&
        ev.allowlist.entries.every(
          (e) =>
            e.temporary === true &&
            typeof e.reason === "string" &&
            e.reason.trim().length >= 20 &&
            typeof e.migrationPending === "string" &&
            e.migrationPending.trim() !== "" &&
            !EVIDENCE.ALLOWLIST_FORBIDDEN_CHARS.test(e.file),
        )
      );
    },
  },
  {
    name: "no-database-manifest-neither-crashes-nor-forwards-an-unvalidated-url",
    why: "a requiresDatabase:false manifest used to die on an unhandled TypeError (null database target); it must complete AND withhold the ambient DATABASE_URL, which has passed no denylist",
    args: [fixture("audit-nodb.json")],
    // Load-bearing: without a DATABASE_URL in the driver's own environment the harness's
    // "was it withheld?" check passes trivially and this guard proves nothing. Setting one here is
    // what makes the withholding observable. It is never connected to - requiresDatabase:false means
    // the target is never even resolved - and the name is disposable-shaped regardless.
    env: { DATABASE_URL: "postgresql://probe:probe@127.0.0.1:5432/audit_scratch_probe" },
    expectExit: 0,
    assert: (r) =>
      r.summary.verdict === "PASS" &&
      r.summary.gateEstablished === true &&
      r.summary.counts.executed === 1 &&
      r.summary.counts.failed === 0 &&
      // The harness itself asserts DATABASE_URL was absent; if the driver had forwarded it, the
      // harness exits 1 and this leg goes red rather than merely losing a nicety.
      r.summary.evidence.counts.evidenced === 1 &&
      // A crash wrote no summary at all, so the presence of a parsed verdict is part of the guard.
      !r.stdout.includes("TypeError"),
  },
  {
    name: "evidence-block-is-additive-to-the-summary-schema",
    why: "the fields other workers and root read must be untouched; the evidence block is a new sibling, not a rename",
    args: [fixture("evidence-good.json")],
    expectExit: 0,
    assert: (r) => {
      const s = r.summary;
      const required = ["counts", "harnesses", "secretScan", "verdict", "exitCode", "gateEstablished", "integrityFindings"];
      const countKeys = ["onDisk", "manifestEntries", "runnable", "declaredSkips", "selected", "executed", "passed", "failed", "timedOut"];
      return (
        required.every((k) => k in s) &&
        countKeys.every((k) => typeof s.counts[k] === "number") &&
        s.schema === "personai.gates.summary/1" &&
        typeof s.evidence === "object" &&
        s.evidence.schema === "personai.gates.evidence-summary/1" &&
        // Per-harness evidence is an added field on the existing records, not a replacement.
        s.harnesses.every((h) => "file" in h && "status" in h && "exitCode" in h) &&
        s.harnesses.filter((h) => h.status === "passed").every((h) => h.evidence && h.evidence.assertions > 0)
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
