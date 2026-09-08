// Fixture harness: the JSON-report form with a NUMERIC count, which 14 of the real
// check-*.ts harnesses already print (e.g. check-actions-authz.ts emits
// "assertions": checks.length inside JSON.stringify(report, null, 2)).
//
// The trailing line after the JSON is deliberate: check-foundation-contracts.ts prints a
// sign-off line after its report, so the parser must search backwards from the end of the
// log rather than assuming the JSON is last.
//
// The 12 in the report is COMPUTED. It used to be a literal, which made this fixture a harness that
// printed a number it had not earned - the shape the corroboration layer rejects.

const checks = [];

function check(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
}

// Twelve real assertions about the driver's child contract and this process's own shape.
const path = require("node:path");
const fs = require("node:fs");
const evidenceDir = String(process.env.GATES_EVIDENCE_DIR || "");

check("a harness id is provided", typeof process.env.GATES_HARNESS_ID === "string");
check("the harness id names this file", process.env.GATES_HARNESS_ID === "check-json.js");
check("a run id is provided", typeof process.env.GATES_RUN_ID === "string");
check("the run id is not empty", String(process.env.GATES_RUN_ID || "").length > 0);
check("an evidence dir is provided", evidenceDir.length > 0);
check("the evidence dir is absolute", path.isAbsolute(evidenceDir));
check("the evidence dir exists", fs.existsSync(evidenceDir));
check("the evidence schema is advertised", String(process.env.GATES_EVIDENCE_SCHEMA || "").length > 0);
check("the evidence schema is the declared one", process.env.GATES_EVIDENCE_SCHEMA === "personai.gates.evidence/1");
check("the cwd holds the app manifest", fs.existsSync(path.join(process.cwd(), "package.json")));
check("this harness runs as its own process", process.pid > 0);
check("stdout is captured rather than attached to a terminal", process.stdout.isTTY !== true);

const failures = checks.filter((c) => !c.pass).map((c) => c.name);
console.log(JSON.stringify({ result: failures.length === 0 ? "PASS" : "FAIL", assertions: checks.length - failures.length, failures }, null, 2));
console.log("[fixture:json] done");
process.exit(failures.length === 0 ? 0 : 1);
