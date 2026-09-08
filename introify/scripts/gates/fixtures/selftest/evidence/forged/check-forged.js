// Fixture harness that prints FORGED evidence: a real, well-formed, positive count that
// names a DIFFERENT harness.
//
// This is how a copy-pasted summary line, or a harness that prints another harness's
// captured output, would smuggle someone else's proof into its own result. The count is
// genuine and positive, so nothing but the identity check can catch it.
console.log("[fixture:forged] borrowing someone else's proof");
console.log("GATE-EVIDENCE harness=check-somewhere-else.js assertions=9");
process.exit(0);
