// Fixture harness that prints a credential-shaped connection string, to prove
// the driver redacts harness output on its way to the log file.
//
// The value below is fabricated and matches nothing real. The point is that it
// must NOT appear in scripts/gates/artifacts/**; the log must show <redacted>.
//
// WHY IT NOW ASSERTS. It used to print "1 assertion passed" and assert nothing. Its assertions are
// about ITS OWN MATERIAL, and that is the useful thing to assert: this fixture only proves the
// driver redacts a DSN if what it prints is still DSN-shaped. Shorten the password, drop the
// userinfo separator, and the redaction case would keep passing while proving nothing. These
// assertions are what stop that happening silently.

const DSN = "postgresql://gateuser:hunter2@127.0.0.1:5432/fixture_db_scratch";
const PASSWORD = "hunter2";

let passed = 0;
const failures = [];

function assert(name, ok) {
  if (ok) passed += 1;
  else failures.push(name);
}

assert("the fixture DSN still carries a user:password@host userinfo section", /^[a-z]+:\/\/[^:@/]+:[^@/]+@[^/]+\//u.test(DSN));
assert("the fixture DSN's password is the literal the redaction case looks for", DSN.includes(`:${PASSWORD}@`));
assert("the fixture DSN points at a disposable-looking database, never a live name", /fixture|scratch|rehearsal/u.test(DSN) && !/\bpersonalink\b/u.test(DSN));

for (const name of failures) console.log(`[fixture:leaky] FAIL ${name}`);
console.log(`[fixture:leaky] connecting to ${DSN}`);
console.log(`[fixture:leaky] password=${PASSWORD}`);
console.log(`[fixture:leaky] ${passed}/${passed + failures.length} assertions passed`);
process.exit(failures.length === 0 ? 0 : 1);
