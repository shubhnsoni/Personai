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


## Group C — S3-A course access, retainers, and reservations

### Scope and method

Audited only the three assigned Group C runtime harnesses through the CWD-aware
rehearsal runner from the assigned `s3a/vacuity-group-c` worktree. Every runner
invocation identified that worktree and the authorized rehearsal database. Fixture
IDs use each harness's timestamp-plus-random run prefix; every run reported its
baseline counts restored and its append-only triggers re-armed.

### Evidence table

| Assertion / coverage claim | Harness location | Protected code | Break performed | Result |
| --- | --- | --- | --- | --- |
| Shared per-lesson rule agrees with the list's five representative cases | `check-course-access-runtime.ts:571` | `cohorts/access.ts:1105` unrestricted-rule branch | Changed `if (!rule) return true` to `return false` | Red: 85/87; this and the per-lesson/list agreement assertion failed. Restored run green 87/87. |
| Shared rule and list agree for every lesson | `check-course-access-runtime.ts:588` | Same branch | Same mutation | Red with the named disagreement details; real, no fix needed. |
| An owned but unlinked case cannot draw against a retainer | `check-retainer-runtime.ts:294` | `cases/retainers.ts:744` case-link guard | Changed `if (!link)` to `if (false)` | Red: 86/87. The fixture uses owner A, A's workspace, and A's unlinked case, so it reaches the per-row link guard. Restored run green 87/87. |
| Foreign reservation get is forbidden | `check-reservation-authz.ts:190` | `reservations/engine.ts:217` `row.profileId !== profileId` ownership guard | Removed only the profile comparison | Red: 33/36; foreign get leaked. The caller is user B in B's valid workspace, proving the outer workspace guard was passed before the ownership check. |
| Foreign and nonexistent reservation responses are identical | `check-reservation-authz.ts:195` | Same ownership guard | Same mutation | Red: foreign accepted while nonexistent remained forbidden. |
| Foreign reservation history is forbidden | `check-reservation-authz.ts:436` | Same guard, reached by `history` | Same mutation | Red: foreign history leaked. Restored run green 36/36. |

### Conclusion

No proven assertion vacuity was found. Six assertions were source-mutated and all
turned red against the named behavior; no harness changes or commit are warranted.

One **suspected but unfixed proof gap** is recorded, not promoted to a finding:
removing both `FOR UPDATE` clauses at `cases/retainers.ts:713` and `:928` left the
existing two-draw concurrency run green (87/87). That does not prove the assertion
vacuous: it names the observable additive outcome, which PostgreSQL scheduling may
still preserve without those specific locks. Making the test claim lock necessity
would require a deterministic read-interleaving harness, not source-text inspection;
no careless widening was made.

### Validation

- Course access: normal `0` (87/87); inversion `1` (86/87), **1** assertion flipped; source mutation `1` (85/87); restored normal `0` (87/87).
- Retainer: normal `0` (87/87); inversion `1` (86/87), **1** assertion flipped; owned-but-unlinked guard mutation `1` (86/87); restored normal `0` (87/87). Lock-removal probe remained `0` (87/87), recorded above.
- Reservation authorization: normal `0` (36/36); inversion `1` (35/36), **1** assertion flipped; ownership mutation `1` (33/36); restored normal `0` (36/36).
- `npx eslint scripts/one-off/check-course-access-runtime.ts scripts/one-off/check-retainer-runtime.ts scripts/one-off/check-reservation-authz.ts`: `0`.
- `git diff --stat -- src`: no output; no `src/**` change survives.

### Group C file status

- `check-course-access-runtime.ts`: audited; two directly mutated assertions real.
- `check-retainer-runtime.ts`: audited; owned-unlinked case refusal real; concurrency-lock necessity is an explicitly unfixed proof gap, not a certified vacuity.
- `check-reservation-authz.ts`: audited; the Shape 3 ownership concern is disproven by a caller that passes workspace authorization and reaches row ownership.
- `check-operations-runtime.ts`: not reached; explicitly retained by root.
- `check-fieldjob-runtime.ts`: not reached; outside this assignment.


---

## Root note 2 — after Group C: the audit's most useful result is a proof gap, not a vacuity

Final cross-pass tally: **14 assertions examined by real source mutation, 14 proven real, 1 vacuity
found and fixed** (BP4's, in `check-capability-contract.ts`). Four workers, four passes, one defect.

That is the headline and it should be read the right way round: **the assertion suite is substantially
honest.** The vacuity class is real, it has cost this repository twice, and it is worth hunting — but it is
not endemic, and three of four auditors correctly returned NO_CHANGE rather than manufacturing a finding.
An auditor who reports something in every file should be disbelieved.

### The finding that matters more than a vacuity

Group C surfaced something the brief did not ask for and which no vacuity check would have caught.
`check-retainer-runtime.ts:350` runs two parallel draws and claims they prove the `FOR UPDATE`
serialization locks at `src/lib/cases/retainers.ts:713` and `:928`. **Removing BOTH `FOR UPDATE` clauses
left the harness green, 87/87.**

The auditor then did the harder and more valuable thing: it declined to call that vacuity. Its reasoning is
correct and worth preserving — the assertion's named property is the *observable additive outcome*, and
Postgres scheduling can preserve that outcome without those particular locks. So the assertion is not
lying about what it checks; it is checking something weaker than a reader would assume from its name. The
locks may well be necessary under contention the test never creates.

**This is a distinct defect class from vacuity, and it needs a distinct name.** A vacuous assertion tests
nothing. This assertion tests something real, but its NAME claims a mechanism it does not exercise. Call it
an over-claiming assertion. It cannot be found by mutation alone — mutation says "green", which for a
vacuity means "broken" and here means "insufficiently constrained" — and the two are only distinguishable
by reasoning about what the property logically requires.

Proving lock necessity needs deterministic read interleaving: two transactions held open at chosen points,
not two promises raced. That is a real technique this repository does not currently use anywhere. Recorded
as READY work with a known method, not as a bug.

### The proof-mechanism weakness is now confirmed across six harnesses

`INVERT_ASSERTION=1` flips exactly **one** assertion in each of `check-commerce-runtime` (110),
`check-inventory-runtime` (85), `check-cohort-runtime` (114), `check-course-access-runtime` (87),
`check-retainer-runtime` (87) and `check-reservation-authz` (36).

Six for six. This is not legacy drift, it is the house habit — and `check-cohort-needs-action.ts` shipped
with the same 1-of-32 shape in this very run before root widened it to 29-of-32. So it must be caught at
review, on new files, rather than audited later.

### What is left

- `check-fieldjob-runtime.ts` — still not reached by any pass.
- `check-operations-runtime.ts` — retained by root.
- Widening `checkInvertible` coverage across the six harnesses above — its own package. Doing it carelessly
  produces a lot of green with no more meaning than before.
- A deterministic-interleaving technique for lock-necessity claims, then re-examining
  `check-retainer-runtime.ts:350`.


## Group D — S4-B fieldjob runtime and deterministic retainer lock necessity

### Scope and method

Audited only `check-fieldjob-runtime.ts` and `check-retainer-runtime.ts` through the
CWD-aware rehearsal runner in the assigned `s4b/fieldjob-and-lock-necessity`
worktree. The runner reported that exact checkout and the authorized rehearsal
database. Every temporary `src/**` mutation was restored byte-for-byte; no source
change survives.

### Fieldjob evidence

| Assertion / coverage claim | Harness location | Protected code | Break performed | Result |
| --- | --- | --- | --- | --- |
| A visit window with a start and no end is refused | `check-fieldjob-runtime.ts:~302` | `fieldjobs/engine.ts`, `schedule()` visit-window discriminator | Replaced `if (!both && !neither)` with `if (false)` temporarily | Red: `76/77`, exit `1`; exactly this assertion failed. Restored source has no diff. |

The sole fieldjob source-broken assertion is real. No harness change was warranted.

### Deterministic retainer read interleaving

The old `Promise.all` draw pair proved the additive result but did not force a
concurrent read. The new harness creates a separate active unit retainer and arms a
Prisma query middleware barrier only for that period. T1 calls the real
`CaseRetainerService.recordDraw(3)` and is held *after* its real
`CaseRetainerPeriod.findUnique` returns the balance, while its interactive
transaction and source-level locks stay open. T2 then calls the same real method
with `5`. The barrier records whether T2 reaches its own balance read and whether
it commits before T1 is released; it releases T1 in `finally`, so no SQL timeout,
deadlock, or aborted transaction is used as evidence.

The successful locks-present run empirically demonstrated that the available Prisma
pool can hold both interactive transactions: T1 reached its balance read, T2 was
started while T1 remained open, and T2 could not reach that read before release.
After release both fulfilled and the period moved `0 -> 8` (`88/88`, exit `0`).

For the red mutation, only the two `recordDraw` clauses named by the audit were
removed temporarily: the open-period `FOR UPDATE` at `retainers.ts:713` and the
retainer `FOR UPDATE` at `retainers.ts:928`. T2 then reached the same balance read
and committed before release; T1 resumed with its stale `0` and overwrote the
period, yielding `0 -> 3`. The new assertion failed exactly as intended (`87/88`,
exit `1`). Source was restored exactly.

### Conclusion

This is **not** an over-claiming assertion anymore. Deterministic read interleaving
proves the lock necessity claim against the real service method: the two `FOR UPDATE`
reads serialize concurrent draws, and removing both permits the forced stale-read
lost update. The old opportunistic parallel-draw assertion remains useful for its
observable additive outcome; the new assertion carries the mechanism claim.

### Validation

- Fieldjob: normal `0` (`77/77`); visit-window source mutation `1` (`76/77`); source restored.
- Retainer: normal with deterministic interleaving `0` (`88/88`); both target locks removed `1` (`87/88`); source restored.
- `git diff --stat -- src`: no output; no `src/**` changes survive.


## Group F — N1-A deterministic inventory lock necessity

### Scope and method

Audited the inventory reservation lock claim through the CWD-aware rehearsal runner from the assigned
`n1a/inventory-lock-necessity` checkout. The new inert-by-default Prisma middleware barrier pauses T1 at
its `InventoryItem.update`, after the real `InventoryService.reserve()` balance read and engine guard but
before the absolute `reserved` write. T2 then calls the same service method while T1 remains open. The
barrier always releases T1 in `finally`; no deadlock, lock timeout, or SQL error is accepted as evidence.

All inventory mutations use the single centralized `InventoryContext.lockItem()` query. The controlled
mutation removed its sole `FOR UPDATE` clause, reran the identical interleaving, and restored the source
exactly.

### Evidence

| Claim | Locks present | Central `FOR UPDATE` removed | Conclusion |
| --- | --- | --- | --- |
| T2 reaches the post-read/prewrite point while T1 is held | No; T1 reached the barrier, T2 did not reach it or settle before release | Yes; T2 reached it and committed before T1 was released | The row lock creates the serialization; scheduling and the Prisma pool do not |
| Reservation outcomes | T1 fulfilled; T2 received engine `CONFLICT: Only 2 units are available; 3 were requested` | Both fulfilled | The lock makes the second engine guard observe the committed first hold |
| Item aggregate | `onHand=5`, `reserved=3` | `onHand=5`, `reserved=3` | Without the lock, T1 overwrote T2 with the same stale absolute value `3` |
| Active hold rows | 1 row, quantity sum 3 | 2 rows, quantity sum 6 | Both promises persisted without the lock |
| RESERVE movements | 1 row, delta sum 3, after-value 3 | 2 rows, delta sum 6, after-values `3,3` | The unlocked aggregate silently diverged from both ledgers |
| Database CHECK | Satisfied | Satisfied; no refusal | `reserved <= onHand` sees only stale `3 <= 5` and cannot compare active-hold or movement sums |

### Conclusion

The measured unlocked outcome is a **lost update** that also leaves six units promised against five on
hand. It is not a row-level `reserved > onHand` oversell and not a database CHECK refusal: both absolute
writes store `reserved=3`, so the CHECK remains green while two active holds total 6. The engine guard alone
cannot prevent this because both transactions read the same pre-update `reserved=0` and both pass. The row
lock preserves serialization, making the second guard see `reserved=3` and refuse the second request; the
CHECK preserves only the narrower single-row arithmetic invariant as a backstop.

### Vacuity and validation

All three new load-bearing assertions use `checkInvertible`. Normal execution passed 88/88; the controlled
lock-removal mutation failed exactly those three assertions at 85/88; restored sequential inversion passed
9/88 and exited non-zero, so 79 assertions flipped, including all three new assertions. This is a real,
non-vacuous harness improvement.

- Production-lock run: exit `0`, 88/88.
- Lock-removal mutation: exit `1`, 85/88.
- Restored production run, sequential: exit `0`, 88/88.
- `INVERT_ASSERTION=1`, sequential: exit `1`, 9/88 (79 flipped).
- `npx eslint scripts/one-off/check-inventory-runtime.ts`: exit `0`.
- `git diff --stat -- src`: exit `0`, no output; no `src/**` changes survive.
- Every run reported all five tracked fixture-table counts returned to baseline and the append-only trigger re-armed.
