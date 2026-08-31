// THE ALIAS AND WRAPPER FIXTURE. This harness must PASS.
//
// Not one assertion here is made by calling the recording helper directly. They are made through:
//
//   - a THREE-LINK FORWARDING CHAIN   deepHold -> mustHold -> forward -> record
//   - an ALIAS of the chain's top     const requireThat = deepHold
//   - an ALIAS OF AN ALIAS            const insist = requireThat
//
// Handling this is not optional. Eight production harnesses in this repository declare a
// `checkInvertible` wrapper that records nothing itself and merely forwards its condition to
// `check`; a discovery pass that only recognised direct recorders would see zero callsites in all
// eight and would report them as asserting nothing. The corroboration layer therefore resolves
// forwarding wrappers to a FIXED POINT rather than to a fixed depth - a bounded number of rounds is
// itself a silent hole, because a wrapper one link deeper than the bound is not a helper.
//
// The alternative to handling wrappers is REFUSING them out loud. That is what
// ../escaped/check-escaped.js is for: an indirection this layer cannot follow produces a named
// finding, never a silent pass.

const results = [];

/** The base recorder. Writes the verdict down; the exit code is computed from `results` below. */
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
}

/** Link 1: forwards its condition, records nothing. */
function forward(name, holds) {
  record(name, holds);
}

/** Link 2: forwards through link 1. */
function mustHold(name, holds) {
  forward(name, holds);
}

/** Link 3: three links above the recorder, still pure forwarding. */
function deepHold(name, holds) {
  mustHold(name, holds);
}

/** An alias, and then an alias of the alias. */
const requireThat = deepHold;
const insist = requireThat;

deepHold("Array.isArray on a literal", Array.isArray([]) === true);
deepHold("JSON round trip preserves a number", JSON.parse("42") === 42);
requireThat("an empty string is falsy", Boolean("") === false);
insist("Number.isInteger rejects a fraction", Number.isInteger(1.5) === false);
insist("Set deduplicates", new Set([1, 1, 2]).size === 2);

const failed = results.filter((r) => !r.pass);
for (const r of failed) console.log(`[fixture:wrapped] FAIL ${r.name}`);
console.log(`[fixture:wrapped] ${results.length - failed.length}/${results.length} assertions passed`);
process.exit(failed.length === 0 ? 0 : 1);
