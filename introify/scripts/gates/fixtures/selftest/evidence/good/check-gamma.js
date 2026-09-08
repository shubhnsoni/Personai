// Fixture harness: the EXPLICIT evidence form.
//
// `GATE-EVIDENCE harness=<file> assertions=<n>` is the only form that carries its own
// identity, which is what makes forgery detectable at all. It always wins over the parsed
// human-readable forms, because an explicit machine-readable declaration beats a guess.
//
// AND IT IS ALSO THE FORM THE ADVERSARIAL AUDIT FORGED MOST SUCCESSFULLY - a harness with no
// imports and no comparisons printed one of these with 99999 assertions and got `gate ESTABLISHED`.
// So this fixture no longer types its count in: the 4 below is COMPUTED from a helper that tests
// four real conditions, and the evidence line is interpolated from the counter. That is what makes
// it a control for the corroboration layer rather than a demonstration of the hole.

let passed = 0;
const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
  else passed += 1;
}

const runId = String(process.env.GATES_RUN_ID || "");
assert("the driver hands every child a run id", runId.length > 0);
assert("the run id is per-run, not a fixed string", /^run-\d{4}-/u.test(runId));
assert("the driver names this harness in GATES_HARNESS_ID", process.env.GATES_HARNESS_ID === "check-gamma.js");
assert("the evidence schema the driver advertises is the one this repository declares", process.env.GATES_EVIDENCE_SCHEMA === "personai.gates.evidence/1");

for (const name of failures) console.log(`[fixture:gamma] FAIL ${name}`);
console.log("[fixture:gamma] setting up");
console.log(`GATE-EVIDENCE harness=check-gamma.js assertions=${passed}`);
process.exit(failures.length === 0 ? 0 : 1);
