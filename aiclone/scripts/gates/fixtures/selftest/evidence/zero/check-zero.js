// Fixture harness that reports ZERO assertions and exits 0.
//
// "0/0 assertions passed" is not a pass, it is an empty check wearing the shape of one. A
// harness whose assertion set has become empty — every case commented out, a loop over an
// empty fixture list — is indistinguishable from a deleted harness, so the driver must reject
// it with EVIDENCE_ZERO_ASSERTIONS rather than counting it green.
console.log("[fixture:zero] nothing to assert today");
console.log("0/0 assertions passed");
process.exit(0);
