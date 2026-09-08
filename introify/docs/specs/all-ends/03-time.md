# Time-based ends

Kits: `CONSULTANT`, `CA`, `SALON_SPA`, `FIELD_SERVICE`, `COACH` (calendar / 1:1 part).

They share one guest `Booking` path and one owner calendar. Restaurant reserve is a better sheet that is **not reused**. Business OS engines sit beside that path and are not what guests hit.

Combined sequence: [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).

---

## 1. Guest booking loop today

Shared public path: `src/app/[slug]/book/page.tsx` → `book-list.tsx`. Restaurant aliases the same page from `[slug]/reserve/page.tsx`. Chat chips come from `profile-view.tsx` (`TAKE_APPOINTMENTS` → book / services / rates / about). Chat can **list** services (`showServices`) but the only **write** tool is restaurant `bookTable`.

| Kit | Surfaces / packs | Public entry | What actually books | Missing vs kit story |
|---|---|---|---|---|
| **CONSULTANT** | leads, services, calendar, sales + portfolio | Chip **“Book a call”**, `/[slug]/book`, chat services panel | `BookingModal` 3-step: pick `SESSION` → native date (tomorrow+) → name/email → `createBooking` | No staff, no duration chips, no `bookSession` chat tool |
| **CA** | same + `whatsappUpi` | Same as consultant (“Book a consult” is onboarding copy only) | Same `SESSION` `Booking` | Blueprint is **cases**, not appointments; guest still books a session |
| **SALON_SPA** | services, calendar, shop, sales + `shopPhysical` | Same “Book a call” chip + `/book`; shop is retail, not treatments | Same `SESSION` modal. No stylist, no chair | Salon pack wants named staff + waitlist; guest UI has neither |
| **FIELD_SERVICE** | leads, services, calendar, sales; **no packs** | Same “Book a call” + `/book` | Same session hold. **No site, window, or technician** | `FieldJobRequest` is owner/API only. Headline “Request a visit” is onboarding-only |
| **COACH** | leads, courses, shop, services, calendar, events, sales | **Courses:** `/[slug]/courses` enroll. **Sessions:** `/book` exists, but primary goal is `SELL_PRODUCTS` so chat chips are shop/wa/tip — **Book is not in the chip set** | Courses ≠ calendar. Sessions still `BookingModal` | Two time products (cohort vs 1:1) with no shared sheet |

Restaurant contrast (donor): if only `kind === "TABLE"`, `BookList` skips the modal and opens `ReserveSheet` (party, day chips, times, name/phone/notes, sticky Hold). Chat `bookTable` writes the same `createBooking` after slot check. Same-day is allowed.

**Persistence:** all of the above write `Booking` via `src/app/actions/bookings.ts`. They do **not** write `Reservation` (tables) or `resourceId` on `Booking` (appointments engine). Field jobs are a third store.

---

## 2. Owner calendar / services loop

**Services catalog** (`/dashboard/services`, `services-manager.tsx`) — kits with `services` surface (all five):

- List/grid of `ServiceOffering`: name, price, minutes, pack sessions, monthly retainer, on/off.
- `TABLE` vs `SESSION` only if `fieldOn(..., "tableBook")`. Restaurant has `tableBook` but **no `services` surface**, so owners never see this sheet; a TABLE row is auto-created on the public book page (`ensureTableService`).
- Dock: copy `/[slug]/book`, jump to calendar, open live book page.
- No staff, photos, AR, site, or resource eligibility UI.

**Hours + book** (`/dashboard/calendar`, `calendar-studio.tsx` + `availability-settings.tsx`):

- Noun: restaurant **Reservations**; consultant/CA/coach **Sessions**; salon/field default **Bookings** (`calendarNoun` in `surfaces.ts`).
- Reads `Booking` only (not `Reservation` / `FieldJob`). Confirm / cancel / block 30m hold.
- Weekly hours + timezone + buffer. ICS sync.
- Restaurant floor (tables/QR) lives on **orders/floor**, not on this calendar.

**Business OS** (`/dashboard/business-os`) is opt-in, not kit nav:

| Engine | Panel | What it is | Guest product? |
|---|---|---|---|
| `venueOrders.reservations` | `reservations-panel.tsx` | `Reservation` on `RestaurantTable`, overlap lock, seats fail-closed | **No** — guest uses `Booking` + covers |
| `appointments` | `appointments-panel.tsx` | `Booking` **plus** required `AppointmentResource`, waitlist/deposit/reminder records | **No** — guest `createBooking` never sets `resourceId` |
| `fieldJobs` | `fieldjobs-panel.tsx` | Request → job + technician (`AppointmentResource`) + typed visit window; no routing/notify | **No** public intake |

Blueprints: salon **requires** appointments; consultant **optional** appointments + required cases; CA **cases only** (no appointments engine); field **fieldJobs**; coach **contentCohorts + appointments**.

---

## 3. What restaurant reserve UX should donate

From `reserve-sheet.tsx` + `party-size-picker.tsx` (and `OfferSheet` footer pattern):

1. **One bottom sheet, one scroll.** No 3-step dialog, no progress bar, no native `<input type="date">`.
2. **Chips + typeable number.** Party: 1–12 circles, then `− [typed 1–80] +`. Same control maps to duration / staff / party / vans.
3. **Day chips, not a calendar widget.** Today / Tomorrow / weekday + month-day, 7 days. Time as a 4-col chip grid from `getAvailableSlots`.
4. **Footer CTAs, not a sidebar.** Sticky safe-area footer: primary Hold / Request; WhatsApp as a **second** footer button for 20+, not a side rail. Empty day offers WA inline.
5. **Details in the same sheet.** Name + phone + notes; success stays in-sheet (calendar links + Done).
6. **Reuse `OfferSheet` / `OfferFooter`** for owner add-service (already footer-not-sidebar).

Do **not** donate: `BookingModal` stepper; unused `TimeSlotPicker` (tests only, starts tomorrow, fetches `/api/bookings/slots` booked list, different from `getAvailableSlots`).

---

## 4. Mapping: restaurant → salon / consultant / field

| Restaurant | Salon | Consultant / CA / Coach session | Field |
|---|---|---|---|
| Party size (chips + type) | Duration preset (30/45/60/90) **or** add-on time | Session length (already on offering) + optional attendees (`partySize` exists on `Booking`) | Job size: rooms / units / techs (capacity on `AppointmentResource`) |
| Table / covers / join-tables | Named **stylist** (`AppointmentResource` STAFF, eligibility `ServiceResource`) | Named **consultant** / room; CA often skip (cases) | Lead **technician** (same resource table; fieldJobs already uses it) |
| Seat count vs party | Chair capacity = 1 (fail-closed like nullable `seats`) | 1:1 default; group = `partySize` vs resource.capacity | Crew size vs job |
| Day + time chips | Treatment slot | Session slot | **Visit window** (field engine: owner-typed, not slot-found) |
| Hold table / Request tables | Book treatment / Waitlist if full | Book session / request time | **Request a visit** (intake) vs **schedule job** (dispatch) |
| Phone required | Phone | Email (modal today) | Phone + **site address** |
| Notes: window, high chair, allergy | Stylist / allergy / add-on | Agenda / Zoom | Access, parts, quote |
| WhatsApp 20+ | WhatsApp if no slot / preferred stylist | WhatsApp follow-up (CA pack already has it) | WhatsApp quote — engine will not notify |
| 90 min TABLE duration | `durationMinutes` on treatment | same | Window length, not menu duration |
| `RestaurantTable` | Staff row + photo | Staff/room | Technician + site |
| Join tables copy | Two-chair / two-stylist | Pair session | Two-person job |

Coach **courses** stay on `/courses` (cohorts). Only 1:1 / calendar should take the reserve sheet.

---

## 5. Gaps

**Google About**  
`GooglePlacePanel` is a live “From Google” fetch on `/[slug]/story` if `socials.maps` is set. It does **not** write listing copy or photos into story frames, bio, or TEAM. Not on book/services at all.

**Staff photos as TEAM frames**  
`StoryCategory` includes `TEAM` (“People”) — About magazine photos only. `AppointmentResource` has `name` / `kind` / `capacity`, **no photo**. No dashboard staff manager. Salon “named staff” and field technicians cannot be shown on the book sheet.

**No AR on services**  
`arModelUrl` is on **products**. `ServiceOffering` has no 3D, no cover image (owner `OfferCover` is generated). Walk-in 360/GLB is About-only. Do not AR treatments unless they become catalog products.

**Other wiring gaps**

- Guest `Booking` vs OS `Reservation` / `appointments.book(resourceId)` / `FieldJobRequest` — three clocks.
- Salon/field/coach chips still say **“Book a call”**.
- Coach goal `SELL_PRODUCTS` hides the book chip.
- `TimeSlotPicker` dead; modal still uses date input + skips today.
- CA kit has calendar; `ca-practice-v1` does not compose appointments.
- Reminders/deposits planned, providers inert (salon/coach packs already say so).

---

## 6. Ordered slices (this end)

Spine A (nouns) and C (About) still apply. Then:

1. **Donate the sheet to `SESSION` kits** — one `ReserveSheet`-style flow in `book-list` / profile (day chips, time chips, sticky footer). Kill the 3-step modal for consultant / CA / salon / field / coach sessions. Keep restaurant TABLE path as-is.
2. **Retarget `PartySizePicker`** — duration chips (salon/coach), optional party (consultant), hide for 1:1 CA; footer labels: Book treatment / Book session / Request visit.
3. **Copy + chips** — `calendarNoun` + book chip for SALON/FIELD/COACH; put `book` in coach extras so courses don’t hide 1:1.
4. **Staff as first-class, photos as TEAM** — owner resource CRUD; guest chip row of stylists/techs; TEAM frames optional avatars, not a second staff model.
5. **One write path per kit** — salon/consultant/coach → `appointments` with `resourceId`; field → `FieldJobRequest` + site; stop pretending `Booking` metadata is a table/job. Do this **after** the donated sheet still writes `Booking`, so the UX lands first.
6. **Field visit sheet** — address + window chips + service; owner dispatch stays in Business OS (no fake ETA).
7. **Google About import (opt-in)** — spine B. Persist listing copy/photos into story + TEAM, not a live dump on book.
8. **Do not** add AR to services.

Restaurant already solved the guest loop: chips, typeable number, footer CTA, no extra chrome. Time kits still use a call-booking wizard that never learned party, staff, or site.

---

## 7. File paths

**Kits / copy** — `src/lib/surfaces.ts`, `src/lib/onboarding-needs.ts`

**Guest** — `[slug]/book/page.tsx`, `book-list.tsx`, `[slug]/reserve/page.tsx`, `reserve-sheet.tsx`, `party-size-picker.tsx`, `booking-modal.tsx`, `time-slot-picker.tsx` (unused), `profile-view.tsx`, `src/app/api/chat/route.ts`, `src/app/actions/bookings.ts`, `src/lib/slots.ts`

**Owner** — `services-manager.tsx`, `offer-sheet.tsx`, `calendar-studio.tsx`, `availability-settings.tsx`, `booking-sheet.tsx`, `table-qr-studio.tsx` (restaurant floor)

**OS engines** — `src/lib/reservations/`, `src/lib/appointments/`, `src/lib/fieldjobs/`, `reservations-panel.tsx`, `appointments-panel.tsx`, `fieldjobs-panel.tsx`, `vertical-packs/salon-spa-v1.ts`
