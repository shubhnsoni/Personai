// Fixture harness for the gate driver's own self-test. Always green.
//
// Carries the `ratio-passed` evidence form. Its two assertions are real and are made through an
// ALIAS of the helper (`const invariant = record`), which is deliberate: alias resolution is part of
// the corroboration layer's helper discovery, and a fixture that only ever called the helper by its
// declared name would leave that path unexercised.

let passed = 0;
let failed = 0;

function record(name, holds) {
  if (holds) passed += 1;
  else {
    failed += 1;
    console.log(`[fixture:beta] FAIL ${name}`);
  }
}

const invariant = record;

invariant("the cwd the driver spawns children in contains the app manifest", require("node:fs").existsSync(require("node:path").join(process.cwd(), "package.json")));
invariant("stdout is a pipe the driver can capture, not a tty", process.stdout.isTTY !== true);

console.log(`[fixture:beta] ${passed}/${passed + failed} invariants passed`);
process.exit(failed === 0 ? 0 : 1);
