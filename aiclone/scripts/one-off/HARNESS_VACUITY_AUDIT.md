# Harness Vacuity Audit — BP4

## Scope and method

Audited `check-capability-contract.ts` with direct break/run/restore evidence against its
protected production guard in `src/lib/business-os/validation.ts`. I also ran the prescribed
normal and inversion baselines for `check-fieldjob-inspection-runtime.ts` through the authorized
rehearsal runner, but did **not** count that as source-break evidence: that runner explicitly
sets its working directory to the primary worktree, which this assignment prohibits touching.

## Finding fixed

The capability contract contained a branch-coverage gap around the active-blueprint maturity
gate:

```ts
blueprint.status === "active" && composition.required && capability.maturity !== "available"
```

The harness had strong required-capability cases (synthetic `planned`, real `partial`), but no
active composition that selected the same immature real capability with `required: false`.
Deleting `composition.required &&` left the harness green (`exit 0`). The existing cases proved
that immature **required** capabilities were rejected; they did not prove that optional ones were
excluded from the gate.

The harness now pairs its real `appointments:reminders` required-partial refusal with an active,
optional composition of the same real partial capability. Removing the discriminator now fails
only the new assertion (`exit 1`), and restored production code returns the harness to green.

## Evidence table

| Assertion / coverage claim | Harness location | Protected code | Break performed | Before fix | After fix |
| --- | --- | --- | --- | --- | --- |
| Required planned capability is rejected | `check-capability-contract.ts` existing negative case | `validation.ts` active + required + available maturity gate | Deleted `composition.required &&` | Harness stayed green (`0`); no optional immature composition existed | Retained as required-direction control |
| Required real partial capability is rejected | `check-capability-contract.ts` existing partial case | Same gate | Deleted `composition.required &&` | Harness stayed green (`0`); same missing optional direction | Retained as required-direction control |
| Active blueprint may include real partial `appointments:reminders` when optional | `check-capability-contract.ts` new paired case | Same gate | Deleted `composition.required &&` | Absent | Harness failed (`1`) at this assertion; restored code green (`0`) |

## Counts

- Assertions/coverage claims examined: 3
- Proven real after mutation: 1
- Vacuity findings: 1 (the missing optional-direction assertion across the two existing required-only controls)
- Fixed: 1
- Unfixed suspected vacuities: none

## Other files

- `check-fieldjob-inspection-runtime.ts`: normal rehearsal run passed 112/112; inversion returned non-zero as expected. No source-mutation conclusion is claimed because the supplied runner executes `C:\Users\shubh\Desktop\Projects\personai\aiclone`, not this assigned worktree.
- `check-fieldjob-runtime.ts` and later listed harnesses: not audited. The time budget was spent proving and repairing the first demonstrated discriminator gap rather than manufacturing coverage.

## Validation

- Capability contract: normal `0`; inversion `1`; post-fix source discriminator removal `1`; restored normal `0`.
- Production `src/**` changes: temporary only; none are intended to survive.


## Group A ΓÇö S1-C fieldjob inspection runtime

### Scope and method

Audited `check-fieldjob-inspection-runtime.ts` using the CWD-respecting rehearsal
runner from the assigned `s1c/vacuity-group-a` worktree. The runner reported that
same worktree as its app directory and the authorized rehearsal database as its
target. I tested the server-computed `canRecord` property by temporarily replacing
its `RECORDABLE_STATUSES.includes(row.status)` implementation with `false`, then
restored the original source exactly.

### Evidence

| Assertion / coverage claim | Harness location | Protected code | Break performed | Before fix | After fix |
| --- | --- | --- | --- | --- | --- |
| A DRAFT inspection reports `canRecord: true`, so the flag is not always false | `check-fieldjob-inspection-runtime.ts:721` | `src/lib/fieldjobs/inspection.ts:209`, `canRecord: RECORDABLE_STATUSES.includes(row.status)` | Temporarily changed the source expression to `false` | Mutation run failed `1`, 111/112; this exact assertion failed with `canRecord=false status=DRAFT` | No harness fix required; source restored and normal run passed `0`, 112/112 |

### Conclusion

This tested assertion is real, not vacuous. The DRAFT fixture is qualifying and
the source mutation makes the named assertion red. No harness change is warranted.

### Validation

- Normal rehearsal run: `0` (112/112).
- `INVERT_ASSERTION=1`: `1` (expected control failure).
- Temporary source mutation: `1` (111/112); the named DRAFT assertion failed.
- Restored normal rehearsal run: `0` (112/112).
- `npx eslint scripts/one-off/check-fieldjob-inspection-runtime.ts`: `0`.
- `git diff --stat -- src`: no output; no `src/**` changes survive.

### Group A file status

- `check-fieldjob-inspection-runtime.ts`: audited-and-all-real for the source-broken `canRecord` assertion.
- `check-fieldjob-runtime.ts`: not-reached.
- `check-operations-runtime.ts`: not-reached.


## Group B ΓÇö S2-C commerce, inventory, and cohort runtime

### Scope and method

Audited the three assigned Group B harnesses only, using the CWD-respecting
`run-on-rehearsal-cwd.js` runner from the assigned
`personai-night-audit-wt\aiclone` worktree. Every run reported that worktree
as its app directory and the authorized rehearsal database as its target. Each
source mutation was restored byte-for-byte before the next run; no `src/**`
change survives.

### Evidence table

| Assertion / coverage claim | Harness location | Protected code | Break performed | Before fix | After fix |
| --- | --- | --- | --- | --- | --- |
| Null-priced variant inherits the product price | `check-commerce-runtime.ts:252` | `src/lib/commerce/variants.ts:65`, the null-price branch of `effectivePriceCents` | Replaced `row.priceCents === null ? productPriceCents : Number(row.priceCents)` with `Number(row.priceCents)` | Mutation failed `1`, 108/110; this assertion failed with effective price `0` | No fix required; restored normal passed `0`, 110/110 |
| Clearing a variant price restores inheritance | `check-commerce-runtime.ts:261` | Same `effectivePriceCents` null-price branch | Same mutation | Mutation failed `1`, 108/110; this paired assertion also failed with effective price `0` | No fix required; restored normal passed `0`, 110/110 |
| A stock count below reserved units is refused by the engine-level promised-stock guard | `check-inventory-runtime.ts:303` | `src/lib/inventory/engine.ts:359`, `if (onHandAfter < locked.reserved)` | Replaced the condition with `false` | Mutation failed `1`, 84/85. The named assertion failed: the database fallback returned `CONFLICT: That movement would break a stock invariant`, not the engine's `already promised to orders` refusal | No fix required; restored normal passed `0`, 85/85 |
| PLANNED cannot transition directly to COMPLETED | `check-cohort-runtime.ts:279` | `src/lib/cohorts/lifecycle.ts:17`, `PLANNED` transition table | Added `COMPLETED` to PLANNED's allowed targets | Mutation failed `1`: the direct transition was accepted, then the next attempted ENROLLING transition aborted with `This cohort is already completed and cannot change` | No fix required; restored normal passed `0`, 114/114 |

### Conclusion

No vacuous assertion was found among the four directly source-broken claims.
The commerce fixture does contain genuinely null-priced variants; inventory's
assertion proves the engine-specific refusal rather than merely a database
CHECK; and the cohort fixture reaches the prohibited lifecycle edge.

### Validation

- Commerce: normal `0` (110/110); mutation `1` (108/110); restored normal `0` (110/110); `INVERT_ASSERTION=1` `1` (109/110).
- Inventory: normal `0` (85/85); mutation `1` (84/85); restored normal `0` (85/85); `INVERT_ASSERTION=1` `1` (84/85).
- Cohort: normal `0` (114/114); mutation `1`; restored normal `0` (114/114); `INVERT_ASSERTION=1` `1` (113/114).
- `npx eslint scripts/one-off/check-commerce-runtime.ts scripts/one-off/check-inventory-runtime.ts scripts/one-off/check-cohort-runtime.ts`: `0`.
- `git diff --stat -- src`: no output; no `src/**` changes survive.

### Group B file status

- `check-commerce-runtime.ts`: audited-and-all-real.
- `check-inventory-runtime.ts`: audited-and-all-real.
- `check-cohort-runtime.ts`: audited-and-all-real.
- `check-fieldjob-runtime.ts`: not reached; primary scope was completed.
- `check-operations-runtime.ts`: not touched; explicitly retained by root.


---

## Root note on the audit method, after three worker passes

Three passes have now run (BP4, Group A, Group B). Combined: **8 assertions examined by real source
mutation, 8 proven real, 1 vacuity found and fixed** — the one BP4 found in `check-capability-contract.ts`.

That hit rate is worth stating plainly, because it changes how the remaining audit should be valued: the
older harnesses are **mostly honest**. The vacuity class is real and has cost this repository twice, but it
is not endemic, and an auditor who "finds" something in every file should be disbelieved rather than
thanked. Two workers returned NO_CHANGE with break evidence and were right to.

### A weakness the Group B pass exposed incidentally, which nobody was asked to look for

Group B recorded its inversion controls alongside its mutation evidence, and the numbers are the finding:

| Harness | assertions | flipped by `INVERT_ASSERTION=1` |
|---|---:|---:|
| `check-commerce-runtime.ts` | 110 | **1** |
| `check-inventory-runtime.ts` | 85 | **1** |
| `check-cohort-runtime.ts` | 114 | **1** |

Compare the harnesses written recently: `check-blueprint-install-runtime.ts` flips 44 of 56,
`check-blueprint-install-schema.ts` 41 of 51, `check-blueprint-preview.ts` its full load-bearing set.

So in these three older files `INVERT_ASSERTION=1` exits non-zero on the strength of a **single**
`checkInvertible` call. The flag is technically satisfied and evidentially near-worthless: it proves that
one assertion can fail, not that the suite can. A future reader running the documented inversion control
would see `exit 1` and reasonably conclude the whole suite was proven falsifiable.

This is the same defect shape as the vacuity class itself — a control that passes for a reason other than
the property it appears to demonstrate — one level up, in the *proof mechanism* rather than the assertion.
Recorded rather than fixed: widening `checkInvertible` coverage across three large harnesses is its own
package, and doing it carelessly would produce a lot of green with no more meaning than before.

### What is left

- `check-fieldjob-runtime.ts` — not reached by either pass.
- `check-operations-runtime.ts` — retained by root for the operations/cohort integration.
- Group C (`check-course-access-runtime.ts`, `check-retainer-runtime.ts`, `check-reservation-authz.ts`) —
  not yet audited.
