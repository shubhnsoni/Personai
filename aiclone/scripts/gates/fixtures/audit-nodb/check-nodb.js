// Fixture harness for the `requiresDatabase: false` manifest shape.
//
// It asserts the one thing that matters about that shape: the driver must NOT
// hand it an unvalidated DATABASE_URL. When no disposable target was resolved,
// the variable is withheld rather than inherited from the ambient environment,
// because an inherited value has passed neither the `personalink` denylist nor
// the disposable-name assertion.
let passed = 0;
let failed = 0;

if (process.env.DATABASE_URL === undefined) passed += 1;
else {
  failed += 1;
  console.log("FAIL the driver forwarded an unvalidated DATABASE_URL to a requiresDatabase:false harness");
}

// The evidence channel must still be wired for a database-free run.
if (typeof process.env.GATES_RUN_ID === "string" && process.env.GATES_RUN_ID !== "") passed += 1;
else {
  failed += 1;
  console.log("FAIL GATES_RUN_ID was not provided");
}

console.log(`GATE-EVIDENCE harness=check-nodb.js assertions=${passed}`);
console.log(`${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);
