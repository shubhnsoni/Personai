// Fixture harness that exits 0 while its own evidence reports failures.
//
// "4/6 assertions passed" and exit 0 cannot both be true. A harness that forgets to set a
// non-zero exit code after a failed assertion is the oldest way a red result reads as green,
// and the ratio it prints is the evidence against it.
console.log("[fixture:claims] two assertions failed and I forgot to say so");
console.log("4/6 assertions passed");
process.exit(0);
