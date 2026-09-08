// THE EXPLICIT-REFUSAL FIXTURE. This harness must FAIL with CORROBORATION_HELPER_ESCAPES_AS_VALUE.
//
// It really does assert things - four of them, all real - so it is NOT a liar. But every call is
// made through a VALUE: the helper is passed into a driver function and pulled out of a table by a
// computed key. A source scan cannot follow either route, so the callsite count it can produce is an
// undercount of unknown size.
//
// THE DECISION THIS FIXTURE PINS DOWN. Faced with an indirection it cannot follow, a checker has
// three options:
//
//   1. Count what it can see and report the harness as corroborated. This is SILENT UNDER-COUNTING
//      and it is the dangerous direction: the harness is presented as clean when in truth it was
//      never scanned. A control that says "fine" about code it did not read is worse than no control.
//   2. Guess - resolve the value flow with heuristics. Guessing wrong in the permissive direction is
//      option 1 with extra steps, and guessing wrong in the strict direction fails honest harnesses.
//   3. REFUSE, by name, and fail. The reader is told exactly which helper escaped and where.
//
// This layer takes option 3. The fix for a harness in this state is to call its helper directly, or
// to declare the indirection deliberately - not to have the checker quietly approve of it.

const results = [];

function record(name, pass) {
  results.push({ name, pass });
}

// ESCAPE 1: the helper is passed as an argument. Calls happen inside `runSuite`, through a parameter.
function runSuite(report) {
  report("Array.isArray on a literal", Array.isArray([]) === true);
  report("Number.isInteger rejects a fraction", Number.isInteger(1.5) === false);
}
runSuite(record);

// ESCAPE 2: the helper is stored in an object and reached by a computed key.
const table = { record };
const key = "record";
table[key]("Set deduplicates", new Set([1, 1, 2]).size === 2);
table[key]("JSON round trip preserves a number", JSON.parse("42") === 42);

const failed = results.filter((r) => !r.pass);
for (const r of failed) console.log(`[fixture:escaped] FAIL ${r.name}`);
console.log(`[fixture:escaped] ${results.length - failed.length}/${results.length} assertions passed`);
process.exit(failed.length === 0 ? 0 : 1);
