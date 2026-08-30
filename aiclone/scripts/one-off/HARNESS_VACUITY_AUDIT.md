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
