# All-ends plan

**Written:** 2026-09-03  
**Repo:** `personai/aiclone`  
**Status:** plan only — do not implement until asked  
**Source:** five explore agents (restaurant, shop/creator, time-based, lead/portfolio, shared spine)

Restaurant (SkyDine Cafe, Hinoo, Ranchi — slug `skydine-cafe`) is the **reference guest loop**, not the schema and not product defaults. Every other kit is that loop with a different catalog and a different primary button.

Companion specs live in [`docs/specs/all-ends/`](../specs/all-ends/README.md). This file is the combined sequence.

The older restaurant spec at [`docs/specs/restaurant-integration/`](../specs/restaurant-integration/tasks.md) is **stale vs code**. Phases 0–4 there are largely shipped. Do not follow its “add Orders to nav” item.

---

## Product invariant

One public link. An AI persona chats, books, and sells.

Every kit is the same product:

1. **Chat** at `/{slug}` is the homepage.
2. **About** at `/{slug}/story` is the magazine (photos, walk-in, Google panel, footer).
3. **One catalog** (`DigitalProduct`) for dishes, goods, and files.
4. **One booking engine** (`Booking`) for tables and sessions. Business OS engines (`Reservation`, appointments `resourceId`, `FieldJobRequest`) stay owner/API after extras opt-in.
5. **Money + WhatsApp** on existing sales/shop surfaces.
6. **Fill from listing** is preview → owner apply. Never silent write.
7. **Photoreal 3D** is a catalog **pack** (`ar`), always optimized, never Meshy-branded.
8. **Closed sidebar.** New work is a pack, dock tab, sheet, or public chip. Never a new `NavItem`.

Kits change **copy, packs, and which existing surfaces show**. They do not change IA.

---

## Ends (kit groups)

| End | Kits | Guest primary | Catalog | Book |
|---|---|---|---|---|
| **Restaurant** (reference) | `RESTAURANT` | Menu + reserve a table | Dishes (`menuDish`) | Tables (`tableBook`) |
| **Shop** | `SHOP` | Open shop / buy | Physical (+ digital addon) | Visit / pickup if address |
| **Creator** | `CREATOR` | Get the free guide | Digital files + magnets | Optional book addon |
| **Time** | `CONSULTANT`, `CA`, `SALON_SPA`, `FIELD_SERVICE`, `COACH` (1:1) | Book session / treatment / visit | Services, not products | `SESSION` `Booking` |
| **Lead / portfolio** | `DESIGNER` (+ `DEVELOPER`/`EDITOR`), `JOB_SEEKER`, `EVENTS_STUDIO`, `REAL_ESTATE_BROKERAGE`, `RECRUITMENT_AGENCY`, `CUSTOM` | See work / collect lead / book a brief | Portfolio / events / none | Only if `services` or `calendar` is on |

`CUSTOM` gets every surface and pack except `businessOs`. `businessOs` is extras-opt-in only, never granted by a blueprint.

---

## What restaurant already proved

Guest gold path that other ends must copy **as a loop**, not as restaurant nouns:

```
chat  →  About you can swipe  →  catalog you can tap  →  book / buy  →  tiny 3D if paid
```

Shipped on SkyDine (if DB + assets exist):

- Chat chips: Menu, About, Reserve, WhatsApp.
- About magazine + walk-in + “From Google” (no vendor branding).
- Swiggy-like menu, table QR, session cart, live `/o/{token}`, kitchen tickets, thermal receipts.
- Reserve sheet: party chips 1–12 + typeable stepper max 80, day/time chips, sticky footer.
- Photoreal 3D (Meshy server-only, 3× markup, `$1.80`/item at default) + `optimize-glb` (SkyDine AR dir **12.28 MB**, was ~49 MB).
- Owner: Menu / Reservations / Floor (sales remapped to `/dashboard/orders`). No extra sidebar rows.

What is **not** proven: a second restaurant can run that loop without SkyDine seed/hacks. Footer, Google parser, AR sizes, modifiers, dish-page cart, and invented ratings still assume Hinoo.

---

## Shared spine (must not fork)

Canonical files: `src/lib/surfaces.ts`, `src/lib/require-surface.ts`, `src/components/dashboard/sidebar.tsx`.

| Piece | Rule |
|---|---|
| CORE | Always `home` + `profile` + `inbox` |
| Kits | Add surfaces + packs |
| `extras` | Additive JSON on `personalityConfig`. Never subtract |
| `businessOs` | Not in `ALL_SURFACES`. Explicit extras only. Installations freeze `businessOsExcluded: true` |
| Sidebar | Closed `navGroups`. Relabel/remap OK (Menu, Reservations, Floor) |
| New feature | Pack / dock / sheet / chip. **Never** a NavItem |
| Public home | Chat. Restaurant skip-intro may stay as a pack flag (`menuDish`) |
| Cyan | `#00D7FF`. CSS glass. Phone-polished. Safe-area docks |
| 3D | `optimizeModelSet` before any public serve. Keep original if a pass would grow |
| Ask before | overwrite, publish photos, pay, public, post, domain, Clerk keys |

Allowed sidebar hrefs (do not grow this list):

`/dashboard`, `/profile`, `/inbox`, `/leads`, `/products`, `/services`, `/events`, `/calendar`, `/courses`, `/money`, `/business-os`.

Nested work folds in:

| Work | Surface |
|---|---|
| Story, import, links, Fill from Google | `profile` |
| Orders, lead-magnets, offer | `shop` (restaurant Floor remaps `sales` → `/dashboard/orders`) |
| Community | `events` |
| 3D studio | shop dock / `ArBuildSheet`, not a nav item |

Dashboard nav is **profile extras**. Workspace installation does not drive it. See `docs/orchestration/WORKSPACE_SURFACES_DECISION.md`.

---

## Phases

This is **not** Business OS Waves A–F (those are already integrated). This is the guest-loop sequence.

| Phase | Name | Depends | Unblocks |
|---|---|---|---|
| **A** | Freeze surface contract + kit nouns | — | everything |
| **B** | FillFromListing | A | C footer (without B, About still lies) |
| **C** | About / story every kit | B | E About CTA |
| **D** | 3D catalog service | A (`ar` pack) | independent of B/C; mostly shipped |
| **E** | Chat chips per kit | A, C | F |
| **F** | Remaining leaks + phone polish | B–E | done |

**Parallelism:** D can start with A. C cannot ship without B. E can start copy tables after A, but About CTA needs C.

Do not implement Phase B (or anything else) unless asked.

### A — Freeze the surface contract

- Treat `surfaces.ts` + `sidebar.tsx` + `require-surface.ts` as API. Do not change `surfacesFor(role, extras)` signature (20 consumers).
- Put kit **nouns** in one copy module (shop nav, calendar noun, story labels, WA prefills, book chips). Stop scattering `role === "RESTAURANT"`.
- Pick one answer for `surfaceForPath("/dashboard/orders")`: restaurant Floor is a **sales** remap; `requireSurface(..., "shop")` on orders is restaurant-shaped. Document and freeze.
- Tests: `visibleNavItems` snapshot per kit. **No new `navGroups` entries.**

### B — FillFromListing (identity)

Neutralize Ranchi / Hinoo / rooftop / food regexes in `src/lib/google-place.ts`. Today a non-Ranchi listing can return `address: null`.

Add owner writes (session, owned profile). Keep public `GET /api/google-business?slug=` as visitor read.

```
POST /api/listings/preview   (or previewListing action)
POST /api/listings/apply     (or applyListing action)
```

Preview is country-agnostic: formatted address, E.164 phone, weekly hours matching `AvailabilitySchedule` (`dayOfWeek` 0=Sunday), photos cap 12, reviews actually filled, locale from profile language + timezone — **not** always `gl=in`.

Apply is **explicit fields**, never silent overwrite:

- `fields[]` + `overwrite: false` (fill empty only) + `publishPhotos: false` by default.
- Persist `placeId` / `mapsUrl` on existing personality writers.
- New `personalityConfig.venue` bag for address / phone / categories. **No extra Prisma columns** until JSON proves insufficient.
- Hours → `AvailabilitySchedule`.
- Photos → unpublished `ProfileImage` unless asked.
- Phone → `venue.phone` and `Profile.whatsapp` only if empty or overwrite.

Owner UI: Profile → General, **sheet** “Fill from Google”, field checkboxes. Not a sidebar item.

Ask before: overwrite name/bio, publish photos, write hours that close existing booking windows. Listing fill is free. Do not auto-set `isPublic`. Do not post to Maps / Zomato / IG.

Full JSON shapes: [`00-shared-spine.md`](../specs/all-ends/00-shared-spine.md#fillfromlisting).

### C — About / story for every kit

Keep **one** public route `/{slug}/story` and **one** studio (Profile tab `about`). Keep Prisma enum `AMBIENCE | INTERIOR | FOOD | TEAM | EVENT` — **relabel per kit, do not add enum values.**

Delete hardcoded Hinoo footer, “Noon — 11pm · every day”, and “A table at {name}” in `story-magazine.tsx`.

Footer contract:

1. Address: `venue.address.formatted` else omit.
2. Hours: `hoursToday(availability)` else omit.
3. Phone: `venue.phone.display` else pretty-print `whatsapp` (not +91-only).
4. WA prefill: kit copy.
5. CTAs from **surfaces**, not `role === "RESTAURANT"`:
   - shop → Menu or Shop
   - calendar + `tableBook` → Reserve
   - services / calendar → Book
   - creator magnets → Get the guide
   - else Chat
6. Zomato icon only if `socials.zomato` is set.

Pass `aboutHref` from menu/shop chrome (prop exists, unused).

Category labels: [`00-shared-spine.md`](../specs/all-ends/00-shared-spine.md#about-labels).

`GooglePlacePanel` stays a **read** affordance. Persist only through FillFromListing apply.

### D — 3D as catalog service

Mostly shipped (`optimize-glb.ts`, persist in `ar-builds.ts` / `/api/image-to-3d` / GLB upload). Remaining:

- Gate `ArBuildSheet` / Photoreal banner with `fieldOn(..., "ar")`. CREATOR currently leaks the button (`products-list.tsx`). Quick Add already hides it.
- Every GLB (upload, Meshy, walk-in) through `optimizeModelSet`. Keep original if output ≥ input.
- Replace `ar-scale.ts` SkyDine filename table with size on the **product**, default by pack (`menuDish` plate vs `shopPhysical` object).
- Public copy: “View in your space” / “3D studio”. Never “View on table” on a shop SKU. No Meshy in client, metadata, USDZ `creator`, or toasts.
- Charge via existing Stripe; **ask before pay**. Local `markBatchPaid` stays dev-only.
- Do **not** AR services (salon treatments, consults, field jobs) unless they become catalog products.

Pack `ar` is on SHOP + RESTAURANT (+ CUSTOM / extras). Not on creator, time, or lead/portfolio kits.

### E — Chat chips per kit

`welcomeTopics` + `buildGoalChips` driven by kit / goal / surfaces.

| Kit | Primary chips (then extras that have data) |
|---|---|
| RESTAURANT | Menu, About, Reserve, WhatsApp |
| SHOP | Open shop, WhatsApp, About; visit/pickup if address |
| CREATOR | Get the free guide **(sheet, not a prompt)**, Ask, Shop, Tip, About |
| CONSULTANT / CA | Book a call / consult, services, rates, About |
| SALON_SPA | Book a treatment (not “Book a call”), services, About |
| FIELD_SERVICE | Request a visit (not “Book a call”), services, About |
| COACH | Shop **and** Book a session (today `SELL_PRODUCTS` hides book) |
| DESIGNER* | See work, About; Book only if services addon |
| JOB_SEEKER | Portfolio, history, About |
| EVENTS / ESTATE / RECRUIT | Ask, About, book if calendar/services; events chip if surface |

Restaurant skip-intro may stay as `menuDish` pack flag.

Chat write tools today: only `bookTable`. Time kits can **list** services (`showServices`) but cannot book from chat. Add `bookSession` / `requestVisit` only after the donated reserve sheet exists.

### F — Remaining leaks + phone polish

- `item-photos.ts`: no food default / TheMealDB unless `menuDish`. Drop stopword `"blu"`.
- Profile editor: Zomato/Maps placeholders by pack. Drop `skydine.ranchi`.
- `readyLabel` only for `menuDish`.
- Receipt printer name = `shopName`, not “SkyDine printer”.
- Menu fallback: not `/uploads/blu-cafe/sandwich.jpg`.
- International phone pretty-print.
- Glass / cyan / dock safe-area audit on About, listing sheet, AR sheet.
- `scripts/fill-skydine.mjs` stays a **fixture**, never a UI fallback.
- Onboarding hours (12:00–22:00 closed Mon) must not disagree with footer / bio. Hours come from availability after B.

---

## Per-end work (after the spine)

Detail lives in the child specs. Summary only here.

### Restaurant — close the reference loop

A second restaurant must run SkyDine’s guest path without seed/hacks.

1. Footer from data (C).
2. Pass `aboutHref`, hours, reserve on menu chrome.
3. Dish page uses restaurant cart, not `CourseEnrollButton`.
4. Real ratings (stop inventing 4.1–4.5 from download count).
5. Owner-editable modifiers (`dish-options.ts` is a hardcoded INR pizza/burger/coffee matrix).
6. AR size on product, not filename.
7. Generic Google parser (B).
8. Import writes place metadata (maps, hours, phone, About frames), not only dishes.
9. Receipt `shopName`; no blu-cafe fallback.
10. Hours consistency across onboarding, availability, footer, bio.

Do **not** add Orders / Kitchen / Tables / Story / 3D to the sidebar. Floor remap is correct.

### Shop

Copy the gold path with shop nouns. **Do not** reuse `RestaurantMenu`.

- Catalog: `ShopCatalog`. Hide diet/spice unless `menuDish`. Hours from availability. AR banner with shop copy if any item has a model.
- Item: **Buy · price** / WhatsApp / UPI. **View in your space**. Pickup/visit instead of Reserve.
- About footer: Shop + WhatsApp.
- Import: shop-shaped sources, not Swiggy placeholders. Prominent Import card like restaurant.
- Receipts: simple order ticket from `ProductPurchase` / unused `placeCartOrder`. Not kitchen. No `/o/{token}` kitchen tracker unless they opt into restaurant packs.
- Empty state: “Import a catalog or add a product”.

### Creator

- “Get the free guide” opens a sheet (email + file + `VisitorLead`), not a chat prompt.
- Chat `showLeadMagnets` completes that capture + download.
- Hide Photoreal unless `ar` pack.
- Import hint `shop` / `leadMagnet`, not CV.
- No `portfolio` pack → do not show “See work” unless they add it.
- About footer: Guide + Tip + Shop.
- Owner lands on Free tab (`lead-magnets`). Shop tab is paid files.

### Time (consultant, CA, salon, field, coach 1:1)

Donate `ReserveSheet` to `SESSION` kits. Kill the 3-step `BookingModal` (native date, skips today, no chips).

| Restaurant | Salon | Consultant / CA / Coach | Field |
|---|---|---|---|
| Party chips + type | Duration 30/45/60/90 | Session length + optional attendees | Rooms / units / techs |
| Table | Named stylist (`AppointmentResource`) | Consultant / room | Technician |
| Hold table | Book treatment / waitlist | Book session | Request a visit |
| Phone | Phone | Email today → phone OK | Phone + **site address** |

- Staff photos are TEAM frames, not a second staff model. Resource CRUD can use TEAM avatars.
- Coach courses stay on `/courses`. Only 1:1 takes the sheet. Put `book` in coach extras so shop goal does not hide 1:1.
- Chips: stop saying “Book a call” for salon/field.
- Guest writes stay on `Booking` until a deliberate cutover: salon/consultant/coach → appointments with `resourceId`; field → `FieldJobRequest`. Do not pretend Booking metadata is a table or a job.
- Business OS panels stay owner-only.
- **No AR on services.**

### Lead / portfolio

Reuse chat + About + Google if Maps URL. No Photoreal. No menu import.

- Relabel story categories per kit (job seeker should not see “Studio / Craft” as the only path).
- Footer CTAs: See work / Get the guide / Plan your event / Discuss a property / Share a hiring brief.
- CREATOR magnets vs events/estate/recruit `collectLead` + `/dashboard/leads` (those kits lack `shopDigital`).
- `rag.ts` `formatRoleTemplate` is missing EVENTS_STUDIO / REAL_ESTATE / RECRUITMENT (falls back to “Professional”).
- Events / estate / recruit OS is owner-only after extras. Guest loop stays chat + about + book.

---

## Non-goals

- New sidebar items (Story, 3D, Listings, Orders, Kitchen, Tables, Walk-in, AR).
- Meshy (or any vendor) in UI, GLB extras, USDZ creator, or owner emails.
- Serving unoptimized GLBs / raw Meshy dumps.
- Auto-publish listing photos, auto-`isPublic`, auto-post social, auto-charge 3D.
- Google scrape as a write without owner confirm.
- Per-kit `ProfileImageCategory` enums.
- Extra address/hours Prisma columns until `venue` JSON proves insufficient.
- Changing `surfacesFor(role, extras)` signature.
- Granting `businessOs` from a blueprint.
- New `PERMISSION_KEYS`.
- Using SkyDine hours / address / IG as product defaults.
- Confusing SkyDine Cafe Hinoo, Ranchi with Kolkata “Skydine Rooftop” or Branford “Sky Diner”.
- Overwriting stored WhatsApp `+91 92622 68837` with GBP `092418 27877`.
- Buying domains, resuming Clerk keys, committing, or posting unless asked.
- Restaurant-integration `tasks.md` “add Orders to nav”.

---

## Ask before

Public/external actions, account changes, payments, captcha/login, posting, messaging, publishing uploads, overwrite of name/bio/hours, publishing listing photos, charging Photoreal 3D.

---

## Child docs

| File | What |
|---|---|
| [`docs/specs/all-ends/README.md`](../specs/all-ends/README.md) | Index |
| [`00-shared-spine.md`](../specs/all-ends/00-shared-spine.md) | Contract, leaks, FillFromListing JSON, labels, nav |
| [`01-restaurant.md`](../specs/all-ends/01-restaurant.md) | Reference loops, leftovers, close-the-loop slices |
| [`02-shop-creator.md`](../specs/all-ends/02-shop-creator.md) | Shop vs creator vs restaurant catalog |
| [`03-time.md`](../specs/all-ends/03-time.md) | Session kits, donate ReserveSheet |
| [`04-lead-portfolio.md`](../specs/all-ends/04-lead-portfolio.md) | Portfolio / leads / events / estate / recruit |

Related (do not treat as current for guest-loop work):

- `docs/specs/restaurant-integration/` — implemented in code; tasks list is stale
- `docs/AR.md` — viewer / asset constraints still valid
- `docs/orchestration/WORKSPACE_SURFACES_DECISION.md` — profile vs workspace surfaces
