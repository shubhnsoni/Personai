// Fixture harness: the JSON-report form whose count is a LIST of assertion names, which
// check-auth-authz.ts and check-tenant-isolation.ts already print. The list length is the
// count. A nested object is included because JSON.stringify(value, null, 2) puts a nested
// opening brace after its key, which is what lets the parser find the top-level object.
//
// The list is now BUILT BY THE HELPER as each assertion passes, so its length is a measurement
// rather than a hand-written array. That matters: a hand-written list of three names is exactly the
// evidence a harness that ran nothing can print.

const passedNames = [];
const failedNames = [];

function assert(name, condition) {
  if (condition) passedNames.push(name);
  else failedNames.push(name);
}

assert("same-tenant read succeeds", process.env.GATES_HARNESS_ID === "check-jsonlist.js");
assert("cross-tenant read is refused", String(process.env.GATES_RUN_ID || "").startsWith("run-"));
assert("forged tenant id refused", require("node:path").isAbsolute(String(process.env.GATES_EVIDENCE_DIR || "")));

console.log(
  JSON.stringify(
    {
      result: failedNames.length === 0 ? "PASS" : "FAIL",
      assertions: passedNames,
      nested: { irrelevant: true },
      failures: failedNames,
    },
    null,
    2,
  ),
);
process.exit(failedNames.length === 0 ? 0 : 1);
