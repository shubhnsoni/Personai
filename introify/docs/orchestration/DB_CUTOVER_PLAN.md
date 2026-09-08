# Live Database Cutover — Preparation Only

Updated: 2026-08-27 10:15 +05:30
Status: **NOT APPROVED FOR EXECUTION.** Nothing in this document has been run against
`personalink`. It is written so the cutover can be reviewed before it is attempted.

## Current live state, measured

Verified by read-only query against `personalink`:

| Fact | Value |
|---|---|
| Tables in `public` | 35 |
| Rows across those tables | 774 |
| `_prisma_migrations` rows | **0** (the table is absent) |
| `ProductPurchase` rows | 8 (7 restaurant, 1 non-restaurant) |
| `Order`, `OrderLine`, `OrderEvent`, `RestaurantTable`, `OrderCounter`, `ProfileImage` | **absent** |

The important consequence: this database has **no migration history at all**. It cannot
receive `20260826223000_restaurant_order_foundation` directly, because Prisma would try to
replay the six earlier migrations against a schema that already contains their tables. The
six historical names must be marked as already applied first. That is exactly the sequence
already rehearsed on `personalink_phase0_rehearsal_20260826_210704`.

## Artifacts that already exist

| Artifact | Purpose |
|---|---|
| `backups/personalink-phase0-2026-08-26-210704.dump` (120,061 bytes) | pre-change backup taken before any of this work |
| `personalink_phase0_rehearsal_20260826_210704` | restored real-data copy, seven migrations current, zero drift, backfill applied |
| `personalink_phase0_clean_20260826_221845` | empty replay copy, seven migrations current, zero drift |
| `scripts/one-off/backfill-restaurant-product-purchases.ts` | default dry-run, requires `--apply` plus an exact `--database` acknowledgement |

## Step 1 — Fresh backup checklist

The existing dump is from 2026-08-26 and is not sufficient for a cutover today. Take a new
one immediately before the migration, in the same session.

- [ ] Confirm nothing is writing: stop the dev server and confirm no listener on port 3000.
- [ ] Record the pre-backup inventory: table count, total rows, and `ProductPurchase` count.
- [ ] Take the dump to a timestamped filename, custom format:
      `pg_dump --format=custom --file=backups/personalink-precutover-<UTC timestamp>.dump personalink`
- [ ] Assert the file is non-empty and note its byte size.
- [ ] Verify the dump lists the expected objects: `pg_restore --list` should show 35 `TABLE`
      and 35 `TABLE DATA` entries.
- [ ] **Prove the backup restores** into a throwaway database before touching the original.
      A dump that has never been restored is a hope, not a backup:
      `createdb personalink_restoretest_<ts>` then
      `pg_restore --dbname=personalink_restoretest_<ts> --no-owner <dump>`
- [ ] Compare the restore-test inventory to the pre-backup inventory. They must match
      exactly. Record both.
- [ ] Only then proceed. Keep the restore-test database until the cutover is verified.

## Step 2 — Dry run on an isolated disposable database

Never rehearse on `personalink`. Rehearse on a copy created from the fresh dump.

- [ ] `createdb personalink_cutover_rehearsal_<ts>` and restore the **fresh** dump into it.
- [ ] Point `DATABASE_URL` at that copy for every command below. Never export a URL naming
      `personalink` during rehearsal.
- [ ] Mark the six historical migrations as already applied, in order:
      `npx prisma migrate resolve --applied 20251125082337_init`, then
      `20260816100000_profile_photo`, `20260816120000_members`,
      `20260816140000_memory_live`, `20260819120000_restaurant_menu`,
      `20260826120000_review_photo`.
- [ ] `npx prisma migrate status` must report six applied and one pending.
- [ ] `npx prisma migrate deploy` to apply `20260826223000_restaurant_order_foundation`.
      Use `deploy`, never `dev`: `dev` may offer to reset the database.
- [ ] `npx prisma migrate status` must report seven applied, none pending.
- [ ] `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel
      prisma/schema.prisma --exit-code` must print `No difference detected.`
- [ ] Confirm the six new tables exist and the pre-existing row counts are unchanged.
- [ ] Backfill dry run first, which writes nothing:
      `... backfill-restaurant-product-purchases.ts --cutoff=<fixed ISO>`
      Record eligible, unsafe and already-applied counts. Investigate any unsafe row before
      continuing; the script reports them by one-way reference and never guesses a quantity.
- [ ] Backfill apply, with the acknowledgement naming the rehearsal database:
      `... --apply --database=personalink_cutover_rehearsal_<ts> --cutoff=<same ISO>`
- [ ] Re-run apply. It must create nothing and report every source row already applied.
- [ ] Confirm all 8 `ProductPurchase` rows still exist and are unmodified.
- [ ] Run `check-order-stream.ts` against the rehearsal copy to confirm the live transport
      works on the migrated schema.

Record every exit code. If any step deviates, stop and report rather than improvising.

## Step 3 — The real cutover, once approved

Same commands, `DATABASE_URL` pointing at `personalink`, with these additions:

- [ ] The fresh backup from step 1 exists, has been restore-proven, and its path is recorded.
- [ ] Announce a short write freeze; the app should not be serving writes during the
      migration.
- [ ] Use the **same fixed `--cutoff`** value rehearsed in step 2, so the planned group set
      is reproducible rather than time-dependent.
- [ ] `--database=personalink` must be typed explicitly. The script refuses to write
      without an exact match against the parsed database name.
- [ ] Run the backfill dry run against `personalink` and diff its counts against the
      rehearsal run. Any difference means the data moved since rehearsal; stop and re-plan.
- [ ] Apply, then immediately re-run apply to confirm idempotency on the real database.

## Step 4 — Verification

- [ ] `npx prisma migrate status`: seven applied, none pending.
- [ ] `npx prisma migrate diff ... --exit-code`: `No difference detected.`
- [ ] Row counts: every pre-existing table matches the pre-cutover inventory. `ProductPurchase`
      is still 8.
- [ ] The six new tables exist. `Order` count equals the backfill's reported created orders.
- [ ] `OrderLine.legacyPurchaseId` is unique and every value maps to a surviving
      `ProductPurchase` row.
- [ ] Each created order satisfies the database constraints: `total = subtotal + tax`,
      `lineTotal = (unitPrice + unitModifier) * qty`, positive daily number.
- [ ] `OrderCounter` for each affected business date is at least the maximum `Order.number`
      for that profile and date.
- [ ] Every created line has a line-scoped `BACKFILL` event recording its price inference.
- [ ] Load `/dashboard/orders` and one receipt against the live database and confirm totals
      match the backfill report.
- [ ] Confirm the AR guards still pass: `check-ar-layout.mjs` and `check-usdz.mjs`.

## Step 5 — Rollback

Two failure classes, two different responses.

**Migration failed or drift detected, before or during the backfill.** Restore, do not
patch forward:

1. Stop the app.
2. `dropdb personalink` then `createdb personalink`.
3. `pg_restore --dbname=personalink --no-owner backups/personalink-precutover-<ts>.dump`
4. Re-run the step 4 inventory and confirm it matches the pre-cutover numbers.
5. Restart the app. The application code tolerates the pre-migration schema only if the
   restaurant order features are not exercised, so also decide whether to redeploy the
   previous build.

**Backfill produced wrong orders but the migration is sound.** The backfill only inserts;
it never modifies or deletes `ProductPurchase`. So the narrower repair is available:

1. Delete the created orders by their provenance key, which is safe because it targets only
   rows this script created: `DELETE FROM "Order" WHERE "legacyGroupKey" LIKE 'rppb:v1:%'`.
   `OrderLine` and `OrderEvent` cascade from `Order`.
2. Reset the affected `OrderCounter` rows, or delete them; the allocator floors itself from
   `MAX(Order.number)` so a deleted counter row rebuilds correctly.
3. Confirm `ProductPurchase` is still 8 rows and unmodified.
4. Re-plan and re-run the dry run before applying again.

Prefer the full restore whenever the state is uncertain. The narrow repair is only for the
case where the migration is verified sound and the fault is isolated to inserted orders.

## Risks to weigh before approving

1. **No migration history on live.** The `migrate resolve` step is the highest-risk part,
   because marking a migration applied without running it is an assertion about the current
   schema. It was rehearsed successfully, but it must be rehearsed again on the fresh dump.
2. **Price inference is not recoverable fidelity.** The backfill snapshots today's product
   and modifier prices, because `ProductPurchase` never stored a price. Every inference is
   recorded in the `BACKFILL` event, but the historical orders will not necessarily show
   what the guest actually paid. That is a business decision, not a technical one.
3. **The `COMPLETED → PAID` mapping is untested on real data.** All seven live restaurant
   rows are `PENDING`. If any becomes `COMPLETED` before cutover, that path executes for the
   first time in production.
4. **Only one live database exists.** There is no staging instance, so the rehearsal copy is
   the only safety net besides the dump.
