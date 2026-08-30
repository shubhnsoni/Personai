"use strict";

/**
 * Manifest loading, validation and reconciliation against the working tree.
 *
 * The manifest is the answer to "why is this harness not run?". Every harness on
 * disk must have an entry; every entry must have a file on disk; every entry with
 * run:false must carry a reason. Any mismatch is a hard failure, never a silent
 * omission — that is the whole point of committing this file.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RUNNERS = new Set(["ts-node-checks", "node"]);
const DEFAULT_TIMEOUT_MS = 900_000;

class ManifestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ManifestError";
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function loadManifest(manifestPath) {
  let raw;
  try {
    raw = fs.readFileSync(manifestPath);
  } catch (error) {
    throw new ManifestError(`Cannot read manifest at ${manifestPath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new ManifestError(`Manifest is not valid JSON (${manifestPath}): ${error.message}`);
  }

  const problems = [];
  const req = (cond, message) => {
    if (!cond) problems.push(message);
  };

  req(parsed.manifestVersion === 1, "manifestVersion must be 1");
  req(typeof parsed.harnessDir === "string" && parsed.harnessDir !== "", "harnessDir must be a non-empty string");
  req(typeof parsed.harnessPattern === "string" && parsed.harnessPattern !== "", "harnessPattern must be a non-empty regex string");
  req(RUNNERS.has(parsed.runner), `runner must be one of ${[...RUNNERS].join(", ")}`);
  req(Array.isArray(parsed.harnesses) && parsed.harnesses.length > 0, "harnesses must be a non-empty array");
  req(
    parsed.expected === undefined ||
      (typeof parsed.expected === "object" && parsed.expected !== null),
    "expected, when present, must be an object",
  );

  if (problems.length > 0) {
    throw new ManifestError(`Manifest is malformed (${manifestPath}):\n  - ${problems.join("\n  - ")}`);
  }

  let pattern;
  try {
    pattern = new RegExp(parsed.harnessPattern, "u");
  } catch (error) {
    throw new ManifestError(`harnessPattern is not a valid regex: ${error.message}`);
  }

  const entryProblems = [];
  const seen = new Map();
  const harnesses = parsed.harnesses.map((entry, index) => {
    const where = `harnesses[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      entryProblems.push(`${where} is not an object`);
      return null;
    }
    const file = entry.file;
    if (typeof file !== "string" || file === "") {
      entryProblems.push(`${where}.file must be a non-empty string`);
      return null;
    }
    if (file.includes("/") || file.includes("\\") || file.includes("..")) {
      entryProblems.push(`${where}.file must be a bare filename, got ${JSON.stringify(file)}`);
      return null;
    }
    if (!pattern.test(file)) {
      entryProblems.push(`${where}.file ${JSON.stringify(file)} does not match harnessPattern`);
    }
    if (seen.has(file)) {
      entryProblems.push(
        `${where}.file ${JSON.stringify(file)} is a DUPLICATE manifest entry (first seen at harnesses[${seen.get(file)}])`,
      );
    } else {
      seen.set(file, index);
    }
    if (typeof entry.package !== "string" || entry.package === "") {
      entryProblems.push(`${where}.package must be a non-empty string`);
    }
    if (typeof entry.run !== "boolean") {
      entryProblems.push(`${where}.run must be an explicit boolean`);
    }
    if (entry.run === false) {
      const skip = entry.skip;
      if (typeof skip !== "object" || skip === null) {
        entryProblems.push(`${where} has run:false but no skip block — a skip must be declared and reasoned`);
      } else {
        for (const field of ["reason", "requires", "howToRunManually", "declaredBy"]) {
          if (typeof skip[field] !== "string" || skip[field].trim() === "") {
            entryProblems.push(`${where}.skip.${field} must be a non-empty string`);
          }
        }
      }
    } else if (entry.skip !== undefined) {
      entryProblems.push(`${where} has run:true but also a skip block — ambiguous`);
    }
    if (entry.timeoutMs !== undefined && (!Number.isInteger(entry.timeoutMs) || entry.timeoutMs <= 0)) {
      entryProblems.push(`${where}.timeoutMs must be a positive integer when present`);
    }
    return {
      file,
      package: entry.package,
      run: entry.run,
      skip: entry.skip,
      timeoutMs: entry.timeoutMs,
    };
  });

  if (entryProblems.length > 0) {
    throw new ManifestError(`Manifest entries are invalid (${manifestPath}):\n  - ${entryProblems.join("\n  - ")}`);
  }

  const defaults = parsed.defaults && typeof parsed.defaults === "object" ? parsed.defaults : {};
  const defaultTimeoutMs = Number.isInteger(defaults.timeoutMs) && defaults.timeoutMs > 0
    ? defaults.timeoutMs
    : DEFAULT_TIMEOUT_MS;

  return {
    path: manifestPath,
    sha256: sha256(raw),
    bytes: raw.length,
    manifestVersion: parsed.manifestVersion,
    description: typeof parsed.description === "string" ? parsed.description : "",
    harnessDir: parsed.harnessDir,
    harnessPattern: parsed.harnessPattern,
    pattern,
    runner: parsed.runner,
    defaultTimeoutMs,
    databaseName: typeof defaults.databaseName === "string" ? defaults.databaseName : "",
    requiresDatabase: defaults.requiresDatabase !== false,
    expected: parsed.expected && typeof parsed.expected === "object" ? parsed.expected : null,
    harnesses: harnesses.filter(Boolean),
  };
}

/**
 * Reconcile the manifest against what is actually on disk.
 * Returns { entries, findings } where findings is a list of integrity failures.
 */
function reconcile(manifest, harnessDirAbs) {
  const findings = [];

  let onDisk = [];
  try {
    onDisk = fs
      .readdirSync(harnessDirAbs, { withFileTypes: true })
      .filter((d) => d.isFile() && manifest.pattern.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch (error) {
    findings.push({
      kind: "HARNESS_DIR_UNREADABLE",
      detail: `Cannot read harness directory ${harnessDirAbs}: ${error.message}`,
    });
    return { entries: [], onDisk: [], findings };
  }

  const manifestFiles = new Set(manifest.harnesses.map((h) => h.file));

  for (const entry of manifest.harnesses) {
    if (!onDisk.includes(entry.file)) {
      findings.push({
        kind: "MANIFEST_ENTRY_MISSING_ON_DISK",
        harness: entry.file,
        detail:
          `Manifest lists ${entry.file} but no such file exists in ${manifest.harnessDir}. ` +
          "Either the harness was deleted without updating the manifest, or the manifest has a typo.",
      });
    }
  }

  for (const file of onDisk) {
    if (!manifestFiles.has(file)) {
      findings.push({
        kind: "ON_DISK_NOT_IN_MANIFEST",
        harness: file,
        detail:
          `${manifest.harnessDir}/${file} exists but has no manifest entry. ` +
          "A harness must be declared to run, or declared skipped with a reason. Silent omission is a failure.",
      });
    }
  }

  // Content-identical harnesses: a copied harness inflates the green count without
  // adding coverage, so it is reported as a duplicate rather than counted twice.
  const byHash = new Map();
  for (const file of onDisk) {
    let digest;
    try {
      digest = sha256(fs.readFileSync(path.join(harnessDirAbs, file)));
    } catch (error) {
      findings.push({
        kind: "HARNESS_UNREADABLE",
        harness: file,
        detail: `Cannot hash ${file}: ${error.message}`,
      });
      continue;
    }
    if (!byHash.has(digest)) byHash.set(digest, []);
    byHash.get(digest).push(file);
  }
  for (const [digest, files] of byHash) {
    if (files.length > 1) {
      findings.push({
        kind: "DUPLICATE_HARNESS_CONTENT",
        harness: files.join(" == "),
        detail:
          `${files.length} harnesses are byte-identical (sha256 ${digest.slice(0, 12)}…): ${files.join(", ")}. ` +
          "A duplicated harness inflates the executed count without adding coverage.",
      });
    }
  }

  const entries = manifest.harnesses
    .filter((h) => onDisk.includes(h.file))
    .map((h) => ({
      file: h.file,
      package: h.package,
      run: h.run,
      skip: h.skip || null,
      timeoutMs: h.timeoutMs || manifest.defaultTimeoutMs,
      absolutePath: path.join(harnessDirAbs, h.file),
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return { entries, onDisk, findings };
}

/**
 * Apply a package/name filter. Returns { selected, filtered } where `filtered`
 * is true when the filter narrowed the set — the caller MUST mark such a run
 * partial, because a filtered run can never establish the gate.
 */
/**
 * Narrows the runnable set to the requested packages and/or filter pattern.
 *
 * AN UNRECOGNISED PACKAGE NAME IS AN ERROR, NOT AN EMPTY SELECTION. Before this it was neither
 * validated nor detected: `--package=fieldjobs` (the real package is `fieldjob`) selected zero
 * harnesses, `verifyResults` iterated an empty list and found nothing to complain about, the
 * executed-count drift check is skipped whenever a filter is active, and the verdict was PARTIAL-PASS
 * - which with `--accept-partial` is exit 0 printing "TOTAL 0 checks, FAILED 0". A green exit code
 * having run nothing is the worst failure mode a gate driver has, because the exit code is the
 * machine-readable signal and a typo produced it.
 *
 * The declared package set is right there in the manifest, so this is checkable rather than a matter
 * of trust. An empty selection is likewise refused: whatever the caller meant, they did not mean
 * "verify nothing and call it a pass".
 */
function applyFilter(entries, { packages, filterPattern }) {
  const runnable = entries.filter((e) => e.run);
  let selected = runnable;

  if (packages && packages.length > 0) {
    const declared = new Set(entries.map((e) => String(e.package ?? "").toLowerCase()));
    const unknown = packages.filter((p) => !declared.has(String(p).toLowerCase()));
    if (unknown.length > 0) {
      throw new ManifestError(
        `Unknown --package value(s): ${unknown.join(", ")}. Declared packages: ` +
          `${[...declared].filter(Boolean).sort().join(", ")}`,
      );
    }
    const wanted = new Set(packages.map((p) => p.toLowerCase()));
    selected = selected.filter((e) => wanted.has(e.package.toLowerCase()));
  }
  if (filterPattern) {
    selected = selected.filter((e) => filterPattern.test(e.file));
  }

  if (selected.length === 0) {
    throw new ManifestError(
      "The requested filter selected 0 runnable harnesses. Refusing to report a pass over an empty " +
        "selection - narrow the filter deliberately or drop it.",
    );
  }

  return {
    selected,
    runnableCount: runnable.length,
    filtered: selected.length !== runnable.length,
  };
}

module.exports = {
  ManifestError,
  DEFAULT_TIMEOUT_MS,
  RUNNERS,
  sha256,
  loadManifest,
  reconcile,
  applyFilter,
};
