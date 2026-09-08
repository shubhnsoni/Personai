# Restaurant end (reference)

Kit grant in `src/lib/surfaces.ts`: `RESTAURANT` → surfaces `home`, `profile`, `inbox`, `shop`, `calendar`, `sales`; packs `menuDish`, `ar`, `tableBook`, `whatsappUpi`. Shop nav label is **Menu**; calendar noun is **Reservations**. Money nav remaps to Floor (`/dashboard/orders`).

SkyDine Cafe (slug `skydine-cafe`, profileId `cmt0yfos200038cdqbccjmprd`) is the seeded demo. It is not the schema.

Combined sequence: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).

The sibling spec [`docs/specs/restaurant-integration/`](../restaurant-integration/tasks.md) is stale. Kitchen orders, tables, QR, receipts, and Floor remap are in code. Do not add Orders to nav.

---

## 1. Guest path (what works)

### Chat `/{slug}`

- `[slug]/page.tsx` loads a public profile, auto-creates a `TABLE` service if missing, loads published story flag, renders `ProfileView`.
- Restaurant skips orb intro (`introStage = "ready"`).
- Goal `BOOK_TABLE` chips: **Menu** → `/{slug}/menu`, **About** → `/{slug}/story` if frames exist, **Reserve a table** opens `ReserveSheet`, **WhatsApp**. Extra chips: About, WA, Tip. Live orders prepend as `Order #N` → `/o/{token}`.
- Social icons from `personalityConfig.socials`.
- Chat tools: `showMenu`, `showStory`, `bookTable` (holds a real `Booking` after slot check). Chat answers from menu rows; does **not** deep-link to dish/AR.

### About `/{slug}/story`

Cover + bio + grouped photo stacks + optional Google panel + visit footer. Header “About” → menu for restaurants.

**Footer is fake for non-SkyDine** (Hinoo Main Road, Noon–11pm every day).

### Menu `/{slug}/menu`

Re-exports shop. Restaurant branch renders `RestaurantMenu`.

- `?t=<tableCode>` resolves `RestaurantTable` and locks dine-in table on cart.
- Swiggy-like sections, veg/nonveg filters, voice search, modifiers from `dish-options`, session cart, `createRestaurantOrder`, splash → `/o/{token}`. AR banner if any dish has a model.

Gaps:

- `CatalogHeader` never gets `aboutHref` (prop exists, unused).
- `hoursToday()` is imported but only used on the **non-restaurant** shop branch.
- No Reserve CTA on menu chrome.
- Ratings on listing are invented (`4.5` / `4.2` / `4.1` from download count).
- Missing photos fall back to `/uploads/blu-cafe/sandwich.jpg`.

### Item `/{slug}/shop/{id}` — half-wired

Photo stack via `collectItemPhotos` + `StoryGallery`. **View on table** → `/{slug}/ar?item=id` if GLB/USDZ. **Reserve a table** link. Reviews + `ReviewForm`.

Bottom CTA is `CourseEnrollButton` (shop checkout), **not** restaurant cart. Ordering from the dish page is the wrong loop.

### AR `/{slug}/ar`

Lists products with `arModelUrl`; 404 if none. Serves web GLB; advertises `-ar.glb` / USDZ only if files exist on disk. Size from filename map in `ar-scale.ts` (SkyDine dish names). Viewer: `ar-world.tsx`.

### Reserve `/{slug}/reserve`

Re-exports `book/page.tsx`. Restaurant → `BookList` + `ReserveSheet`.

Party 1–80 (chips 1–12 + typeable stepper), 7-day picker, slots from availability + table covers, hold booking, calendar links, WhatsApp for 20+. Same sheet from chat **Reserve** chip. Same-day is allowed.

### After order

`/o/{token}` live guest tracker (`GuestOrderStatus`).

---

## 2. Owner path

Sidebar: Home, Profile, Inbox, **Menu** (`/dashboard/products`), **Reservations** (`/dashboard/calendar`), **Floor** (`/dashboard/orders`). Money redirects to orders.

### Import

Products list: **Import menu** (Google / Swiggy / Zomato / Uber Eats). Also You studio Import tab.

Restaurant products forced **INR**. Import writes dishes; does **not** write address, hours, socials, or About frames.

### Menu / 3D

Bulk cook time, import, **Photoreal 3D** sheet. Meshy image→3D, Stripe/local pay, optimize web+AR GLB + USDZ, write `arModelUrl`/`arUsdzUrl`.

Per-item `ArStudio`: local photo/orbit GLB (plate vs stand). Separate from photoreal Meshy.

### Tables / Floor

`FloorKitchenTabs`. Floor = `TableQrStudio`: floors, seats, reserved, QR to `/{slug}/menu?t=code`, today’s arrivals strip.

Default 8 tables if none. SkyDine seed: 48 tables Ground / 1st / Terrace. Cap 120.

### Kitchen / receipts

Today’s tickets, advance/reject/paid, live SSE. Receipt: print animation + PDF.

### Reservations

`calendar-studio.tsx`: hours, holds, party-size label via `reservationLabel`.

### About studio

Profile editor **About** tab: `StoryStudio`. 360 sphere / GLB walk-in in `personalityConfig.aboutWalkIn`. Frames on `ProfileImage`. Socials + Maps + Zomato on General tab.

### Onboarding

`TABLE` service, hours **12:00–22:00, closed Monday**. Try kit `try-restaurant`. Disagrees with SkyDine bio / footer (noon–11pm every day).

---

## 3. SkyDine leftovers (guest-facing)

| What | File |
|---|---|
| Visit footer Hinoo / Noon–11pm | `story-magazine.tsx` |
| Ranchi/Hinoo/runway/`gl=in`/`+91` scrape | `google-place.ts` |
| “SkyDine printer” | `receipt-printer.tsx` |
| IG placeholder `skydine.ranchi` | `profile-editor.tsx` |
| Photo fallback `/uploads/blu-cafe/sandwich.jpg` | `restaurant-menu.tsx` |
| AR sizes keyed to SkyDine filenames | `ar-scale.ts` |
| Category sort = SkyDine boards | `restaurant-menu.tsx` |
| Stopword `"blu"` | `item-photos.ts` |
| Seed: Ranchi bio, 48 tables, place id | `scripts/fill-skydine.mjs` |
| Optimizer CLI dir `public/uploads/skydine-ar` | `scripts/optimize-ar-assets.ts` |

Assets: `public/uploads/skydine-cafe/` (About GBP photos), `public/uploads/skydine-ar/` (optimized 12.28 MB).

One-off **Hill Road, Bandra** copy still in `scripts/one-off/fill-blu-cafe.ts` — not guest-facing unless re-run.

---

## 4. Extract as shared (not restaurant-only)

| Capability | Today | Extract as |
|---|---|---|
| About magazine | Footer hardcoded | Address + hours from venue / availability / Google |
| Walk-in 360 / room GLB | StoryStudio upload | Any venue / shop / studio |
| Google fetch | India/Ranchi heuristics; reviews empty | Generic listing ingest |
| Photo stacks | Auto fill uses TheMealDB + food | Shared gallery; auto source by vertical |
| Photoreal 3D | Copy “Table-ready 3D” | Shared product 3D. Size on product |
| GLB optimizer | Already generic | Keep |
| Socials footer | Zomato in core | Zomato as restaurant/food pack |
| Party-size pattern | ReserveSheet | Covers picker for any resource booking |
| Catalog header About | `aboutHref` unused | Pass `/{slug}/story` |

---

## 5. Close the reference loop

A second restaurant cannot run the SkyDine guest loop without seed/hacks.

1. **About Visit block from data** — `story-magazine.tsx`.
2. **Wire menu chrome** — pass `aboutHref`, hours, reserve. `shop/page.tsx` + `catalog-header.tsx`.
3. **Dish page uses restaurant cart**, not `CourseEnrollButton`. `shop/[id]/page.tsx`.
4. **Real ratings** — stop inventing 4.1–4.5 (`shop/page.tsx`). AR page already uses review mean.
5. **Owner-editable modifiers** — `dish-options.ts` is not per-profile.
6. **AR size on product** — drop SkyDine filename table (`ar-scale.ts`).
7. **Generic Google parser** — drop Ranchi/Hinoo/runway; extract reviews.
8. **Import writes place metadata** — maps URL, hours, phone, About frames — not only dishes.
9. **Receipt printer name** = `shopName`.
10. **Menu fallback image** — not `blu-cafe/sandwich.jpg`.
11. **Hours consistency** — onboarding vs availability vs footer vs bio.
12. **Chat → menu/AR** — `showMenu` is a markdown dump; no dish/AR deep links.
13. **Walk-in not seeded** by `fill-skydine.mjs` (photos yes, 360/GLB no).
14. **Google panel is on-demand scrape**, not cached into About.
15. **Zomato always in profile editor** even for non-restaurants.

Ops that **do** already close for SkyDine if DB/assets exist: QR table order, kitchen advance, guest `/o/{token}`, photoreal 3D attach, party-size reserve, chat `bookTable`.

Party size: chips 1–12, typeable stepper max 80. About is off the menu page, on chat. Footer has phone `+91 92622 68837` and socials (not a sticky dock). Do not overwrite that WhatsApp with GBP `092418 27877`.

---

## 6. File index

**Kit / copy** — `src/lib/surfaces.ts`, `src/lib/menu.ts`, `src/lib/story.ts`, `src/lib/try-kits.ts`

**Guest routes** — `[slug]/page.tsx`, `story/page.tsx`, `menu/page.tsx` → shop, `shop/page.tsx`, `shop/[id]/page.tsx`, `ar/page.tsx`, `reserve/page.tsx` → book, `o/[token]/page.tsx`

**Guest UI** — `profile-view.tsx`, `story-magazine.tsx`, `google-place-panel.tsx`, `walk-in-stage.tsx`, `restaurant-menu.tsx`, `story-gallery.tsx`, `ar-world.tsx`, `reserve-sheet.tsx`, `party-size-picker.tsx`, `catalog-header.tsx`

**Owner** — `products-list.tsx`, `ar-build-sheet.tsx`, `restaurant-orders-dashboard.tsx`, `floor-kitchen-tabs.tsx`, `table-qr-studio.tsx`, `story-studio.tsx`, `import-studio.tsx`, `calendar-studio.tsx`, `receipt-printer.tsx`

**Libs** — `google-place.ts`, `optimize-glb.ts`, `ar-builds.ts`, `ar-scale.ts`, `item-photos.ts`, `socials.ts`, `walk-in.ts`, `dish-options.ts`, `menu-import.ts`, `restaurant-tables.ts`, `restaurant-orders.ts`

**Seed** — `scripts/fill-skydine.mjs`, `scripts/optimize-ar-assets.ts`, `scripts/one-off/fill-blu-cafe.ts`
