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
const { spawn, spawnSync } = require("node:child_process");

const { loadManifest, reconcile, applyFilter } = require("./lib/inventory");
const { resolveDatabaseTarget, DatabaseTargetError } = require("./lib/db-target");
const { collectSecretLiterals, redact, scanForLeaks } = require("./lib/redact");
const { writeSummaries, fmtMs } = require("./lib/report");

const DRIVER_VERSION = "1.0.0";
const MAX_CAPTURED_BYTES = 16 * 1024 * 1024;

const EXIT = { OK: 0, HARNESS_FAILED: 1, INTEGRITY: 2, PARTIAL: 3 };

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
    "  GATES_SELFTEST_FAULT=<fault>        deliberately corrupt the driver's own bookkeeping",
    "                                      to prove a guard fires. Any faulted run is voided.",
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
      env: { ...childEnv, ...cmd.env },
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
    const childEnv = { ...process.env, DATABASE_URL: dbTarget.effectiveUrl };
    say("");
    say(`running ${selected.length} harness(es) serially, timeout ${fmtMs(opts.timeoutMs || manifest.defaultTimeoutMs)} each`);
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

  const integrityFindings = [...inventoryFindings, ...resultFindings];
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

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    const literals = collectSecretLiterals(process.env);
    // Failure path is redacted too: a stack trace can carry a DSN in an argument.
    process.stderr.write(`${redact(String(error && error.stack ? error.stack : error), literals)}\n`);
    process.exit(EXIT.INTEGRITY);
  });
