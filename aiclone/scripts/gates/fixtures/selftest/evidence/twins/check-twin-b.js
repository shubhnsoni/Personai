// Fixture harness B of a duplicate-identity pair. It claims check-twin-a.js as its identity,
// so two harnesses in one run assert the same identity and one set of assertions would be
// counted under a name that does not belong to it. Rejected as EVIDENCE_DUPLICATE_ID.
console.log("[fixture:twin-b] claiming twin A's identity");
console.log("GATE-EVIDENCE harness=check-twin-a.js assertions=7");
process.exit(0);
