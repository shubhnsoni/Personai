// THE LOOP FIXTURE: 40 runtime assertions from ONE static callsite.
//
// This harness must PASS. It is the control for the single most tempting way to get this layer
// wrong: requiring the runtime assertion count to equal the number of assertion callsites in source.
//
// That requirement is unsound. A loop executes one callsite many times, a branch not taken executes
// it zero times, and a helper called from another helper multiplies. Equality is therefore not a
// property of correct code, and a layer that demanded it would go red across most of this
// repository and would then be "fixed" by relaxing it until it measured nothing at all.
//
// What IS sound is the contradiction: a harness cannot execute 40 assertions with no assertion
// callsite in its source. So only zero-versus-positive is enforced, and this fixture pins that
// decision in place - 40 runtime against 1 static, and green.

let passed = 0;
const failures = [];

function assert(name, condition) {
  if (!condition) failures.push(name);
  else passed += 1;
}

// One callsite. Forty executions. Each is a real comparison over a distinct input.
for (let n = 1; n <= 40; n += 1) {
  assert(`${n} squared then square-rooted returns ${n}`, Math.sqrt(n * n) === n);
}

for (const name of failures) console.log(`[fixture:loop] FAIL ${name}`);
console.log(`[fixture:loop] ${passed}/${passed + failures.length} assertions passed`);
process.exit(failures.length === 0 ? 0 : 1);
