// Fixture harness that reports a NEGATIVE assertion count.
//
// A negative count means the harness's own bookkeeping is broken (a total subtracted the
// wrong way round), and a broken counter cannot be trusted to say anything was proven.
// Rejected as EVIDENCE_NEGATIVE_ASSERTIONS, distinctly from the zero case, so the finding
// tells the reader which of the two happened.
console.log("[fixture:negative] miscounting");
console.log("GATE-EVIDENCE harness=check-negative.js assertions=-3");
process.exit(0);
