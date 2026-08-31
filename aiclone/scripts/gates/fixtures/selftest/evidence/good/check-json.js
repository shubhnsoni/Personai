// Fixture harness: the JSON-report form with a NUMERIC count, which 14 of the real
// check-*.ts harnesses already print (e.g. check-actions-authz.ts emits
// "assertions": checks.length inside JSON.stringify(report, null, 2)).
//
// The trailing line after the JSON is deliberate: check-foundation-contracts.ts prints a
// sign-off line after its report, so the parser must search backwards from the end of the
// log rather than assuming the JSON is last.
console.log(JSON.stringify({ result: "PASS", assertions: 12, failures: [] }, null, 2));
console.log("[fixture:json] done");
process.exit(0);
