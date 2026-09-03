# All-ends specs

Analysis of every PersonaLink kit, written 2026-09-03 from five explore agents. Combined sequence and non-goals: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).

**Status:** implemented 2026-09-03 (phases A–F on the guest loop). SkyDine Cafe remains a demo fixture (`scripts/fill-skydine.mjs`); shared UI no longer uses Hinoo/Ranchi defaults.

**Shipped**
- A kit nouns: `src/lib/kit-copy.ts` + `src/lib/story.ts` labels
- B FillFromListing: `src/lib/google-place.ts` (country-agnostic), `src/lib/venue.ts`, `src/app/actions/listing.ts`, Profile → General “Fill from Google”
- C About footer from venue + hours, not Hinoo
- D Photoreal gated on `ar` pack; AR size pack defaults
- E chat chips per kit; SESSION kits use ReserveSheet
- F SkyDine leaks stripped from receipts, photos, menu fallback, editor placeholders

Restaurant (SkyDine Cafe, Hinoo, Ranchi) is the reference guest loop. Every other kit is that loop with a different catalog and primary button.

| Doc | End | Kits |
|---|---|---|
| [00-shared-spine.md](00-shared-spine.md) | Contract all ends share | all |
| [01-restaurant.md](01-restaurant.md) | Reference | `RESTAURANT` |
| [02-shop-creator.md](02-shop-creator.md) | Catalog / files | `SHOP`, `CREATOR` |
| [03-time.md](03-time.md) | Sessions / visits | `CONSULTANT`, `CA`, `SALON_SPA`, `FIELD_SERVICE`, `COACH` |
| [04-lead-portfolio.md](04-lead-portfolio.md) | Work / leads | `DESIGNER` (+ aliases), `JOB_SEEKER`, `EVENTS_STUDIO`, `REAL_ESTATE_BROKERAGE`, `RECRUITMENT_AGENCY`, `CUSTOM` |

## Invariant (short)

Chat homepage. One About route. One `DigitalProduct` catalog. One `Booking` guest engine. FillFromListing is preview-then-apply. Photoreal 3D is an `ar` pack, always optimized. Closed sidebar — packs, docks, sheets, chips. Never a new nav item.

## Phase order

A freeze contract → B FillFromListing → C About every kit → D 3D (parallel with A) → E chat chips → F leaks + polish.

C needs B or the About footer still lies. D is independent of B/C.

## Stale sibling

[`docs/specs/restaurant-integration/`](../restaurant-integration/tasks.md) still says nothing is started. Phases 0–4 there are largely in code. Do not add Orders to `navGroups`.
