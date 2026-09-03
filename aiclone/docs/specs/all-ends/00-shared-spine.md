# Shared spine

What every kit must share, and the restaurant leaks that currently print SkyDine on a salon, shop, or CA.

Canonical sequence: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).

---

## 1. Surface machine

| Piece | Role |
|---|---|
| `Surface` | `home`, `profile`, `inbox`, `leads`, `shop`, `services`, `calendar`, `courses`, `events`, `sales`, plus opt-in `businessOs` |
| `FieldPack` | `shopPhysical`, `shopDigital`, `menuDish`, `tableBook`, `ar`, `portfolio`, `whatsappUpi` |
| `KIT` | Per-`roleTemplate` default surfaces + packs |
| `extras` | Additive JSON on `personalityConfig`: `{ surfaces, packs, addons }` |
| `CUSTOM` | All surfaces + all packs (onboarding “Something else”) |
| `businessOs` | **Not** in `ALL_SURFACES`. Only explicit extras opt-in. Installations freeze `businessOsExcluded: true` |

CORE is always `home` + `profile` + `inbox`. Kits add product areas. Extras only **add**, never subtract.

Onboarding `CORRESPONDING_BLUEPRINT` is a **label**, not an installer. Install is `POST /api/platform/workspaces/{id}/blueprint`.

### Nav gating (already wired)

- `navGroups` in `sidebar.tsx` is the **closed** list.
- `visibleNavItems(role, extras)` filters by `navHrefToSurface` + `hasSurface`.
- Mobile sheet uses the same list.
- Pages gate with `requireSurface` (missing → `/dashboard`).
- Dashboard is **profile-scoped**: `user.profiles[0]` + `extrasOf(profile)`. Workspace installation does **not** drive this nav.

Restaurant-only **relabels**, not new items: Shop → Menu; Calendar → Reservations; Sales → Floor, href remapped to `/dashboard/orders`.

In-surface tools live in `StudioDock` + `DockTabs`. Floor vs kitchen is a **tab**. Story is Profile editor tab `about`, not `/dashboard/story`.

### Rules for new work

1. New capability = pack, extra, dock tab, sheet, or public chip. Not a `NavItem`.
2. Relabel / remap is allowed. Do not add “Orders”, “Story”, “3D”, “Listings”, “Kitchen”, “Tables”, “AR”.
3. Nested routes fold into an existing surface via `prefixes` + `surfaceForPath`.
4. Hidden nav is not security; RBAC stays separate (`PERMISSION_KEYS` stays 18).
5. Public chips use `publicChipAllowed`. New visitor actions are chips or `/{slug}/…` pages.
6. `businessOs` remains extras-only; blueprints cannot grant it.
7. Phone chrome: dock + safe-area; cyan `#00D7FF`; CSS glass. No extra desktop chrome.

Anti-pattern: restaurant-integration `tasks.md` 2.2 “add Orders to `navGroups`”. Floor remap is the correct pattern.

---

## 2. Shared modules that already exist

### Public homepage = chat

`src/app/[slug]/page.tsx` → `ProfileView` → `ChatInterface`. Restaurant skips the intro veil (`introStage = "ready"`). Chips gated by `publicChipAllowed` + `primaryGoal`. About chip routes to `/{slug}/story` when frames exist.

Default orb colors: `["#00D7FF", "#07104D"]`.

### Listing / place (read path only)

- `src/lib/google-place.ts` scrape → `GooglePlaceInfo`
- `GET /api/google-business?slug=` (public, 30 min cache, needs maps URL or placeId)
- `googlePlaceFromConfig` / `writeGooglePlaceId` on personality JSON
- UI: `GooglePlacePanel` (“From Google” on About)

**There is no FillFromListing write.** Preview exists; apply does not.

Name search on `tbm=map` works. Bare `place_id:ChIJ…` search returns empty (~803 bytes). Prefer a name query. Cache key is v3 after empty-first-hit bugs.

### Socials, walk-in, story

- `socials.ts`: instagram, facebook, youtube, maps, zomato on `personalityConfig.socials`
- `walk-in.ts`: `{ kind: "sphere" | "model", url }` on `personalityConfig.aboutWalkIn`
- `story.ts`: `ProfileImage` frames + 5 categories + `storyLabel` / `storyCategoryLabel`
- Studio: `story-studio.tsx` (Profile → About tab)
- Public: `/{slug}/story` → `StoryMagazine`

### Hours (structured, unused by About footer)

`hoursToday(availability)` in `menu.ts` reads `AvailabilitySchedule`. Shop/menu can show “Open today …”. About footer **does not**.

### 3D as catalog service (already)

Product photo → `ArBuild` (DRAFT→PAID→RUNNING→READY) → Meshy **internal only** → `optimizeModelSet` → `{stem}.glb` (web/meshopt), `{stem}-ar.glb` (AR, no meshopt), `{stem}.usdz` → `DigitalProduct.arModelUrl` / `arUsdzUrl`.

Pricing: `AR_CREDITS_PER_ITEM = 30`, markup `3×` ($1.80/item at default). Vendor never in copy.

Optimizer (`src/lib/optimize-glb.ts`): jpeg-js/pngjs resize (sharp is broken on this PC — `colourspace: parameter space not set`). Color 512 / maps 256; simplify ratio 0.16 error 0.006 if >22k tris. **Keep original if a pass would grow.** Scene Viewer `-ar.glb` is simplified mesh + JPEG, **no meshopt**. USDZ rebuilt from AR GLB (fflate zip of USDA + jpeg). Generator stamp `PersonaLink`.

Pack `ar` is on SHOP + RESTAURANT. UI is `ArBuildSheet` from the product editor, not a sidebar.

---

## 3. Hardcoded restaurant leaks

These will print SkyDine / Hinoo / food on a salon, shop, or CA if left as-is.

| Leak | Where | What it does |
|---|---|---|
| Footer address | `story-magazine.tsx` | Always “Hinoo Main Road / Ranchi 834002” |
| Footer hours | same | Always “Noon — 11pm · every day” |
| WA prefill | same | `"A table at ${name}"` for every role |
| CTA | same | Restaurant: Menu / “A table”; others: Chat only |
| Address scrape | `google-place.ts` | Address only if `Ranchi\|Jharkhand\|Hinoo` |
| Description scrape | same | Only `experience\|rooftop\|runway\|coffee and food` |
| Categories scrape | same | Only `cafe\|restaurant\|lounge\|bar\|diner` |
| Phone scrape | same | `+91` / 0xxxxx only |
| Locale | same | `hl=en&gl=in` always |
| Auto photos | `item-photos.ts` | Default `"food"`; TheMealDB; loremflickr `food`; stopword `"blu"` |
| AR sizes | `ar-scale.ts` | Filename table of SkyDine dishes; `DEFAULT_AR_SIZE = 0.22` “plated main” |
| Ready copy | `menu.ts` `readyLabel` | Coffee 4 min / bakery now / meal 10–14 min |
| Profile placeholders | `profile-editor.tsx` | IG `skydine.ranchi`; **Zomato** field for every role |
| Invented ratings | `shop/page.tsx` | Menu stars 4.1–4.5 from download count |
| Dish fallback | `restaurant-menu.tsx` | `/uploads/blu-cafe/sandwich.jpg` |
| Dish modifiers | `dish-options.ts` | Hardcoded INR pizza/burger/coffee matrix |
| Receipt chrome | `receipt-printer.tsx` | “SkyDine printer” |
| Category sort | `restaurant-menu.tsx` | SkyDine boards (`Fish&prawn`, `Momo`, …) |
| Seed | `scripts/fill-skydine.mjs` | Full SkyDine bio/hours/maps — **demo only** |

`GooglePlacePanel` can fetch real address/hours, but the magazine footer **never uses it**.

`surfaceForPath("/dashboard/orders")` maps to **shop**, while restaurant Floor is a **sales** nav remap. Freeze one answer in Phase A.

Onboarding hours (12:00–22:00, closed Monday) **disagree** with About footer and SkyDine bio (noon–11pm, every day).

SkyDine phones: GBP `092418 27877` vs Zomato/WhatsApp `092622 68837`. Do not overwrite stored WhatsApp.

Do not confuse SkyDine Cafe Hinoo, Ranchi with Kolkata “Skydine Rooftop” or Branford “Sky Diner”. Maps place `ChIJ9T0yOmfh9DkRpal0PA7vsN4`.

---

## 4. FillFromListing {#fillfromlisting}

Do **not** write listing data into JSX. Preview (untrusted scrape) → owner confirm → persist.

Keep public read: `GET /api/google-business?slug=`.

Add owner writes (session, `requireOwnedProfile`):

```
POST /api/listings/preview
POST /api/listings/apply
```

Server-action alternative (matches `ar-builds.ts`): `previewListing` / `applyListing` in `src/app/actions/listing.ts`.

### Preview request

```ts
{
  mapsUrl?: string        // google.com/maps | maps.app.goo.gl
  placeId?: string        // ChIJ…
  name?: string           // fallback search — prefer name, not bare place_id
  locale?: { hl: string; gl: string }  // from profile.language + timezone country, NOT always in
}
```

### Preview response

```ts
type ListingPreview = {
  source: "google"
  fetchedAt: string
  placeId: string | null
  mapsUrl: string | null
  name: string | null
  rating: number | null
  reviewCount: number | null
  address: {
    formatted: string | null
    line1: string | null
    locality: string | null
    region: string | null
    postalCode: string | null
    country: string | null       // ISO 3166-1 alpha-2
  }
  phone: {
    e164: string | null
    display: string | null
  }
  website: string | null
  hours: {
    statusText: string | null
    weekly: Array<{
      dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6  // JS Sunday=0, matches AvailabilitySchedule
      closed: boolean
      startTime: string | null   // "HH:mm"
      endTime: string | null
    }>
    timezone: string | null
  }
  categories: string[]           // raw Google types, not restaurant-filtered
  description: string | null
  photos: Array<{
    url: string
    source: "google"
    width?: number
    attribution?: string | null
  }>
  reviews: Array<{ author: string; rating: number | null; text: string }>
  warnings: string[]
}
```

Parser vs today:

- Address: postal patterns, not `/Ranchi|Hinoo/`.
- Categories: keep Google types; kit mapping is a separate label table.
- Description: longest plausible blurb, not rooftop/runway regex.
- Phone: E.164; do not require +91.
- Photos: keep `=s800` rewrite; cap 12; `source: "google"`.
- Hours: prefer weekday arrays; `statusText` is display fallback only.
- Reviews: actually extract (today `walk()` never fills the array).

### Apply request

```ts
{
  mapsUrl?: string
  placeId?: string
  fields: Array<
    | "placeId" | "mapsUrl"
    | "displayName" | "headline" | "bio"
    | "phone" | "hours" | "address"
    | "photos" | "categories"
  >
  overwrite: boolean     // false = fill empty only
  publishPhotos: boolean // default false → unpublished ProfileImage
}
```

### Apply mapping (no new sidebar, no extra tables unless proven)

| Field | Persist |
|---|---|
| placeId, mapsUrl | `personalityConfig.googlePlaceId` + `socials.maps` |
| address | `personalityConfig.venue.address` (new bag) |
| hours.weekly | `AvailabilitySchedule` rows |
| phone | `Profile.whatsapp` only if empty or overwrite; also `venue.phone` |
| displayName / headline / bio | `Profile` columns |
| photos | `ProfileImage` frames, category `AMBIENCE` or kit default; `isPublished = publishPhotos` |
| categories | `venue.categories`; do not invent `roleTemplate` |

Response: `{ applied, skipped: [{ field, reason }], venue }`.

**Ask before:** overwrite name/bio, publish photos, write hours that close existing booking windows, charge anything (listing fill is free).

Do not auto-set `isPublic`. Do not post to Maps/Zomato/IG.

Owner UI: Profile → General, sheet “Fill from Google”, field checkboxes.

---

## 5. About labels {#about-labels}

Keep one public route and one studio. Keep Prisma enum. Labels are kit copy in `story.ts`.

| Kit | chip/page | verb | AMBIENCE | INTERIOR | FOOD | TEAM | EVENT |
|---|---|---|---|---|---|---|---|
| RESTAURANT | About | the room | Ambience | The room | The plate | People | Nights |
| SHOP | About | the shop | Space | Floor | Craft | People | Drops |
| SALON_SPA | About | the salon | Room | Station | Treatments | People | Looks |
| EVENTS_STUDIO | About | the studio | Venue | Setup | Work | Crew | Nights |
| CONSULTANT / CA / COACH | About | the practice | Space | Studio | Craft | People | Talks |
| FIELD_SERVICE | About | the crew | Site | Van | Jobs | Crew | Calls |
| REAL_ESTATE_BROKERAGE | About | the office | Neighbourhood | Interiors | Listings | People | Opens |
| CREATOR | About | the work | Set | Studio | Work | People | Drops |
| DESIGNER* | About | the work | Space | Studio | Work | People | Shows |
| JOB_SEEKER | About | the background | Space | Studio | Work | People | Moments |
| RECRUITMENT_AGENCY | About | the practice | Space | Office | Roles | People | Intakes |
| default | About | the story | Space | Studio | Craft | People | Moments |

Today only RESTAURANT is special-cased in `storyCategoryLabel`. SHOP already has `storyLabel` “the shop” but still shares Space / Studio / Craft / Moments.

### Magazine footer contract

Replace the Hinoo block:

1. Address: `venue.address.formatted` else omit the section.
2. Hours: `hoursToday(availability)` or weekly summary else omit.
3. Phone: `venue.phone.display` else pretty-print `whatsapp` with E.164.
4. WA message: kit copy (`A table at` / `An order from` / `A booking with` / `Hi`).
5. Primary CTAs from surfaces, not `role === "RESTAURANT"`.
6. Zomato icon only if `socials.zomato` is set.

Walk-in stays shared. GLB walk-in must pass `optimizeGlb` before save.

`GooglePlacePanel` stays read-only. Persist only through apply.

Pass `aboutHref` (`/{slug}/story`) from catalog headers — the prop exists and is unused.

---

## 6. File paths

**Contract**

- `src/lib/surfaces.ts`
- `src/lib/require-surface.ts`
- `src/lib/onboarding-needs.ts`
- `src/lib/business-os/workspace-surfaces.ts`
- `docs/orchestration/WORKSPACE_SURFACES_DECISION.md`

**Nav / phone chrome**

- `src/components/dashboard/sidebar.tsx`
- `src/components/dashboard/mobile-sidebar.tsx`
- `src/components/dashboard/dock-tabs.tsx`
- `src/components/dashboard/studio-dock.tsx`
- `src/app/dashboard/layout.tsx`

**Public homepage**

- `src/app/[slug]/page.tsx`
- `src/components/profile/profile-view.tsx`
- `src/components/chat/chat-interface.tsx`

**Listing / socials / hours / story**

- `src/lib/google-place.ts`
- `src/app/api/google-business/route.ts`
- `src/components/profile/google-place-panel.tsx`
- `src/lib/socials.ts`
- `src/lib/walk-in.ts`
- `src/lib/story.ts`
- `src/components/dashboard/story-studio.tsx`
- `src/components/dashboard/profile-editor.tsx`
- `src/components/profile/story-magazine.tsx`
- `src/app/[slug]/story/page.tsx`
- `src/lib/menu.ts` (`hoursToday`, catalog nouns)

**Catalog + 3D**

- `src/lib/optimize-glb.ts`
- `src/lib/ar-price.ts`
- `src/lib/ar-builds.ts`
- `src/lib/ar-scale.ts`
- `src/lib/meshy-internal.ts` (server-only)
- `src/components/dashboard/ar-build-sheet.tsx`
- `src/components/dashboard/products-list.tsx`
- `docs/AR.md`

**Demo fixture (not product defaults)**

- `scripts/fill-skydine.mjs`

**Spec invariant:** kits change copy, packs, and which existing surfaces show. They do not change IA. If a feature needs a new sidebar row, the design is wrong.
