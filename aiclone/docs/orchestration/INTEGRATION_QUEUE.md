# Integration Queue

Updated: 2026-08-27 07:20 +05:30

Nothing is mergeable yet. No lane has produced a commit, and the three lanes that
produced code disagree on the core domain type.

## Observed lane state

| Lane | Branch | Commits | Files | Lines | State |
|---|---|---:|---:|---:|---|
| core | `kirocrew/business-os-phase-1` | 0 | 7 | 330 | domain draft, uncommitted |
| api | `kirocrew/business-os-api` | 0 | 6 | 209 | transport draft, uncommitted, collides with core |
| ui | `kirocrew/business-os-ui` | 0 | 3 | 294 | static mock, uncommitted, no data binding |
| quality | `kirocrew/business-os-quality` | 0 | 0 | 0 | produced nothing |
| docs-verticals | `kirocrew/business-os-docs` | 0 | 0 | 0 | produced nothing |
| integration | `kirocrew/business-os-integration` | 0 | 0 | 0 | produced nothing |

All six worktrees are checked out at `ea69595`. No frozen path was touched by any lane.

## Blockers

1. **Three-way domain divergence.** `core`, `api`, and `ui` each define a different
   `Blueprint` type in the same namespace. Resolved by ADR-005: the engine-composition
   model wins. The other two must be rewritten against it before anything merges.
2. **Same-file collision.** `core` and `api` both wrote
   `src/app/api/business-os/blueprints/route.ts`. Resolved by ADR-006: keep the `api`
   envelope, error map, and `limit` validation; drop its blueprint data; serve the
   canonical registry; and use `force-dynamic`, not `force-static`.
3. **Unachievable quality gate.** Every lane branched from `ea69595`, which could not
   pass `npm run build`. See ADR-007. Rebase onto `e97edf4` or later before asking any
   lane to satisfy QUALITY_GATES.md.
4. **UI is not wired.** `src/app/dashboard/business-os/page.tsx` is `force-static` over
   `sample-data.ts`. It proves layout and nothing else.
5. **No surface registration.** `business-os` is absent from `Surface` in
   `src/lib/surfaces.ts`, from `KIT`, and from `navHrefToSurface`/`surfaceForPath`, so
   `/dashboard/business-os` is unreachable except by direct URL and is ungated by role.
   `surfaces.ts` is a frozen path, so this needs an owner-reviewed patch.

## Remediation order

1. Rebase all six lanes onto current `recovered/aug20-wt-pr-32` HEAD.
2. Land the canonical domain layer from `core` unchanged: `types.ts`, `engines.ts`,
   `blueprints.ts`, `validation.ts`, `workflow.ts`, `index.ts`.
3. Rewrite the `api` lane against it: keep `contracts/errors.ts` and `api/responses.ts`,
   delete `api/blueprints.ts`, and have both routes read the canonical registry.
4. Rewrite the `ui` lane to derive its view model from the canonical type and fetch from
   the API instead of importing sample data. Delete `ui/sample-data.ts`.
5. Only then propose the `surfaces.ts` patch that registers the surface and grants it,
   as an owner-reviewed diff.
6. Each lane attaches evidence per QUALITY_GATES.md: commands run, `tsc` and build
   results, and known gaps.

## Ready for read-only worker analysis

- Engine contract extraction from the now-canonical `business-os` domain layer.
- Vertical wave mapping from `docs/strategy/vertical-opportunity-scorecard.csv`.
- Owner Copilot requirements draft, which has no blocking dependency on the above.
