# Scripts

Excluded from `tsc` via `tsconfig.json`. Run from `aiclone/`.

| Path | Use |
|---|---|
| `fixtures/` | Sample resume and rupee-menu text for import tests |
| `test-import.ts` | Import extractor smoke tests |
| `one-off/` | One-shot demo/debug and guarded data-maintenance scripts |

One-off scripts are not part of `npm run dev`. Most expect `DATABASE_URL` in `.env`.

## Restaurant purchase backfill

`scripts/one-off/backfill-restaurant-product-purchases.ts` migrates legacy restaurant `ProductPurchase` rows into immutable `Order`/`OrderLine` snapshots without changing or deleting the source rows. It does **not** load `.env` implicitly: set `DATABASE_URL` explicitly so the target is visible in the invoking terminal.

The script is read-only unless `--apply` is present. Apply mode also requires `--database=<exact-db-name>` to match the database parsed from `DATABASE_URL`; unknown, duplicate, and conflicting flags fail closed.

```powershell
$env:DATABASE_URL = 'postgresql://user@127.0.0.1:5432/restored_copy'
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/backfill-restaurant-product-purchases.ts --cutoff=2026-08-27T00:00:00.000Z
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/one-off/backfill-restaurant-product-purchases.ts --apply --database=restored_copy --cutoff=2026-08-27T00:00:00.000Z
```

Grouping is deterministic and versioned: exact restaurant profile plus trimmed/lower-cased visitor email, ordered by creation time and purchase ID, with a maximum 5-second adjacent gap and 60-second total span. Notes must fully match `xN` or `xN · modifier prose`; modifier labels must map uniquely to the current dish catalog. Current product and modifier prices are explicitly marked as inferences in line-scoped `BACKFILL` events. Unsafe rows/groups are skipped and reported only through one-way references. `Order.legacyGroupKey` and `OrderLine.legacyPurchaseId` make reruns idempotent.
