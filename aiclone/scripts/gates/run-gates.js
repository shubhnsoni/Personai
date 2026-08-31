#!/usr/bin/env node
"use strict";

/**
 * run-gates.js — the repository-owned gate sweep driver.
 *
 * WHY THIS EXISTS
 * ---------------
 * The "74 checks, FAILED 0" headline gate was produced for weeks by a PowerShell
 * script living in a per-user TEMP directory, hardwired to one developer's
 * absolute paths. No reader of this repository could reproduce the figure, and
 * deleting that temp file would have destroyed the project's primary gate. This
 * driver replaces it and depends on NOTHING outside the repository except
 * environment configuration (aiclone/.env, or DATABASE_URL already exported).
 *
 * DESIGN RULES IT HOLDS TO
 * ------------------------
 *  - The app directory is derived from __dirname, never a hardcoded user path,
 *    so the driver runs unchanged in any clone or worktree and always tests the
 *    checkout it is part of.
 *  - Every harness on disk is declared in gates.manifest.json. A harness on disk
 *    with no entry, an entry with no file, a duplicate, or a skip without a
 *    reason is a FAILURE, not a silent omission.
 *  - Per-harness records carry the exact argv, cwd, start/end timestamps,
 *    duration and the REAL exit code.
 *  - Bounded per-harness timeout; the child PROCESS TREE is killed on timeout so
 *    nothing is orphaned.
 *  - A filter can narrow a run but can never turn red into green: any filtered
 *    run is stamped partial and cannot establish the gate.
 *  - The disposable database target is asserted and the live one refused.
 *  - No credential, DSN, password or connection string is emitted anywhere,
 *    including on the failure path — and the driver asserts that by re-reading
 *    everything it wrote.
 *
 * USAGE
 *   cd aiclone
 *   node scripts/gates/run-gates.js                      # full sweep (~20 min)
 *   node scripts/gates/run-gates.js --list               # inventory, run nothing
 *   node scripts/gates/run-gates.js --integrity-only     # reconcile only
 *   node scripts/gates/run-gates.js --package=fieldjob   # focused, PARTIAL
 *
 * EXIT CODES
 *   0  green full sweep, or --list/--integrity-only clean, or accepted partial
 *   1  at least one executed harness failed or timed out
 *   2  inventory / safety / credential-leak failure — the result is VOID
 *   3  partial run (a filter was applied) and --accept-partial was not passed
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");

const { loadManifest, reconcile, applyFilter } = require("./lib/inventory");
const { resolveDatabaseTarget, DatabaseTargetError } = require("./lib/db-target");
const { collectSecretLiterals, redact, scanForLeaks } = require("./lib/redact");
const { writeSummaries, fmtMs } = require("./lib/report");

const DRIVER_VERSION = "1.1.0";
const MAX_CAPTURED_BYTES = 16 * 1024 * 1024;

const EXIT = { OK: 0, HARNESS_FAILED: 1, INTEGRITY: 2, PARTIAL: 3 };

// ---------------------------------------------------------------------------
// THE ASSERTION-EVIDENCE CONTRACT
// ---------------------------------------------------------------------------
//
// Before this block existed, a harness "passed" because it exited 0. A harness that
// asserted sixty invariants and a harness that asserted nothing were indistinguishable
// in the summary, so "74 checks, FAILED 0" could in principle have been produced by 74
// empty files. The exit code was the whole of the evidence.
//
// THE CONTRACT. Every harness that the driver counts as passed must yield an evidence
// record carrying (a) a harness IDENTITY and (b) a POSITIVE integer assertion count.
// A harness with no such record is a failure, not a pass, unless it is named — exactly,
// by filename — on the manifest's temporary allowlist.
//
// WHY A PARSER RATHER THAN A HARNESS CHANGE. Most harnesses in this repository already
// print their evidence, in a handful of stable shapes ("58/58 assertions passed",
// "39/39 invariants passed", a JSON report carrying "assertions": 41, a
// "SUMMARY ... passed=41 failed=0" line). Recognising what is already there enforces the
// contract on the majority of the sweep today without editing a single harness — and a
// harness edit made to satisfy a checker is a harness edit nobody reviewed for meaning.
//
// TWO CHANNELS, DELIBERATELY ORDERED.
//   1. SIDECAR (authoritative, forward-looking): a harness may write
//      <evidenceDir>/<harness>.evidence.json = { schema, runId, harness, assertions }.
//      The runId is a per-run nonce the driver hands the child in GATES_RUN_ID, so a
//      sidecar left behind by an earlier run cannot be mistaken for this run's proof.
//      No harness writes one yet; the channel exists because it is the only one where
//      staleness is a real threat, and a control for a threat you cannot demonstrate is
//      a control nobody can trust.
//   2. LOG (what actually carries the weight today): the recognisers below.
//
// A stale or mismatched sidecar is FATAL even when the log evidence is perfect. Silently
// preferring the good evidence is how forged evidence gets absorbed.
//
// Every rejection is a distinct named finding, because "evidence check failed" tells a
// reader nothing about what to fix. See EVIDENCE_FINDING_KINDS.
// ---------------------------------------------------------------------------

const EVIDENCE_SCHEMA = "personai.gates.evidence/1";
const EVIDENCE_SUMMARY_SCHEMA = "personai.gates.evidence-summary/1";

/** Every rejection reason, so the set is enumerable from the code and from the summary. */
const EVIDENCE_FINDING_KINDS = Object.freeze({
  EVIDENCE_MISSING: "no assertion evidence was produced and the harness is not on the allowlist",
  EVIDENCE_MALFORMED: "evidence was produced but is not usable (unparseable, wrong type, or a ratio whose passed count exceeds its total)",
  EVIDENCE_ZERO_ASSERTIONS: "the evidence reports zero assertions, so nothing was proven",
  EVIDENCE_NEGATIVE_ASSERTIONS: "the evidence reports a negative assertion count",
  EVIDENCE_CLAIMS_FAILURES: "the evidence reports failed assertions while the harness exited 0",
  EVIDENCE_DUPLICATE_ID: "two harnesses produced evidence claiming the same harness identity",
  EVIDENCE_IDENTITY_MISMATCH: "the evidence names a harness other than the one that produced it",
  EVIDENCE_STALE: "the evidence was not produced by this run (wrong run id, or written before the harness started)",
  EVIDENCE_ORPHAN_SIDECAR: "an evidence file exists for a harness this run did not execute",
  EVIDENCE_ALLOWLIST_ENTRY_MISSING_ON_DISK: "an allowlisted harness filename does not exist on disk",
  EVIDENCE_ALLOWLIST_ENTRY_INVALID: "an allowlist entry lacks a concrete reason or is not marked temporary/migration-pending",
  EVIDENCE_ALLOWLIST_PATTERN_FORBIDDEN: "an allowlist entry is a wildcard, glob or regex rather than an exact filename",
  EVIDENCE_ALLOWLIST_SIZE_DRIFT: "the allowlist's real size disagrees with the size the manifest declares",
});

/**
 * A wildcard, glob, regex or path metacharacter in an allowlist entry.
 *
 * The allowlist's SIZE is the honest count of harnesses this gate does not enforce. One
 * pattern entry would destroy that number: it could silently cover harnesses added later,
 * so the count would stop being a measurement and become a floor.
 */
const ALLOWLIST_FORBIDDEN_CHARS = /[*?[\]{}()|+^$\\/\s]/u;

/**
 * JSON report keys that carry an assertion count, in precedence order.
 * A number is the count; an array is a list of assertion names, so its length is the count.
 */
const EVIDENCE_JSON_COUNT_KEYS = Object.freeze([
  "assertions",
  "assertionCount",
  "assertionsPassed",
  "invariants",
  "checks",
]);

/**
 * Log-line evidence forms, tried in this order per line.
 *
 * `ratio-passed` MUST precede `count-passed` so "2/2 invariants passed" is read as 2 of 2
 * rather than as the bare number 2 — otherwise a harness reporting "56/58" would look green.
 */
const EVIDENCE_LINE_FORMS = Object.freeze([
  {
    // GATE-EVIDENCE harness=check-foo.ts assertions=58
    // The only form that carries identity, so the only one a harness can forge with.
    name: "gate-evidence-line",
    explicit: true,
    pattern: /^\s*GATE-EVIDENCE\s+harness=(\S+)\s+assertions=(\S+)\s*$/u,
    read: (m) => ({ claimedId: m[1], rawCount: m[2] }),
  },
  {
    // 58/58 assertions passed | 39/39 invariants passed | 46/46 installation route assertions passed
    name: "ratio-passed",
    pattern: /(-?\d+)\s*\/\s*(-?\d+)([^\n]{0,60}?)\s(?:assertions?|invariants?|checks?)\s+passed\b/iu,
    read: (m) => ({ rawCount: m[1], rawTotal: m[2] }),
  },
  {
    // 3 assertions passed | 1 assertion passed
    name: "count-passed",
    pattern: /(?:^|[^\d/])(-?\d+)\s+(?:assertions?|invariants?|checks?)\s+passed\b/iu,
    read: (m) => ({ rawCount: m[1] }),
  },
  {
    // SUMMARY mode=normal passed=41 failed=0
    name: "summary-passed-failed",
    pattern: /\bSUMMARY\b[^\n]*?\bpassed=(-?\d+)\b[^\n]*?\bfailed=(-?\d+)\b/iu,
    read: (m) => ({ rawCount: m[1], rawFailed: m[2] }),
  },
]);

/**
 * Find the last top-level JSON object printed in a log.
 *
 * JSON.stringify(value, null, 2) — which is what every JSON-reporting harness here uses —
 * puts the opening brace alone on its own line and the closing brace alone on the last, and
 * nests inner objects after their key ("a": {). So a line that trims to exactly "{" is a
 * top-level open, which is what makes this parse rather than a brace-counting guess. Text
 * printed after the JSON (check-foundation-contracts.ts prints a sign-off line) is skipped
 * because the search runs backwards from the end.
 */
function extractLastJsonObject(text) {
  const lines = text.split(/\r?\n/);
  for (let end = lines.length - 1; end >= 0; end -= 1) {
    if (lines[end].trim() !== "}") continue;
    for (let start = end - 1; start >= 0; start -= 1) {
      if (lines[start].trim() !== "{") continue;
      let value;
      try {
        value = JSON.parse(lines.slice(start, end + 1).join("\n"));
      } catch {
        continue; // not balanced from here; keep widening
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { value, startLine: start + 1, endLine: end + 1 };
      }
    }
  }
  return null;
}

/**
 * Parse assertion evidence out of one harness's captured log.
 * Returns null when the log carries none, which is the case the contract exists to catch.
 */
function parseEvidenceFromLog(text) {
  const lines = String(text == null ? "" : text).split(/\r?\n/);
  let explicit = null;
  let heuristic = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    for (const form of EVIDENCE_LINE_FORMS) {
      const m = form.pattern.exec(line);
      if (!m) continue;
      const candidate = {
        form: form.name,
        source: "log",
        line: i + 1,
        raw: line.trim().replace(/\s+/gu, " ").slice(0, 200),
        ...form.read(m),
      };
      // Explicit, identity-bearing evidence always wins; among the heuristic forms the
      // last one in the log wins, because that is where a harness prints its summary.
      if (form.explicit) {
        if (explicit === null) explicit = candidate;
      } else {
        heuristic = candidate;
      }
      break; // one form per line: ratio before count, so the ratio is not read as a bare count
    }
  }

  if (explicit) return explicit;
  if (heuristic) return heuristic;

  const json = extractLastJsonObject(text);
  if (!json) return null;
  for (const key of EVIDENCE_JSON_COUNT_KEYS) {
    if (!(key in json.value)) continue;
    const raw = json.value[key];
    if (typeof raw === "number") {
      return {
        form: "json-report-count",
        source: "log",
        line: json.endLine,
        raw: `${key}: ${raw}`,
        rawCount: raw,
      };
    }
    if (Array.isArray(raw)) {
      return {
        form: "json-report-list",
        source: "log",
        line: json.endLine,
        raw: `${key}: [${raw.length} entr${raw.length === 1 ? "y" : "ies"}]`,
        rawCount: raw.length,
      };
    }
  }
  return null;
}

function toInteger(raw) {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  return /^-?\d+$/u.test(raw.trim()) ? Number(raw.trim()) : null;
}

function sidecarPathFor(evidenceDir, harnessFile) {
  return path.join(evidenceDir, `${harnessFile}.evidence.json`);
}

/**
 * Read and validate one harness's sidecar evidence file, if it wrote one.
 * Returns { evidence } on success or { findings } on rejection — never both.
 */
function readSidecar(record, { evidenceDir, runId }) {
  const sidecar = sidecarPathFor(evidenceDir, record.file);
  let stat;
  try {
    stat = fs.statSync(sidecar);
  } catch {
    return null; // no sidecar: the log channel decides
  }
  const rel = path.relative(APP_DIR, sidecar).split(path.sep).join("/");

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(sidecar, "utf8"));
  } catch (error) {
    return {
      findings: [
        {
          kind: "EVIDENCE_MALFORMED",
          harness: record.file,
          detail: `${record.file} wrote ${rel} but it is not valid JSON (${error.message}). Unreadable evidence is not evidence.`,
        },
      ],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      findings: [
        { kind: "EVIDENCE_MALFORMED", harness: record.file, detail: `${rel} is not a JSON object.` },
      ],
    };
  }
  if (parsed.runId !== runId) {
    return {
      findings: [
        {
          kind: "EVIDENCE_STALE",
          harness: record.file,
          detail:
            `${rel} carries runId ${JSON.stringify(String(parsed.runId ?? null))} but this run is ${runId}. ` +
            "Evidence left over from an earlier run proves nothing about this one, so it is rejected rather " +
            "than ignored — ignoring it is how stale proof gets absorbed into a green result.",
        },
      ],
    };
  }
  // Second, independent staleness test: a file copied forward can carry the right runId.
  const startedAtMs = Date.parse(record.startedAt);
  if (Number.isFinite(startedAtMs) && stat.mtimeMs + 1000 < startedAtMs) {
    return {
      findings: [
        {
          kind: "EVIDENCE_STALE",
          harness: record.file,
          detail:
            `${rel} was last written at ${new Date(stat.mtimeMs).toISOString()}, before ${record.file} started ` +
            `at ${record.startedAt}. It cannot be this execution's evidence.`,
        },
      ],
    };
  }
  if (parsed.schema !== undefined && parsed.schema !== EVIDENCE_SCHEMA) {
    return {
      findings: [
        {
          kind: "EVIDENCE_MALFORMED",
          harness: record.file,
          detail: `${rel} declares schema ${JSON.stringify(String(parsed.schema))}; expected ${EVIDENCE_SCHEMA}.`,
        },
      ],
    };
  }
  return {
    evidence: {
      form: "sidecar-json",
      source: "sidecar",
      sidecarRelativePath: rel,
      line: null,
      raw: `${String(parsed.harness)} / ${String(parsed.assertions)}`,
      claimedId: typeof parsed.harness === "string" ? parsed.harness : undefined,
      rawCount: parsed.assertions,
    },
  };
}

/**
 * Turn a raw parse into a validated evidence record, or into named findings.
 */
function validateEvidence(record, candidate) {
  const findings = [];
  const count = toInteger(candidate.rawCount);

  if (count === null) {
    findings.push({
      kind: "EVIDENCE_MALFORMED",
      harness: record.file,
      detail:
        `${record.file} produced ${candidate.form} evidence whose assertion count ` +
        `${JSON.stringify(String(candidate.rawCount))} is not an integer. Raw: ${JSON.stringify(candidate.raw)}.`,
    });
    return { evidence: null, findings };
  }

  if (candidate.rawTotal !== undefined) {
    const total = toInteger(candidate.rawTotal);
    if (total === null) {
      findings.push({
        kind: "EVIDENCE_MALFORMED",
        harness: record.file,
        detail: `${record.file} produced a ratio whose total ${JSON.stringify(String(candidate.rawTotal))} is not an integer.`,
      });
      return { evidence: null, findings };
    }
    if (count > total) {
      findings.push({
        kind: "EVIDENCE_MALFORMED",
        harness: record.file,
        detail: `${record.file} claims ${count} of ${total} assertions passed. A passed count above the total is not a measurement.`,
      });
      return { evidence: null, findings };
    }
    if (count < total) {
      findings.push({
        kind: "EVIDENCE_CLAIMS_FAILURES",
        harness: record.file,
        detail:
          `${record.file} exited 0 while reporting ${count} of ${total} assertions passed, so ${total - count} ` +
          "failed. A harness cannot be green and report failures at the same time.",
      });
      return { evidence: null, findings };
    }
  }

  const failed = candidate.rawFailed === undefined ? null : toInteger(candidate.rawFailed);
  if (failed !== null && failed > 0) {
    findings.push({
      kind: "EVIDENCE_CLAIMS_FAILURES",
      harness: record.file,
      detail: `${record.file} exited 0 while its summary line reports failed=${failed}.`,
    });
    return { evidence: null, findings };
  }

  if (count < 0) {
    findings.push({
      kind: "EVIDENCE_NEGATIVE_ASSERTIONS",
      harness: record.file,
      detail: `${record.file} reports ${count} assertions. A negative count is a bug in the harness's own bookkeeping.`,
    });
    return { evidence: null, findings };
  }
  if (count === 0) {
    findings.push({
      kind: "EVIDENCE_ZERO_ASSERTIONS",
      harness: record.file,
      detail:
        `${record.file} exited 0 having asserted nothing (${candidate.form} evidence reports 0 assertions). ` +
        "An empty check is indistinguishable from a deleted one, so it cannot count as a pass.",
    });
    return { evidence: null, findings };
  }

  if (candidate.claimedId !== undefined && candidate.claimedId !== record.file) {
    findings.push({
      kind: "EVIDENCE_IDENTITY_MISMATCH",
      harness: record.file,
      detail:
        `${record.file} produced evidence naming ${JSON.stringify(String(candidate.claimedId))}. Evidence that ` +
        "identifies a different harness is forged or copied, and either way it does not prove anything about " +
        "the harness that emitted it.",
    });
    return { evidence: null, findings };
  }

  return {
    evidence: {
      harness: record.file,
      claimedId: candidate.claimedId ?? record.file,
      identitySource: candidate.claimedId === undefined ? "attributed-by-driver" : "declared-by-harness",
      assertions: count,
      total: candidate.rawTotal === undefined ? null : toInteger(candidate.rawTotal),
      form: candidate.form,
      source: candidate.source,
      logLine: candidate.line,
      sidecarRelativePath: candidate.sidecarRelativePath ?? null,
      raw: candidate.raw,
    },
    findings,
  };
}

/** Allowlist validation: shape, exactness, existence and declared size. */
function verifyAllowlist(evidenceConfig, onDisk) {
  const findings = [];
  const seen = new Set();

  evidenceConfig.allowlist.forEach((entry, index) => {
    const where = `evidence.allowlist[${index}]`;
    if (ALLOWLIST_FORBIDDEN_CHARS.test(entry.file)) {
      findings.push({
        kind: "EVIDENCE_ALLOWLIST_PATTERN_FORBIDDEN",
        harness: entry.file,
        detail:
          `${where}.file ${JSON.stringify(entry.file)} contains a wildcard, regex or path metacharacter. ` +
          "The allowlist must name EXACT filenames: its length is the honest count of harnesses this gate " +
          "does not enforce, and a pattern would silently cover harnesses added later.",
      });
      return;
    }
    if (seen.has(entry.file)) {
      findings.push({
        kind: "EVIDENCE_ALLOWLIST_ENTRY_INVALID",
        harness: entry.file,
        detail: `${where}.file ${entry.file} is listed twice, which overstates the allowlist's real coverage.`,
      });
      return;
    }
    seen.add(entry.file);

    const missing = [];
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 20) {
      missing.push("reason (a concrete sentence of at least 20 characters saying what the harness emits instead)");
    }
    if (entry.temporary !== true) missing.push("temporary: true");
    if (typeof entry.migrationPending !== "string" || entry.migrationPending.trim() === "") {
      missing.push("migrationPending (what has to happen for the entry to go away)");
    }
    if (typeof entry.declaredBy !== "string" || entry.declaredBy.trim() === "") missing.push("declaredBy");
    if (missing.length > 0) {
      findings.push({
        kind: "EVIDENCE_ALLOWLIST_ENTRY_INVALID",
        harness: entry.file,
        detail:
          `${where} is missing: ${missing.join("; ")}. An unenforced harness must carry its own justification, ` +
          "or the allowlist becomes a permanent exemption nobody remembers agreeing to.",
      });
    }
    if (!onDisk.includes(entry.file)) {
      findings.push({
        kind: "EVIDENCE_ALLOWLIST_ENTRY_MISSING_ON_DISK",
        harness: entry.file,
        detail:
          `${where}.file ${entry.file} is allowlisted but does not exist on disk. A stale exemption is worse ` +
          "than none: it makes the unenforced count look larger than it is and hides which harness it covered.",
      });
    }
  });

  const declared = evidenceConfig.allowlistDeclaredSize;
  const actual = evidenceConfig.allowlist.length;
  if (declared === null && actual > 0) {
    findings.push({
      kind: "EVIDENCE_ALLOWLIST_SIZE_DRIFT",
      detail:
        `The manifest allowlists ${actual} harness(es) but declares no evidence.allowlistDeclaredSize. ` +
        "The size must be declared so that adding an entry is a visible, reviewable edit rather than a silent one.",
    });
  } else if (declared !== null && declared !== actual) {
    findings.push({
      kind: "EVIDENCE_ALLOWLIST_SIZE_DRIFT",
      detail:
        `evidence.allowlistDeclaredSize is ${declared} but the allowlist holds ${actual} entr${actual === 1 ? "y" : "ies"}. ` +
        "Investigate the difference — an allowlist that can grow without the declared number moving can grow silently.",
    });
  }

  return findings;
}

/**
 * The whole contract, evaluated over one run.
 * Returns { block, findings }; `block` is added to the summary as a NEW field and no
 * existing field name changes.
 */
function evaluateEvidence({ records, manifest, onDisk, evidenceDir, runId, executed }) {
  const evidenceConfig = manifest.evidence;
  const findings = verifyAllowlist(evidenceConfig, onDisk);
  const allowlistFiles = evidenceConfig.allowlist.map((e) => e.file);
  const allowlisted = new Set(allowlistFiles);

  const records2 = [];
  const redundant = [];
  const unevidenced = [];
  const formCounts = {};

  if (executed) {
    // PASS 1 — gather one candidate per passed harness, and reject what cannot be read at all.
    const candidates = [];
    for (const record of records) {
      if (record.status !== "passed") continue; // a red harness already fails; evidence is about green

      const sidecar = readSidecar(record, { evidenceDir, runId });
      if (sidecar && sidecar.findings) {
        findings.push(...sidecar.findings);
        continue;
      }
      const candidate = sidecar ? sidecar.evidence : parseEvidenceFromLog(readLogText(record.logPath));

      if (!candidate) {
        if (allowlisted.has(record.file)) continue;
        unevidenced.push(record.file);
        findings.push({
          kind: "EVIDENCE_MISSING",
          harness: record.file,
          detail:
            `${record.file} exited 0 without emitting any assertion evidence. Exit 0 on its own does not ` +
            "distinguish a harness that proved sixty invariants from one that asserted nothing, so it is not " +
            "accepted as a pass. Emit a final line such as \"12/12 assertions passed\", or a " +
            `"${EVIDENCE_SCHEMA}" sidecar, or add an exact, reasoned, temporary entry to evidence.allowlist.`,
        });
        continue;
      }
      candidates.push({ record, candidate, claimedId: candidate.claimedId ?? record.file });
    }

    // PASS 2 — identity collisions, BEFORE anything else is judged.
    //
    // This is deliberately its own pass. Checked inside the per-harness validation it would be
    // unreachable for the case that matters: a harness claiming another harness's id is also an
    // identity mismatch, so an early return there would report the mismatch and never notice
    // that two harnesses had claimed one identity.
    const claimants = new Map();
    for (const entry of candidates) {
      if (!claimants.has(entry.claimedId)) claimants.set(entry.claimedId, []);
      claimants.get(entry.claimedId).push(entry.record.file);
    }
    const collided = new Set();
    for (const [claimedId, files] of claimants) {
      if (files.length < 2) continue;
      for (const file of files) collided.add(file);
      findings.push({
        kind: "EVIDENCE_DUPLICATE_ID",
        harness: files.join(" == "),
        detail:
          `${files.length} harnesses produced evidence claiming the identity ${JSON.stringify(claimedId)}: ` +
          `${files.join(", ")}. Two harnesses cannot be the same harness, so at least one set of assertions ` +
          "is being counted under a name that does not belong to it. Neither claim is accepted.",
      });
    }

    // PASS 3 — validate what is left.
    for (const { record, candidate } of candidates) {
      if (collided.has(record.file)) continue;

      const validated = validateEvidence(record, candidate);
      findings.push(...validated.findings);
      if (!validated.evidence) continue;

      const evidence = validated.evidence;
      if (allowlisted.has(record.file)) {
        redundant.push({ file: record.file, form: evidence.form, assertions: evidence.assertions });
      }
      formCounts[evidence.form] = (formCounts[evidence.form] || 0) + 1;
      records2.push(evidence);
    }

    // Anything in the evidence directory that no executed harness claims is left over.
    for (const orphan of listOrphanSidecars(evidenceDir, records)) {
      findings.push({
        kind: "EVIDENCE_ORPHAN_SIDECAR",
        harness: orphan.harness,
        detail:
          `${orphan.relativePath} claims to be evidence for ${orphan.harness}, which this run did not execute. ` +
          "An evidence file with no matching execution is a leftover from an earlier run and must not sit next " +
          "to this run's artefacts where a reader would take it for current.",
      });
    }
  }

  const totalAssertions = records2.reduce((sum, e) => sum + e.assertions, 0);

  return {
    findings,
    block: {
      schema: EVIDENCE_SUMMARY_SCHEMA,
      required: evidenceConfig.required,
      enforced: executed && evidenceConfig.required,
      runId,
      evidenceDir: path.relative(APP_DIR, evidenceDir).split(path.sep).join("/"),
      contract:
        "Every harness counted as passed must yield machine-readable evidence carrying a harness identity and " +
        "a positive assertion count. Missing, malformed, duplicate, zero/negative, forged and stale evidence " +
        "each fail the run under their own named finding.",
      rejectionKinds: EVIDENCE_FINDING_KINDS,
      recognisedForms: EVIDENCE_LINE_FORMS.map((f) => f.name).concat(["json-report-count", "json-report-list", "sidecar-json"]),
      counts: {
        passedHarnesses: records.filter((r) => r.status === "passed").length,
        evidenced: records2.length,
        allowlisted: allowlistFiles.length,
        allowlistedAndExecuted: records
          .filter((r) => r.status === "passed" && allowlisted.has(r.file) && !redundant.some((x) => x.file === r.file))
          .length,
        unevidenced: unevidenced.length,
        totalAssertions,
        findings: findings.length,
      },
      formCounts,
      allowlist: {
        declaredSize: evidenceConfig.allowlistDeclaredSize,
        actualSize: allowlistFiles.length,
        files: allowlistFiles,
        entries: evidenceConfig.allowlist,
        redundant,
      },
      unevidenced,
      records: records2,
    },
  };
}

function readLogText(logPath) {
  try {
    return fs.readFileSync(logPath, "utf8");
  } catch {
    return "";
  }
}

function listOrphanSidecars(evidenceDir, records) {
  let names = [];
  try {
    names = fs.readdirSync(evidenceDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  } catch {
    return [];
  }
  const executedFiles = new Set(records.map((r) => r.file));
  const orphans = [];
  for (const name of names) {
    if (!name.endsWith(".evidence.json")) continue;
    const harness = name.slice(0, -".evidence.json".length);
    if (executedFiles.has(harness)) continue;
    orphans.push({
      harness,
      relativePath: path.relative(APP_DIR, path.join(evidenceDir, name)).split(path.sep).join("/"),
    });
  }
  return orphans;
}

// ---------------------------------------------------------------------------
// Location. Everything is derived from this file's own position on disk.
// ---------------------------------------------------------------------------

const GATES_DIR = __dirname;
const APP_DIR = path.resolve(GATES_DIR, "..", "..");
const REPO_ROOT = path.resolve(APP_DIR, "..");

function assertLayout() {
  const required = [
    path.join(APP_DIR, "package.json"),
    path.join(APP_DIR, "scripts", "tsconfig.checks.json"),
  ];
  for (const p of required) {
    if (!fs.existsSync(p)) {
      throw new Error(
        `Layout assertion failed: expected ${p} to exist. ` +
          `The driver resolved the app directory as ${APP_DIR} from its own location; ` +
          "if that is wrong, the file has been moved out of aiclone/scripts/gates/.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    packages: [],
    filterPattern: null,
    filterRaw: null,
    integrityOnly: false,
    list: false,
    acceptPartial: false,
    timeoutMs: null,
    manifestPath: path.join(GATES_DIR, "gates.manifest.json"),
    outRoot: path.join(GATES_DIR, "artifacts"),
    evidenceDir: null,
    help: false,
  };
  const unknown = [];

  for (const arg of argv) {
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg : arg.slice(0, eq);
    const value = eq === -1 ? null : arg.slice(eq + 1);

    switch (key) {
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--list":
        opts.list = true;
        break;
      case "--integrity-only":
        opts.integrityOnly = true;
        break;
      case "--accept-partial":
        opts.acceptPartial = true;
        break;
      case "--package":
      case "--packages":
        if (!value) unknown.push(`${key} requires a value`);
        else opts.packages.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
        break;
      case "--filter":
        if (!value) {
          unknown.push("--filter requires a value");
        } else {
          opts.filterRaw = value;
          const m = /^\/(.*)\/([a-z]*)$/u.exec(value);
          try {
            opts.filterPattern = m ? new RegExp(m[1], m[2] || "u") : new RegExp(escapeRe(value), "iu");
          } catch (error) {
            unknown.push(`--filter is not a valid regex: ${error.message}`);
          }
        }
        break;
      case "--timeout-ms":
        if (!value || !/^\d+$/.test(value) || Number(value) <= 0) unknown.push("--timeout-ms requires a positive integer");
        else opts.timeoutMs = Number(value);
        break;
      case "--manifest":
        if (!value) unknown.push("--manifest requires a path");
        else opts.manifestPath = path.resolve(APP_DIR, value);
        break;
      case "--out-dir":
        if (!value) unknown.push("--out-dir requires a path");
        else opts.outRoot = path.resolve(APP_DIR, value);
        break;
      default:
        unknown.push(`unrecognised argument ${arg}`);
    }
  }

  // Environment overrides exist so the failure-proof fixtures can point the
  // driver at a throwaway manifest without editing the committed one.
  if (process.env.GATES_MANIFEST) opts.manifestPath = path.resolve(APP_DIR, process.env.GATES_MANIFEST);
  if (process.env.GATES_OUT_DIR) opts.outRoot = path.resolve(APP_DIR, process.env.GATES_OUT_DIR);
  if (process.env.GATES_EVIDENCE_DIR) opts.evidenceDir = path.resolve(APP_DIR, process.env.GATES_EVIDENCE_DIR);

  return { opts, unknown };
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usage() {
  return [
    "Usage: node scripts/gates/run-gates.js [options]   (run from aiclone/)",
    "",
    "  --list                 print the declared inventory and exit; runs nothing",
    "  --integrity-only       reconcile manifest against disk and exit; runs nothing",
    "  --package=<a[,b]>      run only these manifest packages (PARTIAL run)",
    "  --filter=<text|/re/>   run only harnesses whose filename matches (PARTIAL run)",
    "  --accept-partial       allow a filtered run to exit 0; it stays stamped partial",
    "  --timeout-ms=<n>       override the per-harness timeout",
    "  --manifest=<path>      alternate manifest (relative to aiclone/)",
    "  --out-dir=<path>       alternate artefact root (relative to aiclone/)",
    "",
    "Environment:",
    "  GATES_DATABASE_NAME                 override the disposable target database name",
    "  GATES_ALLOW_UNRECOGNISED_DATABASE=1 permit a target whose name does not look disposable",
    "  GATES_MANIFEST / GATES_OUT_DIR      same as the flags above",
    "  GATES_EVIDENCE_DIR                  where harness evidence sidecars are read from and written to",
    "                                      (default <out-dir>/run-<stamp>/evidence)",
    "  GATES_SELFTEST_FAULT=<fault>        deliberately corrupt the driver's own bookkeeping",
    "                                      to prove a guard fires. Any faulted run is voided.",
    "",
    "Assertion-evidence contract: every harness counted as passed must emit a positive assertion",
    "count the driver can read (see EVIDENCE_* findings). Harnesses that emit none are named",
    "exactly, one by one, in the manifest's evidence.allowlist with a reason; nothing else is exempt.",
    "",
    "Exit codes: 0 green/clean, 1 harness failure, 2 inventory or safety failure, 3 unaccepted partial.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Repo facts (read-only git)
// ---------------------------------------------------------------------------

function gitRead(args) {
  const r = spawnSync("git", ["-C", REPO_ROOT, ...args], { encoding: "utf8", shell: false });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout).trim();
}

function repoFacts() {
  const head = gitRead(["rev-parse", "HEAD"]);
  const branch = gitRead(["rev-parse", "--abbrev-ref", "HEAD"]);
  const porcelain = gitRead(["status", "--porcelain"]);
  return {
    root: REPO_ROOT,
    appDir: APP_DIR,
    head: head || "unknown",
    branch: branch || "unknown",
    worktreeClean: porcelain === null ? null : porcelain === "",
    dirtyPathCount: porcelain === null ? null : porcelain.split(/\r?\n/).filter(Boolean).length,
  };
}

// ---------------------------------------------------------------------------
// Command construction. Explicit allowlist of runners; the manifest cannot
// inject an arbitrary command line.
// ---------------------------------------------------------------------------

function buildCommand(runner, harnessRelPath) {
  if (runner === "ts-node-checks") {
    const tsNodeBin = path.join(APP_DIR, "node_modules", "ts-node", "dist", "bin.js");
    if (!fs.existsSync(tsNodeBin)) {
      throw new Error(
        `ts-node is not installed at ${path.relative(APP_DIR, tsNodeBin)}. Run npm install in aiclone/ first.`,
      );
    }
    return {
      file: process.execPath,
      args: [tsNodeBin, "-r", "tsconfig-paths/register", harnessRelPath],
      env: { TS_NODE_PROJECT: "scripts/tsconfig.checks.json" },
    };
  }
  if (runner === "node") {
    return { file: process.execPath, args: [harnessRelPath], env: {} };
  }
  throw new Error(`Unsupported runner ${JSON.stringify(runner)}`);
}

function displayCommand(file, args) {
  const q = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [file, ...args].map(q).join(" ");
}

// ---------------------------------------------------------------------------
// Process-tree kill. Without this a timed-out ts-node keeps a database
// connection open and poisons the harness that runs next.
// ---------------------------------------------------------------------------

function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return "already-exited";
  try {
    if (process.platform === "win32") {
      const r = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        encoding: "utf8",
        shell: false,
      });
      return r.status === 0 ? "taskkill-tree" : `taskkill-failed(status=${r.status})`;
    }
    process.kill(-child.pid, "SIGKILL");
    return "kill-process-group";
  } catch (error) {
    try {
      child.kill("SIGKILL");
      return `fallback-direct-kill(${error.code || error.message})`;
    } catch {
      return "kill-failed";
    }
  }
}

function runHarness(entry, { runner, childEnv, timeoutMs, logPath, secretLiterals }) {
  const cmd = buildCommand(runner, entry.harnessRelPath);
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  return new Promise((resolve) => {
    const chunks = [];
    let capturedBytes = 0;
    let truncated = false;

    const child = spawn(cmd.file, cmd.args, {
      cwd: APP_DIR,
      env: { ...childEnv, ...cmd.env, GATES_HARNESS_ID: entry.file },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
    });

    const collect = (buf) => {
      if (capturedBytes >= MAX_CAPTURED_BYTES) {
        truncated = true;
        return;
      }
      chunks.push(buf);
      capturedBytes += buf.length;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    let timedOut = false;
    let killMethod = null;
    const timer = setTimeout(() => {
      timedOut = true;
      killMethod = killTree(child);
    }, timeoutMs);

    let spawnError = null;
    child.on("error", (error) => {
      spawnError = error;
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const endedAtMs = Date.now();

      let text = Buffer.concat(chunks).toString("utf8");
      if (truncated) {
        text += `\n[driver] OUTPUT TRUNCATED at ${MAX_CAPTURED_BYTES} bytes.\n`;
      }
      if (timedOut) {
        text += `\n[driver] TIMEOUT after ${timeoutMs}ms; child process tree killed via ${killMethod}.\n`;
      }
      if (spawnError) {
        text += `\n[driver] SPAWN ERROR: ${spawnError.message}\n`;
      }
      const redacted = redact(text, secretLiterals);
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.writeFileSync(logPath, redacted, "utf8");

      // A killed child reports code null + a signal. Surface a real, non-zero
      // number so nothing downstream can read "no code" as success.
      let exitCode = code;
      if (exitCode === null) exitCode = timedOut ? 124 : 128;
      if (spawnError) exitCode = 127;

      resolve({
        file: entry.file,
        package: entry.package,
        status: exitCode === 0 && !timedOut && !spawnError ? "passed" : "failed",
        exitCode,
        rawExitCode: code,
        signal: signal || null,
        timedOut,
        killMethod,
        spawnError: spawnError ? spawnError.message : null,
        startedAt,
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        timeoutMs,
        cwd: APP_DIR,
        command: [cmd.file, ...cmd.args],
        commandDisplay: displayCommand(cmd.file, cmd.args),
        commandEnvOverrides: Object.keys(cmd.env).sort(),
        logPath,
        logRelativePath: path.relative(APP_DIR, logPath).split(path.sep).join("/"),
        logBytes: Buffer.byteLength(redacted, "utf8"),
        outputTruncated: truncated,
        tail: tailOf(redacted, exitCode === 0),
      });
    });
  });
}

function tailOf(text, passed) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return "";
  const picked = passed
    ? (lines.filter((l) => /assertions? passed|invariants? passed|checks? passed|\bPASS\b|\d+\/\d+/i.test(l)).pop() ??
       lines[lines.length - 1])
    : lines.slice(-4).join(" | ");
  return picked.trim().replace(/\s+/g, " ").slice(0, 200);
}

// ---------------------------------------------------------------------------
// Result-integrity assertions. These run after execution and catch the failure
// modes that make a green sweep a lie.
// ---------------------------------------------------------------------------

function verifyResults(selected, records) {
  const findings = [];
  const byFile = new Map();

  for (const record of records) {
    if (byFile.has(record.file)) {
      findings.push({
        kind: "DUPLICATE_RESULT",
        harness: record.file,
        detail: `Two result records were produced for ${record.file}. The executed count cannot be trusted.`,
      });
      continue;
    }
    byFile.set(record.file, record);
  }

  for (const entry of selected) {
    const record = byFile.get(entry.file);
    if (!record) {
      findings.push({
        kind: "RESULT_MISSING",
        harness: entry.file,
        detail:
          `${entry.file} was selected to run but produced no result record. ` +
          "It was neither executed nor declared as a skip.",
      });
      continue;
    }
    if (typeof record.exitCode !== "number" || Number.isNaN(record.exitCode)) {
      findings.push({
        kind: "RESULT_EXIT_CODE_UNUSABLE",
        harness: entry.file,
        detail: `${entry.file} produced no usable exit code (${String(record.exitCode)}).`,
      });
    }
    let bytes = null;
    try {
      bytes = fs.statSync(record.logPath).size;
    } catch {
      bytes = null;
    }
    if (bytes === null) {
      findings.push({
        kind: "RESULT_LOG_MISSING",
        harness: entry.file,
        detail: `${entry.file} has no log file at ${record.logRelativePath}.`,
      });
    } else if (bytes === 0) {
      findings.push({
        kind: "RESULT_LOG_ZERO_BYTE",
        harness: entry.file,
        detail:
          `${entry.file} produced a zero-byte log. A harness that emits nothing cannot be ` +
          "shown to have asserted anything, so its exit 0 is not evidence.",
      });
    }
  }

  const selectedFiles = new Set(selected.map((e) => e.file));
  for (const record of records) {
    if (!selectedFiles.has(record.file)) {
      findings.push({
        kind: "RESULT_NOT_SELECTED",
        harness: record.file,
        detail: `A result exists for ${record.file}, which was not in the selected set.`,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Credential-leak assertion over everything the driver wrote.
// ---------------------------------------------------------------------------

function assertNoLeaks({ runDir, extraTexts, secretLiterals }) {
  const findings = [];
  let filesScanned = 0;
  let bytesScanned = 0;

  const scanFile = (absPath, fatalOnShape) => {
    let text;
    try {
      text = fs.readFileSync(absPath, "utf8");
    } catch {
      return;
    }
    filesScanned += 1;
    bytesScanned += Buffer.byteLength(text, "utf8");
    const label = path.relative(runDir, absPath).split(path.sep).join("/") || path.basename(absPath);
    for (const f of scanForLeaks(text, { secretLiterals, label })) {
      findings.push({ ...f, fatal: f.severity === "critical" || fatalOnShape });
    }
  };

  const walk = (dir) => {
    let items = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) walk(abs);
      // Driver-authored summaries are held to the strict standard; pass-through
      // harness logs are third-party text, so only a real credential is fatal
      // there (a fixture's fake password must not fail the gate).
      else if (item.isFile()) scanFile(abs, /^summary\.(json|md)$/.test(item.name));
    }
  };
  walk(runDir);

  for (const [label, text] of Object.entries(extraTexts || {})) {
    filesScanned += 1;
    bytesScanned += Buffer.byteLength(text, "utf8");
    for (const f of scanForLeaks(text, { secretLiterals, label })) {
      findings.push({ ...f, fatal: true });
    }
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const shapeCount = findings.filter((f) => f.severity === "shape").length;
  const fatalCount = findings.filter((f) => f.fatal).length;

  return {
    filesScanned,
    bytesScanned,
    criticalCount,
    shapeCount,
    fatalCount,
    passed: fatalCount === 0,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const consoleLines = [];
  const say = (line = "") => {
    consoleLines.push(line);
    process.stdout.write(`${line}\n`);
  };

  const { opts, unknown } = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return EXIT.OK;
  }
  if (unknown.length > 0) {
    process.stderr.write(`Argument error:\n  - ${unknown.join("\n  - ")}\n\n${usage()}\n`);
    return EXIT.INTEGRITY;
  }

  assertLayout();

  const fault = process.env.GATES_SELFTEST_FAULT || "";
  const startedAtMs = Date.now();
  const stamp = new Date(startedAtMs).toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  const runDir = path.join(opts.outRoot, `run-${stamp}`);
  const logDir = path.join(runDir, "logs");
  // Per-run nonce. This is what makes stale evidence detectable: a sidecar carrying any other
  // value was not produced by this execution, whatever its timestamp says.
  const runId = `run-${stamp}-${crypto.randomBytes(6).toString("hex")}`;
  const evidenceDir = opts.evidenceDir || path.join(runDir, "evidence");

  const repo = repoFacts();
  const manifest = loadManifest(opts.manifestPath);
  const harnessDirAbs = path.resolve(APP_DIR, manifest.harnessDir);
  const { entries, onDisk, findings: inventoryFindings } = reconcile(manifest, harnessDirAbs);

  const declaredSkips = entries.filter((e) => !e.run);
  const { selected, runnableCount, filtered } = applyFilter(entries, opts);
  const partial = filtered || opts.integrityOnly || opts.list;

  say(`gate sweep driver v${DRIVER_VERSION}`);
  say(`  app dir        ${APP_DIR}`);
  say(`  branch / HEAD  ${repo.branch} / ${repo.head.slice(0, 12)}`);
  say(`  manifest       ${path.relative(APP_DIR, opts.manifestPath).split(path.sep).join("/")} (sha256 ${manifest.sha256.slice(0, 12)})`);
  say(`  harness dir    ${manifest.harnessDir}  pattern ${manifest.harnessPattern}`);
  say(`  on disk ${onDisk.length}, manifest ${manifest.harnesses.length}, runnable ${runnableCount}, declared skips ${declaredSkips.length}`);
  if (fault) say(`  !! GATES_SELFTEST_FAULT=${fault} — THIS RUN IS VOID AND CANNOT ESTABLISH THE GATE`);

  // ---- inventory integrity gate: fail before spending 20 minutes -----------
  if (inventoryFindings.length > 0) {
    say("");
    say(`INVENTORY INTEGRITY FAILURE — ${inventoryFindings.length} finding(s); enumerated below.`);
  }

  if (opts.list) {
    say("");
    say("declared inventory:");
    for (const e of entries) {
      say(`  ${e.run ? "RUN " : "SKIP"} ${e.file.padEnd(48)} ${e.package}${e.run ? "" : `  <- ${e.skip.reason}`}`);
    }
  }

  // ---- database target: assert before anything is spawned -----------------
  let dbTarget = null;
  let dbError = null;
  const needDatabase = !opts.list && !opts.integrityOnly && manifest.requiresDatabase;
  if (needDatabase || opts.integrityOnly || opts.list) {
    try {
      loadDotenv();
      dbTarget = resolveDatabaseTarget({ env: process.env, defaultDatabaseName: manifest.databaseName });
      say(`  target db      ${dbTarget.databaseName} (${dbTarget.source})${dbTarget.rewritten ? " [rewritten from .env]" : ""}`);
    } catch (error) {
      if (!(error instanceof DatabaseTargetError)) throw error;
      dbError = error.message;
      if (needDatabase) {
        say("");
        say(`DATABASE TARGET FAILURE: ${dbError}`);
      } else {
        say(`  target db      unavailable (${dbError})`);
      }
    }
  }

  const secretLiterals = collectSecretLiterals(process.env);

  // ---- execution ----------------------------------------------------------
  const records = [];
  const executionBlocked = inventoryFindings.length > 0 || (needDatabase && dbError !== null);

  if (!opts.list && !opts.integrityOnly && !executionBlocked) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const childEnv = {
      ...process.env,
      // The evidence channel. A harness may write <GATES_EVIDENCE_DIR>/<its own filename>.evidence.json
      // stamped with GATES_RUN_ID; anything carrying another run's id is rejected as stale.
      GATES_RUN_ID: runId,
      GATES_EVIDENCE_DIR: evidenceDir,
      GATES_EVIDENCE_SCHEMA: EVIDENCE_SCHEMA,
    };
    if (dbTarget) {
      childEnv.DATABASE_URL = dbTarget.effectiveUrl;
    } else {
      // No validated target was resolved, which is the `requiresDatabase: false` manifest shape
      // that lib/inventory.js explicitly admits. Two things must NOT happen here.
      //
      // 1. This used to read dbTarget.effectiveUrl unconditionally and die on an unhandled
      //    TypeError, printing a stack trace and writing no summary at all - a crash rather than a
      //    diagnosed condition, in the one file whose job is to produce a trustworthy verdict.
      //
      // 2. Falling back to the ambient DATABASE_URL would be worse than the crash. That value has
      //    NOT been through resolveDatabaseTarget, so it has passed neither the `personalink`
      //    denylist nor the disposable-name assertion: a manifest that merely declines to require a
      //    database would silently hand every harness whatever aiclone/.env points at. So the
      //    variable is WITHHELD instead of forwarded. A harness that unexpectedly reaches for a
      //    database then fails for want of a connection string, which is the safe direction.
      delete childEnv.DATABASE_URL;
    }
    say("");
    say(`running ${selected.length} harness(es) serially, timeout ${fmtMs(opts.timeoutMs || manifest.defaultTimeoutMs)} each`);
    say(`  evidence run id ${runId}`);
    say("");

    for (let i = 0; i < selected.length; i += 1) {
      const entry = selected[i];
      const record = await runHarness(
        { ...entry, harnessRelPath: `${manifest.harnessDir}/${entry.file}`.replace(/\\/g, "/") },
        {
          runner: manifest.runner,
          childEnv,
          timeoutMs: opts.timeoutMs || entry.timeoutMs,
          logPath: path.join(logDir, entry.file.replace(/\.[^.]+$/, "") + ".log"),
          secretLiterals,
        },
      );
      records.push(record);
      say(
        `[${String(i + 1).padStart(3)}/${selected.length}] ` +
          `${record.status === "passed" ? "ok  " : "FAIL"} ` +
          `${record.file.padEnd(48)} exit ${String(record.exitCode).padStart(3)}  ` +
          `${fmtMs(record.durationMs).padStart(7)}  ${record.logBytes}B` +
          `${record.timedOut ? "  TIMEOUT" : ""}`,
      );
    }

    applySelfTestFault(fault, records, say);
  }

  // ---- result integrity ---------------------------------------------------
  const resultFindings = opts.list || opts.integrityOnly || executionBlocked
    ? []
    : verifyResults(selected, records);

  // ---- assertion-evidence contract ----------------------------------------
  // Runs even in --list / --integrity-only mode, because the allowlist's shape, exactness,
  // on-disk existence and declared size are all checkable without executing anything, and a
  // 20-minute sweep should not be how you discover the allowlist names a deleted file.
  const evidenceExecuted = !opts.list && !opts.integrityOnly && !executionBlocked && manifest.evidence.required;
  const evidenceResult = evaluateEvidence({
    records,
    manifest,
    onDisk,
    evidenceDir,
    runId,
    executed: evidenceExecuted,
  });
  const evidenceByHarness = new Map(evidenceResult.block.records.map((e) => [e.harness, e]));
  for (const record of records) {
    record.evidence = evidenceByHarness.get(record.file) || null;
  }

  const integrityFindings = [...inventoryFindings, ...resultFindings, ...evidenceResult.findings];
  if (needDatabase && dbError) {
    integrityFindings.push({ kind: "DATABASE_TARGET_REFUSED", detail: dbError });
  }

  // ---- summary ------------------------------------------------------------
  const endedAtMs = Date.now();
  const passed = records.filter((r) => r.status === "passed").length;
  const failed = records.filter((r) => r.status === "failed").length;
  const timedOut = records.filter((r) => r.timedOut).length;

  let verdict;
  let exitCode;
  if (integrityFindings.length > 0) {
    verdict = "INTEGRITY-FAILURE";
    exitCode = EXIT.INTEGRITY;
  } else if (failed > 0) {
    verdict = "FAIL";
    exitCode = EXIT.HARNESS_FAILED;
  } else if (opts.list) {
    verdict = "LIST-ONLY";
    exitCode = EXIT.OK;
  } else if (opts.integrityOnly) {
    verdict = "INTEGRITY-OK";
    exitCode = EXIT.OK;
  } else if (filtered) {
    verdict = "PARTIAL-PASS";
    exitCode = opts.acceptPartial ? EXIT.OK : EXIT.PARTIAL;
  } else {
    verdict = "PASS";
    exitCode = EXIT.OK;
  }

  const gateEstablished =
    verdict === "PASS" && !partial && !fault && selected.length === runnableCount && runnableCount > 0;
  const gateNotEstablishedReason = gateEstablished
    ? null
    : fault
      ? `a self-test fault (${fault}) was injected, so this run is void`
      : integrityFindings.length > 0
        ? "the inventory or safety layer failed; the counts are not trustworthy"
        : failed > 0
          ? `${failed} harness(es) failed`
          : opts.list
            ? "--list was requested; nothing was executed"
            : opts.integrityOnly
              ? "--integrity-only was requested; nothing was executed"
              : filtered
                ? `a filter selected ${selected.length} of ${runnableCount} runnable harnesses`
                : "no harnesses were executed";

  const summary = {
    schema: "personai.gates.summary/1",
    verdict,
    exitCode,
    gateEstablished,
    gateNotEstablishedReason,
    partial,
    selfTestFault: fault || null,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    driver: {
      version: DRIVER_VERSION,
      relativePath: "scripts/gates/run-gates.js",
      absolutePath: path.join(GATES_DIR, "run-gates.js"),
      invocation: process.argv.slice(2),
    },
    repo,
    host: { node: process.version, platform: `${os.platform()} ${os.release()}`, arch: os.arch(), cpus: os.cpus().length },
    manifest: {
      relativePath: path.relative(APP_DIR, opts.manifestPath).split(path.sep).join("/"),
      sha256: manifest.sha256,
      manifestVersion: manifest.manifestVersion,
      harnessDir: manifest.harnessDir,
      harnessPattern: manifest.harnessPattern,
      runner: manifest.runner,
      defaultTimeoutMs: opts.timeoutMs || manifest.defaultTimeoutMs,
    },
    database: dbTarget
      ? {
          name: dbTarget.databaseName,
          source: dbTarget.source,
          rewrittenFromEnv: dbTarget.rewritten,
          unrecognisedOverride: dbTarget.unrecognisedOverride,
          note: "Only the database NAME is recorded. No DSN, host, user or password is written by this driver.",
        }
      : { name: null, source: "unresolved", note: dbError || "not required for this mode" },
    filter: {
      packages: opts.packages,
      pattern: opts.filterRaw,
      applied: filtered,
      acceptPartial: opts.acceptPartial,
    },
    counts: {
      onDisk: onDisk.length,
      manifestEntries: manifest.harnesses.length,
      runnable: runnableCount,
      declaredSkips: declaredSkips.length,
      selected: selected.length,
      executed: records.length,
      passed,
      failed,
      timedOut,
    },
    expected: manifest.expected,
    evidence: evidenceResult.block,
    declaredSkips: declaredSkips.map((e) => ({ file: e.file, package: e.package, skip: e.skip })),
    integrityFindings,
    harnesses: [
      ...records,
      ...declaredSkips.map((e) => ({
        file: e.file,
        package: e.package,
        status: "skipped",
        exitCode: null,
        durationMs: null,
        startedAt: null,
        endedAt: null,
        logBytes: null,
        skip: e.skip,
      })),
    ],
    secretScan: null,
  };

  // Expectation check: the manifest records the inventory this repository
  // believes it has, so an inventory drift is loud rather than absorbed.
  if (manifest.expected && !opts.list && !opts.integrityOnly && !executionBlocked) {
    const e = manifest.expected;
    if (Number.isInteger(e.executedChecks) && !filtered && records.length !== e.executedChecks) {
      integrityFindings.push({
        kind: "EXECUTED_COUNT_DRIFT",
        detail:
          `Manifest expects ${e.executedChecks} executed checks; this run executed ${records.length}. ` +
          "Investigate the difference — do not edit the expectation to match.",
      });
    }
    /*
     * THE OTHER TWO EXPECTATIONS WERE DECORATIVE, AND THAT LEFT A REAL HOLE.
     *
     * Only `executedChecks` was read. Flipping an existing run:true to run:false WAS caught, because
     * executed drops below the expectation. But ADDING a new harness file together with a run:false
     * entry and a plausible skip reason was NOT: on-disk becomes 76, runnable stays 74, executed stays
     * 74, declaredSkips becomes 2 against an expectation of 1 that nothing read, and the run reported
     * gateEstablished: true. A harness could be added to this repository and silently never run.
     *
     * Both are asserted now, with the same "investigate, do not edit the expectation" wording. One
     * third of a block being enforced is worse than none, because the manifest says the block is
     * derived from the declared inventory and a reader takes all of it as checked.
     */
    if (Number.isInteger(e.harnessesOnDisk) && onDisk.length !== e.harnessesOnDisk) {
      integrityFindings.push({
        kind: "ON_DISK_COUNT_DRIFT",
        detail:
          `Manifest expects ${e.harnessesOnDisk} harnesses on disk; found ${onDisk.length}. ` +
          "Investigate the difference - do not edit the expectation to match.",
      });
    }
    if (Number.isInteger(e.declaredSkips)) {
      const declaredSkipCount = manifest.harnesses.filter((entry) => !entry.run).length;
      if (declaredSkipCount !== e.declaredSkips) {
        integrityFindings.push({
          kind: "DECLARED_SKIP_COUNT_DRIFT",
          detail:
            `Manifest expects ${e.declaredSkips} declared skip(s); it now declares ${declaredSkipCount}. ` +
            "A new skip must be a deliberate reviewed decision - do not edit the expectation to match.",
        });
      }
    }
  }

  // Written once here so a summary exists on disk even if the scan below throws;
  // rewritten at the end once the scan and expectation checks have had their say.
  writeSummaries(runDir, summary);

  // ---- credential-leak assertion, including the failure path --------------
  const scan = assertNoLeaks({
    runDir,
    extraTexts: { "driver-console": consoleLines.join("\n") },
    secretLiterals,
  });
  summary.secretScan = scan;
  if (!scan.passed) {
    integrityFindings.push({
      kind: "CREDENTIAL_LEAK",
      detail:
        `${scan.fatalCount} credential-shaped span(s) survived redaction in driver output ` +
        "(secret values are not reproduced here; see secretScan.findings for redacted samples).",
    });
  }

  // Recompute the verdict now that the scan and expectation checks may have
  // added findings, then rewrite both summaries so the files on disk are final.
  if (integrityFindings.length > 0 && summary.verdict !== "INTEGRITY-FAILURE") {
    summary.verdict = "INTEGRITY-FAILURE";
    summary.exitCode = EXIT.INTEGRITY;
    summary.gateEstablished = false;
    summary.gateNotEstablishedReason = "the inventory or safety layer failed; the counts are not trustworthy";
  }
  summary.integrityFindings = integrityFindings;
  const finalPaths = writeSummaries(runDir, summary);
  fs.copyFileSync(finalPaths.jsonPath, path.join(opts.outRoot, "latest.json"));
  fs.copyFileSync(finalPaths.mdPath, path.join(opts.outRoot, "latest.md"));

  // ---- console tail -------------------------------------------------------
  const rel = (p) => path.relative(APP_DIR, p).split(path.sep).join("/");
  process.stdout.write("\n");
  if (integrityFindings.length > 0) {
    process.stdout.write(`INTEGRITY FINDINGS (${integrityFindings.length}):\n`);
    for (const f of integrityFindings) {
      process.stdout.write(`  ${f.kind}${f.harness ? ` ${f.harness}` : ""}: ${f.detail}\n`);
    }
    process.stdout.write("\n");
  }
  for (const r of records.filter((x) => x.status === "failed")) {
    process.stdout.write(`FAILED: ${r.file} (exit ${r.exitCode}) -> ${r.logRelativePath}\n`);
  }
  process.stdout.write(`TOTAL ${records.length} checks, FAILED ${failed}\n`);
  process.stdout.write(
    `SKIPPED (declared): ${declaredSkips.length}${declaredSkips.length ? ` -> ${declaredSkips.map((s) => s.file).join(", ")}` : ""}\n`,
  );
  const ev = summary.evidence;
  process.stdout.write(
    `assertion evidence: ${ev.enforced ? "ENFORCED" : "not evaluated (nothing was executed)"}` +
      `${ev.enforced ? ` — ${ev.counts.evidenced}/${ev.counts.passedHarnesses} passed harness(es) carried evidence, ` +
        `${ev.counts.totalAssertions} assertions counted, ${ev.counts.unevidenced} unevidenced` : ""}\n`,
  );
  // Printed in full, every run: an allowlist whose contents are not on the console can grow
  // without anyone noticing, and its size is the honest measure of what this gate does NOT check.
  process.stdout.write(
    `evidence allowlist: ${ev.allowlist.actualSize} entr${ev.allowlist.actualSize === 1 ? "y" : "ies"} ` +
      `(declared ${ev.allowlist.declaredSize === null ? "none" : ev.allowlist.declaredSize})` +
      `${ev.allowlist.actualSize ? ` -> ${ev.allowlist.files.join(", ")}` : ""}\n`,
  );
  if (ev.allowlist.redundant.length > 0) {
    process.stdout.write(
      `evidence allowlist REDUNDANT (these emit evidence after all; delete the entries): ` +
        `${ev.allowlist.redundant.map((r) => `${r.file} (${r.form}, ${r.assertions})`).join(", ")}\n`,
    );
  }
  process.stdout.write(`credential scan: ${scan.passed ? "clean" : "LEAK"} (${scan.filesScanned} artefacts, ${scan.criticalCount} critical)\n`);
  process.stdout.write(`verdict ${summary.verdict}; gate ${summary.gateEstablished ? "ESTABLISHED" : `NOT established — ${summary.gateNotEstablishedReason}`}\n`);
  process.stdout.write(`json  ${rel(finalPaths.jsonPath)}\nmd    ${rel(finalPaths.mdPath)}\nlatest ${rel(path.join(opts.outRoot, "latest.json"))}, ${rel(path.join(opts.outRoot, "latest.md"))}\n`);

  return summary.exitCode;
}

/** dotenv is already a dependency of the app; no new package is introduced. */
function loadDotenv() {
  const envPath = path.join(APP_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  let dotenv;
  try {
    dotenv = require(path.join(APP_DIR, "node_modules", "dotenv"));
  } catch {
    return; // DATABASE_URL may still be exported in the shell
  }
  dotenv.config({ path: envPath, quiet: true });
}

/**
 * Deliberate corruption of the driver's own bookkeeping, so the guards that
 * cannot be triggered from outside can still be proven to fire. Any run with a
 * fault injected is stamped void in the summary.
 */
function applySelfTestFault(fault, records, say) {
  if (!fault) return;
  if (fault === "drop-result") {
    const dropped = records.pop();
    say(`  !! selftest: dropped the result record for ${dropped ? dropped.file : "(none)"}`);
  } else if (fault === "duplicate-result") {
    if (records.length > 0) {
      records.push({ ...records[0] });
      say(`  !! selftest: duplicated the result record for ${records[0].file}`);
    }
  } else if (fault === "zero-byte-log") {
    if (records.length > 0) {
      fs.writeFileSync(records[0].logPath, "", "utf8");
      say(`  !! selftest: truncated ${records[0].logRelativePath} to zero bytes`);
    }
  } else if (fault === "leak") {
    say(`  !! selftest: emitting a synthetic connection string to prove the leak assertion fires`);
    say(`  postgresql://gateuser:sup3rs3cr3t@127.0.0.1:5432/${"synthetic_target"}`);
  } else {
    say(`  !! selftest: unknown fault ${JSON.stringify(fault)} — ignored, but this run is still void`);
  }
}

// Exported so the self-test can probe the evidence parser directly, against the exact
// output shapes the real harnesses print. Nothing else requires this file.
module.exports = {
  DRIVER_VERSION,
  EVIDENCE_SCHEMA,
  EVIDENCE_SUMMARY_SCHEMA,
  EVIDENCE_FINDING_KINDS,
  EVIDENCE_LINE_FORMS,
  EVIDENCE_JSON_COUNT_KEYS,
  ALLOWLIST_FORBIDDEN_CHARS,
  extractLastJsonObject,
  parseEvidenceFromLog,
  validateEvidence,
  verifyAllowlist,
  toInteger,
};

// Guarded so `require()`ing this file for the parser does not launch a sweep.
if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      const literals = collectSecretLiterals(process.env);
      // Failure path is redacted too: a stack trace can carry a DSN in an argument.
      process.stderr.write(`${redact(String(error && error.stack ? error.stack : error), literals)}\n`);
      process.exit(EXIT.INTEGRITY);
    });
}
