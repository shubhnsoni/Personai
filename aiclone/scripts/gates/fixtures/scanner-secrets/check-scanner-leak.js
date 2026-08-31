// Fixture harness that prints a Clerk-shaped secret key and a passwordless DSN, to
// prove the driver redacts BOTH on their way to the log file and that neither reaches
// either summary. check-leaky.js already covers user:password@ DSNs; this one covers
// the shapes added for the credential-scanner breadth work.
//
// Every value below is fabricated and matches nothing real. The key material is 21
// characters: above the scanner's 20-character floor, below the 24-character floor the
// vendor push-protection patterns use.
//
// WHY IT NOW ASSERTS. It used to print "2 assertions passed" and assert nothing, which made it a
// print-only liar and left the redaction end-to-end case resting on a number nobody had earned. Its
// two assertions are about ITS OWN MATERIAL, which is the load-bearing thing here: this fixture only
// proves the driver redacts these shapes while what it prints still HAS those shapes. Drop the key
// below the scanner's length floor, or give the DSN a password, and the e2e case would keep passing
// while testing something else entirely.

const KEY_BODY = "4f8FIXTUREb7Lm9Kd3Tz6";
const KEY = `sk_${"live"}_${KEY_BODY}`;
const DSN = "postgres://svc_reader@db.internal:5432/appdb";

let passed = 0;
const failures = [];

function assert(name, condition) {
  if (condition) passed += 1;
  else failures.push(name);
}

assert(
  "the fixture key body is 21 chars: above the scanner's 20-char floor, below the 24-char vendor floor",
  KEY_BODY.length === 21,
);
assert(
  "the fixture DSN still has userinfo and NO password, which is the shape this case exists to cover",
  /^postgres:\/\/[^:@/]+@[^/]+\//u.test(DSN) && !/:\/\/[^@/]*:[^@/]*@/u.test(DSN),
);

for (const name of failures) console.log(`[fixture:scanner-leak] FAIL ${name}`);
console.log(`[fixture:scanner-leak] resolved CLERK_SECRET_KEY=${KEY}`);
console.log(`[fixture:scanner-leak] connecting to ${DSN}`);
console.log(`[fixture:scanner-leak] ${passed} assertions passed`);
process.exit(failures.length === 0 ? 0 : 1);
