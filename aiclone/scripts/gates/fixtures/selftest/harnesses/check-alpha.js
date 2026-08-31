// Fixture harness for the gate driver's own self-test. Always green.
// Plain JS on purpose: the self-test must run in under a second, so it uses the
// manifest's "node" runner rather than ts-node.
//
// WHY THIS FILE HAS REAL ASSERTIONS NOW.
// It used to be one console.log of "3 assertions passed" and nothing else. That made it a
// PRINT-ONLY LIAR - the exact shape the corroboration layer exists to reject - so it could
// only stay green by being exempted, and an exempt fixture is a control that tests nothing.
// It asserts three real, falsifiable things instead: the per-child contract the driver
// promises every harness. Break that contract in run-gates.js and this fixture goes red,
// which is more than it could ever do before.

let passed = 0;
const failures = [];

/** The assertion helper. `condition` is tested here, so the count below is derived, not typed in. */
function assert(name, condition) {
  if (!condition) failures.push(name);
  else passed += 1;
}

assert("the driver passes GATES_HARNESS_ID naming this file", process.env.GATES_HARNESS_ID === "check-alpha.js");
assert("the driver passes a non-empty GATES_RUN_ID", typeof process.env.GATES_RUN_ID === "string" && process.env.GATES_RUN_ID.length > 0);
assert("the driver passes an absolute GATES_EVIDENCE_DIR", require("node:path").isAbsolute(String(process.env.GATES_EVIDENCE_DIR || "")));

for (const name of failures) console.log(`[fixture:alpha] FAIL ${name}`);
console.log(`[fixture:alpha] ${passed} assertions passed`);
process.exit(failures.length === 0 ? 0 : 1);
