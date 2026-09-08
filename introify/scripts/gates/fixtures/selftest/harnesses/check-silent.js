// Fixture harness that exits 0 while emitting nothing at all.
// A silent success is not evidence of anything, so the driver must reject its
// zero-byte log rather than counting it green.
process.exit(0);
