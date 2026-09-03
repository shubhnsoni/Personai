# Lead-first and portfolio ends

Kits: `DESIGNER` (and `DEVELOPER` / `EDITOR` alias), `JOB_SEEKER`, `CREATOR` (leads half), `EVENTS_STUDIO`, `REAL_ESTATE_BROKERAGE`, `RECRUITMENT_AGENCY`, `CUSTOM`.

They already share the restaurant **chat → About/story → CTA** guest loop. About / Google / photos work from a Maps URL on any kit. Photoreal 3D and menu import should stay **off** these kits.

Combined sequence: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md). Creator catalog/file work is also in [`02-shop-creator.md`](02-shop-creator.md).

---

## Kits in scope

| Kit | Surfaces | Packs | Goal | Owner next | Blueprint |
|---|---|---|---|---|---|
| **DESIGNER** (+ DEVELOPER/EDITOR) | home, profile, inbox, **leads** | **portfolio** | SHOW_PORTFOLIO | `/dashboard/profile` | none |
| **JOB_SEEKER** | same | **portfolio** | HIRE_ME | `/dashboard/profile` | none |
| **CREATOR** | + **shop, sales** | shopDigital, whatsappUpi | COLLECT_LEADS | `/dashboard/lead-magnets` | none |
| **EVENTS_STUDIO** | + leads, services, calendar, **events**, sales | portfolio | COLLECT_LEADS | `/dashboard/events` | `events-studio-v1` |
| **REAL_ESTATE_BROKERAGE** | + leads, services, calendar, sales | portfolio | COLLECT_LEADS | `/dashboard/leads` | `real-estate-brokerage-v1` |
| **RECRUITMENT_AGENCY** | + leads, services, calendar, sales | *(none)* | COLLECT_LEADS | `/dashboard/leads` | `recruitment-agency-v1` |
| **CUSTOM** | all except `businessOs` | all packs | BOOK_CALL | `/dashboard` | none |

`businessOs` is **never** on by default, including CUSTOM. Blueprints are a correspondence only; install is a separate OWNER/ADMIN act. The guest page does not use Business OS.

---

## 1. Guest loop today

Public home is **chat-first**, not a magazine.

**Enter:** `/{slug}` → `ProfileView` → `ChatInterface`. Restaurant skips the intro veil; every other kit plays it.

**Chips** come from `primaryGoal`, then extras, then `publicChipAllowed` + “has data”:

| Goal | Chip order (then extras) |
|---|---|
| SHOW_PORTFOLIO | See projects → Case studies → **About** → Book a call |
| HIRE_ME | See portfolio → Work history → Ask about rates → Book a call |
| COLLECT_LEADS | Get the free guide → Ask a question → See work → Book a call |
| BOOK_CALL (CUSTOM) | Book a call → See services → Ask about rates → See work |

Extras after the goal row: `about`, `products`, `shop`, `wa`, `tip`, `courses`, `events`, `communities` (restaurant extras are only about/wa/tip).

**About**

- If published story frames exist: chip **and** About go to `/{slug}/story` (`StoryMagazine`).
- Else About opens `ContentPanel` → bio/headline only (no walk-in, no Google, no photos).

**Story page (any role)**

1. Cover + name/headline
2. “Step inside” walk-in (360 / GLB / photo ring from frames)
3. **From Google** if `socials.maps` is set
4. Bio
5. Frames grouped by category
6. Footer CTA: restaurant = **Menu + A table**; everyone else = **Chat**

**Chat tools always on:** `collectLead`, `showStory`.  
Then by kit: portfolio → `showWorkExperience` / `showProjects`; services → `showServices`; CREATOR shopDigital → `showLeadMagnets` + `showProducts`; events surface → `showEvents` / `showCommunities`. `showMenu` / `bookTable` stay restaurant / `menuDish`.

### What actually ships as a CTA today

- **DESIGNER / EDITOR / DEVELOPER:** projects, cases, about. Book is **blocked** (no services surface). WA/tip **blocked** (`publicChipAllowed` needs `whatsappUpi` / shop / calendar).
- **JOB_SEEKER:** portfolio + history + about. Rates/book blocked the same way.
- **CREATOR:** guide (if magnets exist), ask, shop/products, WA, tip, about. **See work is blocked** (no `portfolio` pack).
- **EVENTS_STUDIO:** ask, work (if projects), book (if services), about, WA (calendar), events. Guide blocked (no `shopDigital`).
- **REAL_ESTATE:** same without events chip.
- **RECRUITMENT:** ask, book, about, WA. **Work blocked** (no portfolio pack). Guide blocked.

Owner-side lead capture is `/dashboard/leads` (`LeadsStudio`) for every kit that has the leads surface. **Lead magnets** (`/dashboard/lead-magnets`) require `shop` + `shopDigital` — only **CREATOR** (and CUSTOM / extras) can actually create the “free guide”. COLLECT_LEADS on events/estate/recruit is chat `collectLead` + leads inbox, not magnets.

---

## 2. About / Google / photo stacks vs Maps URL

**Yes — they already work for any kit if a Maps URL is saved.** Not restaurant-gated.

| Piece | Gate | Notes |
|---|---|---|
| Profile editor “Google Maps” | none | `personalityConfig.socials.maps`; hosts `google.com/maps`, `maps.app.goo.gl`, `maps.google.com` |
| Chat header Maps pin | `socials.maps` | Opens the URL |
| Story “From Google” | `socials.maps` on the magazine | Client fetch `/api/google-business?slug=` |
| API | public profile **and** `mapsUrl` **or** `placeId` | Scrapes Google search `tbm=map`; 30 min cache |
| Walk-in + owner photos | published `StoryFrame`s / `aboutWalkIn` | StoryStudio is on the About tab for every role |
| Photo ring fallback | frames even with no 360/GLB | `WalkInStage` |

Caveats:

- Panel only checks `links.maps`. A stored `googlePlaceId` without a maps URL satisfies the API, not the magazine button.
- Parser still has Ranchi/Hinoo heuristics (`google-place.ts`).
- Story footer is **hardcoded** “Hinoo Main Road / Ranchi 834002” and “Noon — 11pm · every day” for **every** kit.
- Zomato field is always in the editor.

---

## 3. Story category label gaps

Categories are always `AMBIENCE | INTERIOR | FOOD | TEAM | EVENT`.

`storyLabel(role)`: only **RESTAURANT** (`the room`) and **SHOP** (`the shop`). DESIGNER → CREATOR → events/estate/recruit/CUSTOM all get **About / the story**.

`storyCategoryLabel`: **only RESTAURANT is special-cased**. SHOP and every leads/portfolio kit share the default Space / Studio / Craft / People / Moments.

So a job seeker’s About still offers “Studio / Craft”, and an events studio’s EVENT bucket is “Moments”, not event-night copy. Chat `showStory` description is still “photos, ambiance”.

Target labels: [`00-shared-spine.md`](00-shared-spine.md#about-labels).

---

## 4. When **not** to offer Photoreal 3D or menu import

**Photoreal 3D** (`ar` pack): only **SHOP, RESTAURANT, CUSTOM** (or extras opt-in).

Do **not** offer for: DESIGNER / DEVELOPER / EDITOR, JOB_SEEKER, CREATOR, EVENTS_STUDIO, REAL_ESTATE_BROKERAGE, RECRUITMENT_AGENCY — and not CONSULTANT / CA / COACH / FIELD / SALON.

Also: no `shop` surface ⇒ they cannot reach `/dashboard/products` anyway.

Leak: `products-list.tsx` shows the Photoreal button to **anyone on the shop page**, not `fieldOn(..., "ar")`. CREATOR has shop and **would see it**; `QuickAddSheet` correctly hides AR unless `ar` is on. Treat CREATOR as do-not-offer until they add the pack.

**Menu import:** `restaurant === roleTemplate === "RESTAURANT"` only. Google/Swiggy/Zomato/Uber hosts live in `menu-import.ts`. Import Studio “Shop / Menu” hint defaults for RESTAURANT/SHOP only; DESIGNER/JOB_SEEKER/CREATOR/events/estate/recruit default to **CV**.

Do **not** offer menu import for any kit in this set, including CUSTOM (has `menuDish` but the button is role-hardcoded) and SHOP (shop hint, no Import menu row — that is a shop-end issue, not this one).

---

## 5. Restaurant About/Google/chat → portfolio / leads

Reuse the **same three beats**; swap nouns and CTAs. Do not add AR or menu ingest.

| Restaurant today | Portfolio (DESIGNER*) | Job seeker | Creator (leads + files) | Events / estate / recruit |
|---|---|---|---|---|
| Chat | Chat | Chat | Chat | Chat |
| About story | About / selected work | About / background | About / behind the work | Studio / office / process |
| Google if Maps URL | Studio listing if they have one | Skip unless they have a listing | Same | Office / venue listing if they have one |
| Walk-in / photos | Project stills, not FOOD | Headshot + work photos | Content stills | Venue / site / team |
| Menu chip/tool | Projects / cases | Portfolio + history | Shop + free guide | Brief / services / events |
| Reserve a table | Book a brief (needs services addon) | Hire / intro | Guide → `collectLead` | Discovery call / viewing / hiring brief (already seeded on those roles) |
| WA | Currently **hidden** | Hidden | Shown (shop + UPI pack) | Shown (calendar) |
| Owner home | Profile + leads | Profile + leads | Products / magnets + leads | Events or leads; OS only after opt-in |

Concrete mapping:

- Keep `/{slug}` chat + `/{slug}/story` + Maps-powered Google panel.
- Relabel categories per kit (do not leave FOOD → “Craft” as the only non-restaurant path).
- Replace magazine footer (Ranchi + Menu/Table) with kit CTA: Chat / See work / Get the guide / Plan your event / Discuss a property / Share a hiring brief.
- CREATOR: keep digital shop + magnets; do not pretend they have a portfolio pack.
- EVENTS/ESTATE/RECRUIT: guest loop is still chat+about+book; Business OS cases are **owner** after `businessOs` extras, not the public page.

---

## 6. Ordered slices (this end)

1. **Labels only** — `story.ts` kit-specific `storyLabel` / `storyCategoryLabel`; chat `showStory` copy.
2. **Magazine chrome** — `story-magazine.tsx` footer address/hours/CTAs; header (restaurant → menu, others → chat). Spine C.
3. **Guest chips** — `profile-view.tsx` `buildGoalChips` + `publicChipAllowed` (WA for portfolio; CREATOR work; recruit work). Spine E.
4. **Do not ship** Photoreal / menu import on these kits (`products-list` leak, import hint). Spine D + F.
5. **COLLECT_LEADS without shopDigital** — magnets vs `collectLead` + `/dashboard/leads`. Do not fake a guide chip when magnets cannot exist.
6. **Prompt nouns** — `rag.ts` `formatRoleTemplate` missing EVENTS_STUDIO / REAL_ESTATE / RECRUITMENT (falls back to “Professional”).
7. **Business OS** — owner-only, extras opt-in; not part of the guest loop.

---

## 7. File paths

**Kit / surfaces** — `src/lib/surfaces.ts`, `src/lib/onboarding-needs.ts`, `src/lib/try-kits.ts`, `src/app/actions/onboarding.ts`

**Guest chat + About** — `[slug]/page.tsx`, `[slug]/story/page.tsx`, `profile-view.tsx`, `content-panel.tsx`, `story-magazine.tsx`, `walk-in-stage.tsx`, `google-place-panel.tsx`, `src/lib/story.ts`, `src/lib/walk-in.ts`, `src/lib/socials.ts`, `src/lib/google-place.ts`, `src/app/api/google-business/route.ts`, `src/app/api/chat/route.ts`, `src/lib/rag.ts`, `src/lib/suggestions.ts`

**Owner About / import / AR** — `profile-editor.tsx`, `story-studio.tsx`, `import-studio.tsx`, `src/lib/import-classify.ts`, `src/lib/menu-import.ts`, `products-list.tsx`, `quick-add-sheet.tsx`, `ar-build-sheet.tsx`

**Leads / magnets / events / courses** — `leads-studio.tsx`, `lead-magnets-list.tsx`, `src/app/dashboard/events/page.tsx`, `src/app/dashboard/courses/page.tsx`, `src/app/dashboard/services/page.tsx`

**Business OS (owner, not guest)** — `src/app/dashboard/business-os/page.tsx`, `vertical-packs/events-studio-v1.ts`, `real-estate-brokerage-v1.ts`, `recruitment-agency-v1.ts`
