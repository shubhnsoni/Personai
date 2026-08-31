"use strict";

/**
 * JSON + Markdown summary emission.
 *
 * Both summaries are build artefacts, not source. They land under
 * scripts/gates/artifacts/, which is gitignored by scripts/gates/.gitignore
 * (same convention as docs/orchestration/.gitignore: a scoped ignore file with
 * the reason written next to it).
 */

const fs = require("node:fs");
const path = require("node:path");

function fmtMs(ms) {
  if (!Number.isFinite(ms)) return "-";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

function statusMark(record) {
  if (record.status === "passed") return "ok";
  if (record.status === "skipped") return "SKIP";
  if (record.timedOut) return "TIMEOUT";
  return "FAIL";
}

function buildMarkdown(summary) {
  const L = [];
  const gate = summary.gateEstablished
    ? "GATE ESTABLISHED — full sweep, all executed harnesses green"
    : `GATE NOT ESTABLISHED — ${summary.gateNotEstablishedReason}`;

  L.push("# Gate sweep summary");
  L.push("");
  L.push(`- **Verdict:** \`${summary.verdict}\` (exit code ${summary.exitCode})`);
  L.push(`- **${gate}**`);
  if (summary.partial) {
    L.push(
      "- **PARTIAL RUN.** A filter was applied, so this run selected " +
        `${summary.counts.executed} of ${summary.counts.runnable} runnable harnesses. ` +
        "A partial run cannot be quoted as the sweep result.",
    );
  }
  L.push(`- Started ${summary.startedAt} → ended ${summary.endedAt} (${fmtMs(summary.durationMs)})`);
  L.push("");
  L.push("## Context");
  L.push("");
  L.push("| field | value |");
  L.push("|---|---|");
  L.push(`| driver | \`${summary.driver.relativePath}\` v${summary.driver.version} |`);
  L.push(`| repo root | \`${summary.repo.root}\` |`);
  L.push(`| app dir | \`${summary.repo.appDir}\` |`);
  L.push(`| branch | \`${summary.repo.branch}\` |`);
  L.push(`| HEAD | \`${summary.repo.head}\` |`);
  L.push(`| worktree clean | ${summary.repo.worktreeClean === null ? "unknown" : summary.repo.worktreeClean} |`);
  L.push(`| manifest | \`${summary.manifest.relativePath}\` (sha256 ${summary.manifest.sha256.slice(0, 16)}…) |`);
  L.push(`| harness dir | \`${summary.manifest.harnessDir}\` matching \`${summary.manifest.harnessPattern}\` |`);
  L.push(`| runner | \`${summary.manifest.runner}\` |`);
  L.push(`| target database | \`${summary.database.name}\` (${summary.database.source}) |`);
  L.push(`| node | ${summary.host.node} on ${summary.host.platform} |`);
  L.push(`| per-harness timeout | ${fmtMs(summary.manifest.defaultTimeoutMs)} |`);
  L.push(`| concurrency | serial (1) — see README, global-row-count harnesses cannot share a database |`);
  L.push("");
  L.push("## Counts");
  L.push("");
  L.push("| metric | count |");
  L.push("|---|---|");
  L.push(`| harnesses on disk | ${summary.counts.onDisk} |`);
  L.push(`| manifest entries | ${summary.counts.manifestEntries} |`);
  L.push(`| declared runnable | ${summary.counts.runnable} |`);
  L.push(`| declared skips | ${summary.counts.declaredSkips} |`);
  L.push(`| executed | ${summary.counts.executed} |`);
  L.push(`| **passed** | **${summary.counts.passed}** |`);
  L.push(`| **FAILED** | **${summary.counts.failed}** |`);
  L.push(`| timed out | ${summary.counts.timedOut} |`);
  L.push(`| integrity findings | ${summary.integrityFindings.length} |`);
  if (summary.evidence) {
    L.push(`| harnesses carrying assertion evidence | ${summary.evidence.counts.evidenced} |`);
    L.push(`| harnesses on the evidence allowlist | ${summary.evidence.counts.allowlisted} |`);
    L.push(`| assertions counted | ${summary.evidence.counts.totalAssertions} |`);
  }
  L.push("");
  L.push(`**TOTAL ${summary.counts.executed} checks, FAILED ${summary.counts.failed}**`);
  L.push("");

  if (summary.declaredSkips.length > 0) {
    L.push("## Declared skips");
    L.push("");
    L.push("Every non-executed harness is listed here with its reason. Nothing is skipped silently.");
    L.push("");
    for (const s of summary.declaredSkips) {
      L.push(`### \`${s.file}\` (package \`${s.package}\`)`);
      L.push("");
      L.push(`- **Reason:** ${s.skip.reason}`);
      L.push(`- **Requires:** ${s.skip.requires}`);
      L.push(`- **Run it manually:** ${s.skip.howToRunManually}`);
      L.push(`- **Declared by:** ${s.skip.declaredBy}`);
      if (s.skip.reviewBy) L.push(`- **Review by:** ${s.skip.reviewBy}`);
      L.push("");
    }
  }

  if (summary.integrityFindings.length > 0) {
    L.push("## Integrity findings (these fail the run)");
    L.push("");
    for (const f of summary.integrityFindings) {
      L.push(`- **${f.kind}**${f.harness ? ` \`${f.harness}\`` : ""} — ${f.detail}`);
    }
    L.push("");
  }

  if (summary.secretScan) {
    L.push("## Credential-leak assertion");
    L.push("");
    L.push(
      `- Artefacts scanned: ${summary.secretScan.filesScanned} ` +
        `(${summary.secretScan.bytesScanned} bytes), including every harness log and both summaries.`,
    );
    L.push(`- Critical leaks (a real credential from the environment): **${summary.secretScan.criticalCount}**`);
    L.push(`- Credential-shaped spans in pass-through harness output: ${summary.secretScan.shapeCount}`);
    L.push(`- Verdict: **${summary.secretScan.passed ? "no credential escaped" : "LEAK — run failed"}**`);
    if (summary.secretScan.findings.length > 0) {
      L.push("");
      for (const f of summary.secretScan.findings.slice(0, 20)) {
        L.push(`  - \`${f.label}\`:${f.line} ${f.pattern} (${f.severity}) — redacted sample: \`${f.sample}\``);
      }
    }
    L.push("");
  }

  if (summary.evidence) {
    const ev = summary.evidence;
    L.push("## Assertion-evidence contract");
    L.push("");
    L.push(
      "A harness counts as passed only if it yielded machine-readable evidence carrying a harness " +
        "identity and a POSITIVE assertion count. Exit 0 on its own does not distinguish a harness that " +
        "proved sixty invariants from one that asserted nothing.",
    );
    L.push("");
    L.push(`- Enforced this run: **${ev.enforced ? "yes" : "no — nothing was executed"}**`);
    L.push(`- Evidence run id: \`${ev.runId}\``);
    L.push(
      `- Passed harnesses: ${ev.counts.passedHarnesses}; carrying evidence: **${ev.counts.evidenced}**; ` +
        `allowlisted: ${ev.counts.allowlisted}; unevidenced and not allowlisted: **${ev.counts.unevidenced}**`,
    );
    L.push(`- Assertions counted across the sweep: **${ev.counts.totalAssertions}**`);
    if (Object.keys(ev.formCounts).length > 0) {
      L.push(
        `- Evidence forms seen: ${Object.entries(ev.formCounts).map(([form, n]) => `\`${form}\` ×${n}`).join(", ")}`,
      );
    }
    L.push("");
    L.push(
      `### Temporary allowlist — ${ev.allowlist.actualSize} of the executed harnesses are NOT evidence-enforced`,
    );
    L.push("");
    L.push(
      "This list is printed in full on every run. Its size is the honest measure of what this gate does " +
        "not check. Entries name exact filenames — no wildcards, globs or patterns are accepted — and the " +
        "manifest must declare the size, so an entry cannot be added without a visible edit.",
    );
    L.push("");
    L.push(`- declared size: ${ev.allowlist.declaredSize === null ? "none" : ev.allowlist.declaredSize}, real size: ${ev.allowlist.actualSize}`);
    L.push("");
    if (ev.allowlist.entries.length > 0) {
      L.push("| harness | temporary | reason | migration pending | declared by |");
      L.push("|---|---|---|---|---|");
      for (const e of ev.allowlist.entries) {
        const cell = (v) => String(v ?? "").replace(/\|/g, "\\|");
        L.push(`| \`${cell(e.file)}\` | ${e.temporary === true ? "yes" : "**NO**"} | ${cell(e.reason)} | ${cell(e.migrationPending)} | ${cell(e.declaredBy)} |`);
      }
      L.push("");
    }
    if (ev.allowlist.redundant.length > 0) {
      L.push(
        "**Redundant allowlist entries** (these harnesses did emit evidence, so the entries should be " +
          `deleted): ${ev.allowlist.redundant.map((r) => `\`${r.file}\` (${r.form}, ${r.assertions})`).join(", ")}`,
      );
      L.push("");
    }
    if (ev.records.length > 0) {
      L.push("### Evidence per harness");
      L.push("");
      L.push("| harness | assertions | form | identity | evidence |");
      L.push("|---|--:|---|---|---|");
      for (const r of ev.records) {
        L.push(
          `| \`${r.harness}\` | ${r.assertions} | \`${r.form}\` | ${r.identitySource} | \`${String(r.raw).replace(/\|/g, "\\|")}\` |`,
        );
      }
      L.push("");
    }
  }

  const failures = summary.harnesses.filter((h) => h.status === "failed");
  if (failures.length > 0) {
    L.push("## Failures");
    L.push("");
    for (const h of failures) {
      L.push(`- \`${h.file}\` exit ${h.exitCode}${h.timedOut ? " (TIMEOUT)" : ""} — log \`${h.logRelativePath}\``);
      if (h.tail) L.push(`  - tail: \`${h.tail}\``);
    }
    L.push("");
  }

  L.push("## Per-harness inventory");
  L.push("");
  L.push("| # | harness | package | status | exit | duration | started | log bytes |");
  L.push("|--:|---|---|---|--:|--:|---|--:|");
  summary.harnesses.forEach((h, i) => {
    L.push(
      `| ${i + 1} | \`${h.file}\` | ${h.package} | ${statusMark(h)} | ` +
        `${h.exitCode === null ? "-" : h.exitCode} | ${fmtMs(h.durationMs)} | ` +
        `${h.startedAt ? h.startedAt.slice(11, 19) : "-"} | ${h.logBytes ?? "-"} |`,
    );
  });
  L.push("");
  L.push("## Reproduce");
  L.push("");
  L.push("```powershell");
  L.push(`cd "${summary.repo.appDir}"`);
  L.push(`node ${summary.driver.relativePath}`);
  L.push("```");
  L.push("");
  L.push(`Exact per-harness commands are in \`summary.json\` under \`harnesses[].command\`.`);
  L.push("");
  return L.join("\n");
}

function writeSummaries(outDir, summary) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "summary.json");
  const mdPath = path.join(outDir, "summary.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, buildMarkdown(summary), "utf8");
  return { jsonPath, mdPath };
}

module.exports = { buildMarkdown, writeSummaries, fmtMs };
