// Fixture harness: the EXPLICIT evidence form.
//
// `GATE-EVIDENCE harness=<file> assertions=<n>` is the only form that carries its own
// identity, which is what makes forgery detectable at all. It always wins over the parsed
// human-readable forms, because an explicit machine-readable declaration beats a guess.
console.log("[fixture:gamma] setting up");
console.log("GATE-EVIDENCE harness=check-gamma.js assertions=4");
process.exit(0);
