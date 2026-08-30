// Fixture harness that prints a credential-shaped connection string, to prove
// the driver redacts harness output on its way to the log file.
//
// The value below is fabricated and matches nothing real. The point is that it
// must NOT appear in scripts/gates/artifacts/**; the log must show <redacted>.
console.log("[fixture:leaky] connecting to postgresql://gateuser:hunter2@127.0.0.1:5432/fixture_db_scratch");
console.log("[fixture:leaky] password=hunter2");
console.log("[fixture:leaky] 1 assertion passed");
process.exit(0);
