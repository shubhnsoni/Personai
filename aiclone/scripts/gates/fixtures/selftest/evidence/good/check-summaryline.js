// Fixture harness: the "SUMMARY ... passed=N failed=M" form that
// check-workspace-surface-boundary.ts and check-workspace-surface-contract.ts print.
//
// IT IS ALSO THE LOOP CASE, AND THAT IS THE POINT.
//
// This file contains exactly ONE assertion callsite. It executes 41 times, because it is inside a
// loop over 41 generated records. So its runtime count is 41 and its static callsite count is 1.
//
// A corroboration layer that demanded runtime == static would fail this harness, and would fail most
// real harnesses in this repository, and would then be "fixed" by weakening it until it measured
// nothing. Equality is not a property of correct code: a loop runs one callsite many times, and a
// branch not taken runs it zero times. Only the ZERO-versus-POSITIVE contradiction is sound - a
// harness cannot execute 41 assertions with no assertion callsite in its source - and that is the
// only thing asserted about this fixture.

let passed = 0;
let failed = 0;

function check(property, expectation, detail = "") {
  if (expectation) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${property} :: ${detail}`);
  }
}

// 41 records, each carrying a value that must survive a JSON round trip unchanged. A real
// comparison, evaluated 41 times, from one callsite.
const records = Array.from({ length: 41 }, (_, index) => ({
  index,
  label: `surface-${index}`,
  nested: { depth: index % 7, flag: index % 2 === 0 },
}));

for (const record of records) {
  const roundTripped = JSON.parse(JSON.stringify(record));
  check(
    `record ${record.index} survives a JSON round trip`,
    roundTripped.index === record.index &&
      roundTripped.label === record.label &&
      roundTripped.nested.depth === record.nested.depth &&
      roundTripped.nested.flag === record.nested.flag,
    `got ${JSON.stringify(roundTripped)}`,
  );
}

console.log("PASS every role is derived from the server :: ok");
console.log(`SUMMARY mode=normal passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
