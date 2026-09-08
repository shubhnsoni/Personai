// THE "RUNTIME EVIDENCE IS STILL REQUIRED" FIXTURE. This harness must FAIL with EVIDENCE_MISSING.
//
// It is the mirror image of ../prose/check-prose.js. That file prints a perfect count and asserts
// nothing; this one asserts three real things and prints no count at all.
//
// It exists to prove a property of the corroboration layer that is easy to lose by accident: a
// strong static signal must NEVER become a substitute for runtime evidence. If corroboration were
// wired as an alternative channel rather than an additional condition, this harness would pass on
// the strength of its source alone - and "the code contains assertions" says nothing about whether
// they RAN. The whole point of the two-signal design is that both are required and they come from
// different places.
//
// So the layer only ever judges harnesses that ALREADY produced a positive runtime count, and this
// harness never reaches it: it fails on the evidence contract, exactly as it did before this layer
// existed, and the corroboration block reports `judged: 0` rather than a clean result.

const failures = [];

// No `passed` counter on purpose. This harness must not print a count in ANY form the evidence
// parser recognises, and a counter it printed would be exactly that.
function assert(name, condition) {
  if (!condition) failures.push(name);
}

assert("the driver names this harness", process.env.GATES_HARNESS_ID === "check-mute-but-asserting.js");
assert("a run id is provided", String(process.env.GATES_RUN_ID || "").length > 0);
assert("the cwd is absolute", require("node:path").isAbsolute(process.cwd()));

// Output on purpose, so the log is not zero bytes and RESULT_LOG_ZERO_BYTE is not what fires. But
// deliberately NO assertion count in any form the evidence parser recognises.
console.log("[fixture:mute-but-asserting] starting up");
for (const name of failures) console.log(`[fixture:mute-but-asserting] FAIL ${name}`);
console.log("[fixture:mute-but-asserting] done");
process.exit(failures.length === 0 ? 0 : 1);
