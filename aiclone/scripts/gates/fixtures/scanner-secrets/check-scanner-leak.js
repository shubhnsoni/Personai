// Fixture harness that prints a Clerk-shaped secret key and a passwordless DSN, to
// prove the driver redacts BOTH on their way to the log file and that neither reaches
// either summary. check-leaky.js already covers user:password@ DSNs; this one covers
// the shapes added for the credential-scanner breadth work.
//
// Every value below is fabricated and matches nothing real. The key material is 21
// characters: above the scanner's 20-character floor, below the 24-character floor the
// vendor push-protection patterns use.
console.log("[fixture:scanner-leak] resolved CLERK_SECRET_KEY=sk_live_4f8FIXTUREb7Lm9Kd3Tz6");
console.log("[fixture:scanner-leak] connecting to postgres://svc_reader@db.internal:5432/appdb");
console.log("[fixture:scanner-leak] 2 assertions passed");
process.exit(0);
