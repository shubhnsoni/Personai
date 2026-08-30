// Fixture harness that is deliberately red, to prove the driver reports a real
// non-zero exit code rather than absorbing it.
console.log("[fixture:red] assertion 1 passed");
console.error("[fixture:red] FAILED: deliberate failure for the driver self-test");
process.exit(1);
