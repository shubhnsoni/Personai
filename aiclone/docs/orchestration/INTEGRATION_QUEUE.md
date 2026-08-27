# Integration Queue

Updated: 2026-08-27 10:15 +05:30

The consolidation exists and has been independently reviewed. Nothing has been merged into
`recovered/aug20-wt-pr-32`, and nothing has been pushed.

## Ready for owner review — `orchestrator/business-os-consolidation`

Branched from `a4d9fba`. Worktree `../personai-business-os-consolidation-wt`.

| Commit | Scope |
|---|---|
| `627b826` | P1-001 consolidation onto the canonical domain model |
| `8c58870` | P1-002 surface registration and server-side gate |
| `3ded129` | session-free verification harness |
| `95839a5` | fixes from independent review |

Gates at `95839a5`, each run in that worktree: `prisma validate` 0, `prisma generate` 0,
`tsc --noEmit` 0, targeted `eslint` 0, both check scripts 0 reporting PASS, `next build` 0
with all three routes registered dynamic. Repo-wide `npm run lint` exits 1 with 124
problems and 63 errors — **identical to the `a4d9fba` baseline**, with zero findings in any
new file. That gate cannot pass at this baseline; see blocker 1.

Accepted, rejected and added files are enumerated in the commit messages. No restaurant
path, no Prisma file and no migration is touched.

## Blockers

1. **`npm run lint` cannot pass.** The baseline carries 63 pre-existing errors across
   unrelated and owner-reviewed files (`profile-editor.tsx` 12, `product-form.tsx` 6,
   `actions/profile.ts` 5, `actions/courses.ts` 4, and others). Clearing them means editing
   files outside this scope, including restaurant-owned ones. The achievable standard was met
   instead: targeted lint clean, and provably no regression against baseline. Decide whether
   to fund a separate lint-cleanup task.
2. **No Clerk keys in this environment.** The signed-in path cannot be exercised, so the
   `FORBIDDEN`, `BAD_REQUEST` and `NOT_FOUND` API branches and the authenticated page render
   are verified by direct function assertion rather than over HTTP. Unauthenticated 401 with
   the envelope was confirmed over HTTP on both routes.

   Correction to an earlier claim: a **literally** malformed percent sequence in the URL
   (`/api/business-os/blueprints/%E0%A4%A`) never reaches the application. Next.js rejects it
   at the framework level with **400 `text/html`** before the handler runs, so it does not
   produce the Business OS JSON envelope. Only an *encoded* percent
   (`/%25E0%25A4%25A`, which decodes to the literal string `%E0%A4%A`) reaches the route and
   returns the 401 envelope. Both were measured. The `parseBlueprintId` guard and its unit
   assertions are still correct and still worth keeping — they defend the decode step for
   inputs that do reach the handler — but no claim should be made that all malformed URLs
   surface through the application envelope.

   Owner decision recorded: missing Clerk keys are not a blocker. Deterministic mocked
   authentication, authorization and tenant-isolation tests are queued as P1-008 instead of
   requesting real credentials.
3. **The workflow layer does not execute.** `planWorkflowRun`, `listApprovalGates` and
   `AuditEvent` have no consumers. The UI now says so explicitly, but any vertical whose
   safety boundary involves money or outbound messaging is gated on this becoming real. See
   `OWNER_COPILOT_SPEC.md` section 2 for the ledger that would back it.
4. **Capability vocabulary is coarser than the contract.** `engines.ts` declares three
   capability ids per engine while `ENGINE_CONTRACTS.md` names eight or nine owned nouns, so
   deposits, documents, variants and returns are not addressable by any blueprint. Needs an
   ADR either way — see `VERTICAL_BLUEPRINT_MAP.md` section 6.
5. **Two active-blueprint capabilities overstate reality.** `venueOrders.reservations` is a
   JSON blob on a generic `Booking` with no relation to `RestaurantTable`, and
   `commerce.inventory` is one nullable `stock` column. Both are declared required on
   `restaurant-venue-v1`, the only `active` blueprint. Either implement them or drop them
   from that blueprint.

## Superseded, retained as evidence

The six original lane worktrees remain at `ea69595` with their uncommitted drafts intact and
untouched — not rebased, not stashed, not deleted. A read-only snapshot with a SHA-256
manifest is at `../personai-lane-evidence-20260827/` (16 files). The rejected
`BusinessOsBlueprint` steps-and-stages model still exists there by design; retire those
worktrees only after the consolidation is merged.

## Ready for read-only worker analysis

- Engine contract versus capability-id reconciliation (blocker 4), producing an ADR.
- Owner copilot ledger schema review ahead of any migration request (blocker 3).
