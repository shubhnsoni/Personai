/**
 * PKG-H-AUDIT probe for target (3): deriveMixedScope, DATABASE-FREE.
 *
 * The claim under attack: deriveMixedScope is a genuine measurement, so
 * all-same-scope yields false and genuinely-mixed yields true, and no realistic
 * input makes it constant. This probe hits it with the adversarial inputs the
 * audit brief names: empty array, all-zero counts, one domain, duplicate
 * scopes, negative counts, missing/NaN counts, undefined scope.
 *
 * It asserts, and it prints its own assertion count in the driver's own
 * evidence form so the count is checkable.
 */
import { deriveMixedScope } from "@/lib/operations/engine"

type Loose = { scope?: unknown; count?: unknown }
const call = (domains: Loose[]): boolean => deriveMixedScope(domains as never)

let passed = 0
let failed = 0
const fail: string[] = []

function expect(label: string, got: boolean, want: boolean): void {
    if (got === want) {
        passed += 1
    } else {
        failed += 1
        fail.push(`${label}: got ${got}, want ${want}`)
    }
}

const P = "profile"
const W = "workspace"

// ---- the two claimed poles -------------------------------------------------
expect("empty array", call([]), false)
expect("single domain, populated", call([{ scope: P, count: 3 }]), false)
expect("two domains, same scope, both populated", call([{ scope: P, count: 3 }, { scope: P, count: 9 }]), false)
expect("genuinely mixed, both populated", call([{ scope: P, count: 3 }, { scope: W, count: 1 }]), true)

// ---- all-zero counts: the vacuity case ------------------------------------
expect("all zero counts, scopes differ", call([{ scope: P, count: 0 }, { scope: W, count: 0 }]), false)
expect("mixed scopes but only one populated", call([{ scope: P, count: 5 }, { scope: W, count: 0 }]), false)
expect("mixed scopes, only the other one populated", call([{ scope: P, count: 0 }, { scope: W, count: 5 }]), false)

// ---- duplicate scopes -----------------------------------------------------
expect(
    "many duplicates, one scope",
    call([{ scope: W, count: 1 }, { scope: W, count: 2 }, { scope: W, count: 3 }, { scope: W, count: 4 }]),
    false,
)

// ---- ADVERSARIAL: can the count>0 filter be defeated? ---------------------
// A negative count is not "contributed", so it must not add its boundary.
expect("negative count alongside a populated other scope", call([{ scope: P, count: 5 }, { scope: W, count: -3 }]), false)
expect("both negative", call([{ scope: P, count: -1 }, { scope: W, count: -2 }]), false)

// NaN > 0 is false in JS, so a NaN count is filtered out. Confirm, don't assume.
expect("NaN count alongside populated other scope", call([{ scope: P, count: 5 }, { scope: W, count: Number.NaN }]), false)

// A missing count is `undefined`; undefined > 0 is false.
expect("missing count alongside populated other scope", call([{ scope: P, count: 5 }, { scope: W }]), false)

// A STRING count is the one that can defeat `> 0`: "3" > 0 is true after coercion.
expect("string count '3' coerces past the filter", call([{ scope: P, count: 5 }, { scope: W, count: "3" }]), true)
expect("string count '0' does not", call([{ scope: P, count: 5 }, { scope: W, count: "0" }]), false)
// true > 0 is also true after coercion.
expect("boolean true count coerces past the filter", call([{ scope: P, count: 5 }, { scope: W, count: true }]), true)

// ---- undefined / duplicate-by-identity scope ------------------------------
expect("undefined scope is its own Set member", call([{ scope: P, count: 1 }, { count: 1 }]), true)
expect("two undefined scopes collapse to one", call([{ count: 1 }, { count: 1 }]), false)
// Set uses SameValueZero: two distinct objects with equal shape do NOT collapse.
expect(
    "object scopes that look equal do not collapse",
    call([{ scope: { s: "p" }, count: 1 }, { scope: { s: "p" }, count: 1 }]),
    true,
)
// Fractional counts above zero DO contribute.
expect("fractional count 0.5 contributes", call([{ scope: P, count: 5 }, { scope: W, count: 0.5 }]), true)
expect("Infinity count contributes", call([{ scope: P, count: 5 }, { scope: W, count: Number.POSITIVE_INFINITY }]), true)

// ---- IS IT STILL CONSTANT ANYWHERE? --------------------------------------
// The decisive property: over the real domain shape (scope in {profile, workspace},
// count a non-negative integer) the function must take BOTH values. Enumerate.
const observed = new Set<boolean>()
for (const a of [0, 1, 2]) {
    for (const b of [0, 1, 2]) {
        observed.add(call([{ scope: P, count: a }, { scope: W, count: b }]))
    }
}
expect("function is NOT constant over realistic inputs (both values observed)", observed.size === 2, true)
// And specifically: exactly the both-populated cells are true.
let trueCells = 0
for (const a of [0, 1, 2]) {
    for (const b of [0, 1, 2]) {
        if (call([{ scope: P, count: a }, { scope: W, count: b }])) trueCells += 1
    }
}
expect("exactly the 4 both-populated cells are true", trueCells === 4, true)

if (fail.length > 0) {
    for (const line of fail) console.log(`FAIL ${line}`)
}
console.log(`GATE-EVIDENCE harness=probe-mixedscope.ts assertions=${passed}`)
console.log(`${passed}/${passed + failed} assertions passed`)
process.exit(failed === 0 ? 0 : 1)
