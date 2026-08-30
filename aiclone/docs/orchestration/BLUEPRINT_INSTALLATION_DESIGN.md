# Blueprint installation runtime — executable design

Written 2026-08-30 at the close of a night-run, for the run that implements it. It is the top of the
queue in `INTEGRATION_QUEUE.md` and the prerequisite for everything vertical-facing.

**This document is a design, not a claim.** Nothing described here exists yet. The point of writing it
now is that the last two resumes each spent their first hour rediscovering the same facts, and this
package needs a **fresh 3+ hour window** — it should not also pay for discovery.

## The measured starting position

Verified, not assumed, at `59fcfab`:

- `src/lib/business-os/` is a **static registry** and nothing more: `blueprints.ts` 418 lines,
  `engines.ts` 261, `types.ts` 90, `validation.ts` 86, `workflow.ts` 42.
- It has **zero API routes**. `Get-ChildItem -Recurse src/app/api/platform -Filter route.ts` matched
  119 route files at `59fcfab` and **none** of them mention blueprint, install or onboard.
- There is **no durable record** of a blueprint being installed anywhere in `prisma/schema.prisma`.
- Six blueprints are `active`, three `deprecated`, none `draft`. Every engine is composed by at least
  one blueprint.
- Onboarding maps a role to a **corresponding** blueprint (`CORRESPONDING_BLUEPRINT` in
  `src/lib/onboarding-needs.ts`) and says explicitly that this is a correspondence, not an install.

So installation does not exist even in part. This is a build, not an extension.

### The assertion that will fail, on purpose

`check-onboarding-blueprint-coverage.ts` asserts:

```
"no route installs a blueprint, so the map is honest in calling itself a correspondence"
```

It enumerates every platform route and requires none to match `/blueprint|install|onboard/i`. **The
first route you add will turn it red.** That is deliberate: it is the tripwire that forces whoever
builds this to revisit the wording of `CORRESPONDING_BLUEPRINT` and its comment, rather than leaving a
now-false "this does not install anything" in the source. Update both together.

## What "install" has to mean here

A blueprint today is a declaration: engines, capabilities, workflows, copilot prompts. Installing one
must turn that declaration into **workspace-specific configuration** that the rest of the product
already knows how to read. It must NOT fork the application per vertical — that is the whole thesis of
the shared-engine design.

Minimum honest scope:

| Concern | What install does | Where it lands |
|---|---|---|
| Identity | records which blueprint and which **version** is installed | new table |
| Association | binds it to a workspace, and to a profile where relevant | new table |
| Terminology | a pack of label overrides ("job" vs "case" vs "booking") | new table, key/value per install |
| Surfaces | which navigation surfaces and dashboard modules are on | new table, or reuse `Surface` if it can carry a scope |
| Workflow templates | instantiates the blueprint's declared workflows as durable templates | reuse the existing workflow tables — do NOT invent a second one |
| History | append-only record of installs, upgrades and removals | new event table, guarded by `reject_append_only_mutation()` |

**Check `src/lib/surfaces.ts` before adding a surfaces table.** Onboarding already writes surfaces and
field packs per profile (`extrasFromAddons` returns `Surface[]` and `FieldPack[]`). If that mechanism
can carry an install scope, extending it is correct and a second table is duplication.

## Required behaviour

- **Idempotent install.** Installing the same blueprint version twice is a replay, not a second
  install. Use the `(workspaceId, idempotencyKey)` pattern every engine here already uses.
- **Upgrade, not re-install.** A blueprint that `supersedes` another must be installable over it,
  recording both the old and new version. `restaurant-venue-v3` supersedes `v2` supersedes `v1`, so
  this path has real test data.
- **Atomic refusal with zero partial configuration.** A failed install must leave nothing behind. One
  transaction, and a harness that injects a failure at the last step and then asserts every table is
  untouched. This is the single most important assertion in the package.
- **Role-safe defaults.** Installing must not silently grant anybody more access than they had.
- **Preview without installing.** `GET` a blueprint's resolved effect before committing to it. This is
  the part onboarding needs first and is worth landing before install itself.
- **Refuse a blueprint whose required capabilities are not available.** `validateBusinessBlueprint`
  already enforces this for `active` status; install must enforce it again at install time, because a
  capability can regress after a blueprint is declared.

## Migration sequence

Do not deviate. Eleven waves have used it and two resumes have been misled by shortcuts.

```powershell
# Use the PRIMARY runner. wave-c\run-on-rehearsal.js is pinned to a worktree 12+ commits behind and
# reports "17 migrations found" where there are 18 - indistinguishable from a missing migration.
$R = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\wave-a-briefs\run-on-rehearsal-primary.js"
$N = "C:\Users\shubh\AppData\Local\Temp\personalink-phase0\night-run"

node "$N\rehearse-primary.js" backup                 # fresh pg_dump, record bytes + sha256
node "$N\rehearse-primary.js" snapshot pre-install
# edit prisma/schema.prisma, then:
npx prisma format --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
node $R -- node "$N\build-raw-diff-primary.js"       # enumerate every non-additive statement
# build the migration with a builder modelled on build-migration-h0.js: assert the exact table and
# enum names, assert zero ADD COLUMN / ALTER COLUMN / ALTER TYPE / DROP, and write files ONLY after
# every assertion passes
node $R -- npx prisma migrate deploy
node "$N\rehearse-primary.js" snapshot post-install-apply
# apply down.sql from a SPACE-FREE path, then delete the _prisma_migrations row
node "$N\rehearse-primary.js" snapshot post-install-rollback
node "$N\rehearse-primary.js" compare pre-install post-install-rollback   # must be IDENTICAL
node "$N\rehearse-primary.js" compare post-install-apply post-install-rollback  # must DIFFER
node $R -- npx prisma migrate deploy                 # reapply; DB must end APPLIED
node "$N\rehearse-primary.js" compare post-install-apply post-install-reapply
```

Four traps, each of which has already cost this program time:

1. **Hash the post-rollback snapshot against BOTH pre and post.** Equal to post means the rollback did
   not run and every downstream comparison is vacuous. This exact failure produced a worthless
   `h0-rollback` snapshot earlier in this run.
2. **`prisma db execute --file` receives a truncated path if it contains a space.** The rehearsal runner
   spawns with `shell: true` and an args array, so `…\Projects\personal projects\…` arrives as
   `…\Projects\personal`. Copy `down.sql` to a space-free path first.
3. **The five pre-existing `profileId` `DropForeignKey` statements** against `ActivityEvent`, `Contact`,
   `ContactSourceLink`, `WorkflowRun` and `Workspace` must be **excluded with the count asserted**,
   never applied.
4. **Avoid `ALTER TYPE ... ADD VALUE` if there is any alternative.** Postgres cannot remove an enum
   value, so adding one forces the rollback to recreate the type, which reallocates OIDs and implicit
   NOT NULL constraint names — and the byte-identical rollback proof becomes impossible. Wave H0
   extended `FieldJobEvent` by `subjectType` for exactly this reason.

## Harness plan

Three files, matching the convention every other domain follows.

`check-blueprint-install-schema.ts` — tables, enums, FKs verified **by name**, CHECK constraints,
triggers, and a forbidden-table list. Forbid the forks this package could accidentally create:
`BlueprintWorkflow` (workflows are reused), `BlueprintSurface` if `surfaces.ts` turned out to be
extensible, `Terminology` unscoped, and anything vertical-specific such as `SalonConfig`.

`check-blueprint-install-runtime.ts` — the behaviour. The assertions that actually matter:

- install is idempotent on its key, and a replay creates **no second row in any table**;
- a failure injected at the LAST step leaves **zero rows in every table the install touches** — assert
  per-table counts before and after, not just the install's own return value;
- upgrading `restaurant-venue-v2` → `v3` records both versions and leaves one active install;
- installing a blueprint whose required capability is not `available` is refused;
- a foreign workspace and a nonexistent one produce **byte-identical** refusals, compared as
  serialized bodies. Switch identity to the other tenant **before** the comparison, or the test refuses
  at workspace authorization and never reaches install ownership — that mistake has now been made twice
  in this repository, hours apart;
- the install history ledger refuses UPDATE and DELETE by trigger;
- zero fixture residue, and a seed failure **throws** rather than being reported as a refusal.

`check-blueprint-install-routes.ts` — 400/401/403/409/503 envelopes, the 503 body asserted to leak no
DSN (inject a failure carrying a fake connection string), `asOf`-style dates asserted to be ISO
strings, and non-enumeration at the boundary.

Give every load-bearing assertion `checkInvertible` and prove `INVERT_ASSERTION=1` exits non-zero, then
prove a restoration run exits 0.

## Sequencing advice

Land **preview** first: `GET /api/platform/blueprints` and
`GET /api/platform/blueprints/{id}/preview`, read-only, no schema. That is genuinely useful on its own,
it is what an onboarding surface needs first, and it cannot leave the rehearsal database in a bad state.
Then do the schema and install in a second, unhurried pass.

Do not start the migration with less than 90 minutes left, and never leave the disposable database
between apply and reapply.

## What this package must NOT do

- No vertical-specific application fork, and no industry-specific database fork.
- No second workflow engine, no second task queue, no second approval ledger.
- No real messaging, payment, carrier or publication call. Installing a blueprint configures; it does
  not notify.
- No claim of a scheduler. `src/lib/operations` deliberately has none and asserts their absence; do not
  introduce one here without real execution evidence.
