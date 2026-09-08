// THE HEADLINE CASE: silent success.
//
// This harness exits 0 and prints output, so its log is not zero bytes and every guard that
// existed before the assertion-evidence contract passes it: real exit code 0, log present,
// no duplicate, no leak. Nothing it prints is an assertion count, and it asserts nothing at
// all — which is exactly the harness the old "passed == exited 0" rule could not tell apart
// from one that proved sixty invariants.
//
// Under the contract it must FAIL with EVIDENCE_MISSING unless it is named, exactly and with
// a reason, on the manifest's evidence.allowlist.
console.log("[fixture:mute] starting up");
console.log("[fixture:mute] connected");
console.log('  "result": "PASS",');
console.log("[fixture:mute] done");
process.exit(0);
