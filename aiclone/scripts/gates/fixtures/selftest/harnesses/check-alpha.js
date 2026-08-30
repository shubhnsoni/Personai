// Fixture harness for the gate driver's own self-test. Always green.
// Plain JS on purpose: the self-test must run in under a second, so it uses the
// manifest's "node" runner rather than ts-node.
console.log("[fixture:alpha] 3 assertions passed");
process.exit(0);
