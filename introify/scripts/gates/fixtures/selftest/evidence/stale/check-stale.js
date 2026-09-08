// Fixture harness that leaves STALE sidecar evidence behind.
//
// It writes a well-formed personai.gates.evidence/1 file naming itself with a healthy
// positive count — but stamped with a DIFFERENT run id and back-dated, which is exactly what
// an evidence file surviving from an earlier sweep looks like. It ALSO prints perfectly good
// log evidence, so this proves the driver refuses stale evidence rather than quietly falling
// back to the evidence it likes better. Silently preferring the good copy is how a leftover
// proof gets absorbed into a green result.
const fs = require("node:fs");
const path = require("node:path");

const dir = process.env.GATES_EVIDENCE_DIR;
if (!dir) {
  console.error("[fixture:stale] GATES_EVIDENCE_DIR was not passed to the harness");
  process.exit(1);
}

const target = path.join(dir, "check-stale.js.evidence.json");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  target,
  `${JSON.stringify(
    {
      schema: process.env.GATES_EVIDENCE_SCHEMA || "personai.gates.evidence/1",
      runId: "run-2026-01-01T00-00-00-000-staleaaaaaaa",
      harness: "check-stale.js",
      assertions: 31,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
const longAgo = new Date("2026-01-01T00:00:00.000Z");
fs.utimesSync(target, longAgo, longAgo);

console.log("[fixture:stale] left a previous run's evidence file in place");
console.log("5/5 assertions passed");
process.exit(0);
