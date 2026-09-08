// Fixture harness that is deliberately red, to prove the driver reports a real
// non-zero exit code rather than absorbing it.
//
// The failure is now produced BY AN ASSERTION rather than by a hardcoded process.exit(1). That is
// the honest shape for a fixture standing in for a failing harness: the exit code is computed from
// a real, falsifiable comparison, so this file proves the driver surfaces a genuine assertion
// failure and not merely a chosen number.

let passed = 0;
const failures = [];

function assert(name, condition) {
  if (condition) passed += 1;
  else failures.push(name);
}

assert("this one holds, so the run is not red for want of any passing assertion", process.pid > 0);
// Deliberately false, and deliberately not a literal: the comparison is evaluated.
assert("DELIBERATE FAILURE for the driver self-test: the fixture claims an impossible pid", process.pid < 0);

for (const name of failures) console.error(`[fixture:red] FAILED: ${name}`);
console.log(`[fixture:red] ${passed}/${passed + failures.length} assertions passed`);
process.exit(failures.length === 0 ? 0 : 1);
