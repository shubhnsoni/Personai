# Scripts

Excluded from `tsc` via `tsconfig.json`. Run from `aiclone/`.

| Path | Use |
|---|---|
| `fixtures/` | Sample resume and rupee-menu text for import tests |
| `test-import.ts` | Import extractor smoke tests |
| `one-off/` | One-shot demo/debug and guarded data-maintenance scripts |
| `fill-skydine.mjs` | Demo seed for SkyDine Cafe only — not product defaults |
| `optimize-ar-assets.ts` | Compress GLBs; default dir `public/uploads/skydine-ar` |

One-off scripts are not part of `npm run dev`. Most expect `DATABASE_URL` in `.env`.

## Demo fixture (SkyDine Cafe)

SkyDine Cafe (Hinoo, Ranchi, slug `skydine-cafe`) is a **demo restaurant**. Seed it with `fill-skydine.mjs`. Assets live in `public/uploads/skydine-cafe/` and `public/uploads/skydine-ar/`.

Do not copy Hinoo address, hours, Instagram, or printer chrome into shared UI. Other kits read `personalityConfig.venue`, `AvailabilitySchedule`, and `src/lib/kit-copy.ts`.

## Restaurant purchase backfill

`scripts/one-off/backfill-restaurant-product-purchases.ts` migrates legacy restaurant `ProductPurchase` rows into immutable `Order`/`OrderLine` snapshots without changing or deleting the source rows. It does **not** load `.env` implicitly: set `DATABASE_URL` explicitly so the target is visible in the invoking terminal.

The script is read-only unless `--apply` is present. Apply mode also requires `--database=<exact-db-name>` to match the database parsed from `DATABASE_URL`; unknown, duplicate, and conflicting flags fail closed.

```powershell
$env:DATABASE_URL = 'postgresql://user@127.0.0.1:5432/restored_copy'
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/backfill-restaurant-product-purchases.ts --cutoff=2026-08-27T00:00:00.000Z
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/backfill-restaurant-product-purchases.ts --apply --database=restored_copy --cutoff=2026-08-27T00:00:00.000Z
```

Grouping is deterministic and versioned: exact restaurant profile plus trimmed/lower-cased visitor email, ordered by creation time and purchase ID, with a maximum 5-second adjacent gap and 60-second total span. Notes must fully match `xN` or `xN · modifier prose`; modifier labels must map uniquely to the current dish catalog. Current product and modifier prices are explicitly marked as inferences in line-scoped `BACKFILL` events. Unsafe rows/groups are skipped and reported only through one-way references. `Order.legacyGroupKey` and `OrderLine.legacyPurchaseId` make reruns idempotent.

## Live order transport

`scripts/one-off/check-order-stream.ts` verifies Phase 1. It checks in-process fan-out and scoping, that both stream endpoints reject unauthenticated and unknown-token requests, idle survival with heartbeats, `Last-Event-ID` replay, and cursor-poll latency. Point `--base` at any origin to test a specific hop:

```powershell
$env:DATABASE_URL = 'postgresql://user@127.0.0.1:5432/restored_copy'
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/check-order-stream.ts --idle-seconds=330
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/check-order-stream.ts --base=https://<tunnel-host>
```

Either transport is acceptable and the report names the one that carried the updates. A Cloudflare **quick** tunnel buffers streaming responses, so the event stream delivers zero frames through it and the cursor poll is what keeps such a client current; a direct origin delivers the stream normally.
