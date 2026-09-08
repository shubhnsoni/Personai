// Fixture harness: the ratio form that 43 of the real check-*.ts harnesses already print.
// Real examples: "58/58 assertions passed", "39/39 invariants passed",
// "46/46 installation route assertions passed".
//
// Six real assertions, made through a WRAPPER of the recording helper rather than through the
// helper itself. The corroboration layer discovers forwarding wrappers to a fixed point, and a
// fixture that only ever called the base helper directly would leave that path untested.

const results = [];

/** The base recorder: `pass` is written down, and the verdict is computed from `results` at the end. */
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
}

/** A forwarding wrapper. It records nothing itself - it hands `holds` to `record`. */
function expect(name, holds) {
  record(name, holds, holds ? "" : "expected true");
}

/** A wrapper of the wrapper, to exercise more than one link of the chain. */
function expectEqual(name, actual, expected) {
  expect(`${name} (${String(actual)} === ${String(expected)})`, actual === expected);
}

const cwd = process.cwd();
expect("the driver spawns children with a non-empty cwd", cwd.length > 0);
expect("the cwd is absolute", require("node:path").isAbsolute(cwd));
expect("the cwd holds the app manifest", require("node:fs").existsSync(require("node:path").join(cwd, "package.json")));
expectEqual("GATES_HARNESS_ID", process.env.GATES_HARNESS_ID, "check-ratio.js");
expect("an evidence directory was provided", String(process.env.GATES_EVIDENCE_DIR || "").length > 0);
expect("the evidence directory exists by the time the child runs", require("node:fs").existsSync(String(process.env.GATES_EVIDENCE_DIR || "")));

const failed = results.filter((r) => !r.pass);
for (const r of failed) console.log(`[fixture:ratio] FAIL ${r.name} ${r.detail}`);
console.log("[fixture:ratio] checking things");
console.log("");
console.log(`${results.length - failed.length}/${results.length} installation route assertions passed`);
process.exit(failed.length === 0 ? 0 : 1);
