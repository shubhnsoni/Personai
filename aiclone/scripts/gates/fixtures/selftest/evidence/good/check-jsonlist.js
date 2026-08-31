// Fixture harness: the JSON-report form whose count is a LIST of assertion names, which
// check-auth-authz.ts and check-tenant-isolation.ts already print. The list length is the
// count. A nested object is included because JSON.stringify(value, null, 2) puts a nested
// opening brace after its key, which is what lets the parser find the top-level object.
console.log(
  JSON.stringify(
    {
      result: "PASS",
      assertions: ["same-tenant read succeeds", "cross-tenant read is refused", "forged tenant id refused"],
      nested: { irrelevant: true },
      failures: [],
    },
    null,
    2,
  ),
);
process.exit(0);
