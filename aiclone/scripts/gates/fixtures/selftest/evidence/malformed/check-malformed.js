// Fixture harness whose evidence is MALFORMED: the shape is right, the count is not a number.
//
// This is the "template variable never interpolated" failure — a harness printing
// `assertions=${count}` where count is undefined still emits a line that looks like evidence.
// Unreadable evidence must be rejected rather than coerced: Number("undefined") is NaN, and a
// NaN silently treated as truthy or as zero is how a broken counter becomes a green result.
console.log("[fixture:malformed] evidence line with a non-numeric count");
console.log("GATE-EVIDENCE harness=check-malformed.js assertions=undefined");
process.exit(0);
