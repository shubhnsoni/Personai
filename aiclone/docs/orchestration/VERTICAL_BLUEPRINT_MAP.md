# Vertical Wave Blueprint Map

Updated: 2026-08-27 09:35 +05:30

Task: `P0-008`. Documentation only. Maps every Wave 0 vertical, then Wave 1 more briefly,
onto the six canonical operating engines using the real engine ids and real capability ids
declared in `src/lib/business-os/engines.ts`.

## Inputs read

| Input | Location | Used for |
|---|---|---|
| `docs/strategy/vertical-opportunity-scorecard.csv` | primary checkout | all 18 rows: scores, waves, packs, boundaries |
| `docs/orchestration/PROGRAM.md` | primary checkout | wave membership, six-engine list, non-negotiables |
| `docs/orchestration/ENGINE_CONTRACTS.md` | primary checkout | canonical engine ids, boundaries, blueprint shape |
| `src/lib/business-os/{engines,blueprints,types,validation,workflow}.ts` | `personai-business-os-consolidation-wt/aiclone` | the three existing blueprints and the real capability ids |
| `prisma/schema.prisma`, `src/lib/restaurant-order*.ts`, `src/lib/commerce.ts`, `src/lib/menu.ts` | `personai-business-os-consolidation-wt/aiclone` | what is actually implemented versus declared |

Read-only worker. No source, schema, or ledger file was modified.

## 1. Canonical engine and capability vocabulary

Copied verbatim from `engines.ts`. These six engine ids and eighteen capability ids are the
only tokens a blueprint may reference; `assertValidBusinessBlueprint` rejects anything else.
Every engine declares exactly three capabilities.

| Engine id | Capability ids |
|---|---|
| `commerce` | `catalog`, `inventory`, `orders` |
| `appointments` | `services`, `availability`, `reminders` |
| `contentCohorts` | `courses`, `cohorts`, `memberships` |
| `venueOrders` | `reservations`, `qrOrdering`, `guestTracking` |
| `fieldJobs` | `intake`, `dispatch`, `inspection` |
| `casesProjects` | `pipeline`, `delivery`, `billing` |

## 2. Implementation reality, before any mapping

Every mapping below is a declaration of intent, not a statement about working software.
The honest position today:

**Shipped, engine-grade:** `venueOrders` only, and only its ordering half. `Order`,
`OrderLine`, `OrderEvent`, `OrderCounter`, and `RestaurantTable` exist in the schema;
`assertOrderTransition` and `assertOrderLineTransition` guard transitions;
`priceRestaurantCart` recomputes money server-side; `realtime.ts` publishes after commit.
This is the bar `ENGINE_CONTRACTS.md` sets, and it is the only place the bar is met.

**Shipped, but not engine-grade:** the `commerce` path. `DigitalProduct` is one table doing
triple duty as digital product, physical product, and restaurant dish (it carries
`fulfillment`, `sku`, `weightGrams`, and also `diet`, `spiceLevel`, `serveWindow`,
`arModelUrl`). `ProductPurchase` plus `Payment` plus Stripe covers digital checkout.
`src/lib/commerce.ts` is five presentation helpers, not a domain layer.

**Declared, not implemented.** Named precisely, because this list is the actual Wave 0 risk
register:

- `commerce.inventory` — the entire inventory story is one nullable column, `stock Int?` on
  `DigitalProduct`, plus a `stockLabel()` string helper. The capability description promises
  "stock rules, reservations, and availability signals". None of those exist. No variant
  table, no stock ledger, no hold or reservation, no oversell guard.
- `commerce.orders` — split across two unrelated implementations (`ProductPurchase` for
  digital, `Order`/`OrderLine` for restaurant) with no unified order. The description
  promises fulfilment and returns; neither has a model.
- `venueOrders.reservations` — there is no reservation model. A table booking is a generic
  `Booking` row with a JSON `metadata` string parsed by `parseReservation()` in
  `src/lib/menu.ts` to pull out `partySize`, `phone`, and `notes`. `Booking` has no relation
  to `RestaurantTable`, so no table capacity, turn time, or double-book check is possible.
  `restaurant-venue-v1` declares `reservations` as required on an `active` blueprint. That
  declaration overstates what ships.
- `appointments.*` — `Booking`, `AvailabilitySchedule`, `CalendarOverride`,
  `ServiceOffering`, `slots.ts`, `google-calendar.ts`, and `ics.ts` are real and in use, but
  they are legacy pre-engine features. No module under `business-os/` wraps them, they emit
  no engine events, and their transitions are not guarded at a boundary. Treat appointments
  as "code exists, engine does not".
- `contentCohorts.*` — same status. `Course`, `CourseModule`, `CourseLesson`,
  `CourseEnrollment`, `LessonCompletion`, `Member`, `MemberSession`, `Community`, and
  `CommunityMember` exist; no engine wraps them; no events; no certificate model despite
  the `memberships` description promising certificates.
- `casesProjects.*` — nothing. `VisitorLead`, `LeadMagnet`, and `LeadMagnetSubmission` are
  capture forms, not a pipeline. No brief, document, milestone, task, approval, deliverable,
  or invoice model exists anywhere in the schema.
- `fieldJobs.*` — nothing at all. No table, no library file, no route.
- **Workflows and approvals** — `workflow.ts` exports `planWorkflowRun` and
  `listApprovalGates`. Both are pure functions over in-memory definitions. Nothing is
  persisted, no approval is ever recorded, no scheduled or event trigger is wired to
  anything. Every `requestApproval` and `recordAudit` action in all three blueprints is
  currently a plan, not a control. `ENGINE_CONTRACTS.md` requires an approval gate or audit
  record for anything that spends money, messages a customer, or changes a published
  surface. That requirement is unenforced today.

Existing blueprints: `coaching-studio-v1` (`draft`), `consulting-agency-v1` (`draft`),
`restaurant-venue-v1` (`active`). Per `ENGINE_CONTRACTS.md`, `draft` is never served to a
live profile, so exactly one blueprint is reachable.

## 3. Wave 0 map

Wave 0 per both `PROGRAM.md` and the scorecard's `recommended_wave` column: coaching and
training, consultants and agencies, retail and social commerce, CA and accounting,
restaurant and cloud kitchen. The two sources agree on membership.

`R` = required, `O` = optional, in the `BlueprintEngineComposition.required` sense.

### 3.1 Coaching and training — scorecard rank 1, score 4.85

Blueprint: **exists**, `coaching-studio-v1`, vertical `coaching-training`, status `draft`.

| Engine id | Capability ids | R/O | Notes |
|---|---|---|---|
| `contentCohorts` | `courses`, `cohorts`, `memberships` | R | Carries the required pack: cohorts, attendance, assignments, certificates |
| `appointments` | `services`, `availability`, `reminders` | R | Trial call, then enrolment; `reminders` carries homework and renewal nudges |
| `commerce` | `catalog`, `orders` | O | Program fees and add-on material. `inventory` correctly omitted |

The existing blueprint matches this mapping exactly, including the omission of
`commerce.inventory`. It is the cleanest of the three.

Unmet needs: the scorecard's required pack lists **subscriptions**. No capability models
recurring billing — `commerce.orders` is one-shot checkout and `casesProjects.billing` is
retainers and invoices, which this blueprint does not include. Certificates are folded into
`contentCohorts.memberships` by description only; no certificate record exists.

### 3.2 Consultants and agencies — rank 2, score 4.85

Blueprint: **exists**, `consulting-agency-v1`, vertical `consultants-agencies`, status `draft`.

| Engine id | Capability ids | R/O | Notes |
|---|---|---|---|
| `casesProjects` | `pipeline`, `delivery`, `billing` | R | Lead, brief, milestones, approvals, invoices |
| `appointments` | `services`, `availability`, `reminders` | **R** | Discovery call is the primary customer conversion step |

Two disagreements with the shipped blueprint, both worth fixing in P1:

1. The blueprint marks `appointments` `required: false`. The scorecard's
   `primary_archetype` for this row is "Case/project + appointment" and its `customer_ai`
   column ends with "book discovery". An engine the conversion path depends on is not
   optional. I recommend `required: true`.
2. The blueprint requests only `services` and `availability`, omitting `reminders`, while
   the scorecard's `owner_ai_daily` explicitly lists "meeting follow-up" and "invoice
   reminders". Add `reminders`.

Unmet needs: proposals and scope documents are the core artefact here and have no
capability id of their own; they land inside `casesProjects.delivery` by description.

### 3.3 Retail and social commerce — rank 3, score 4.73

Blueprint: **none. Unbuilt.** Suggested id `retail-commerce-v1`, vertical
`retail-social-commerce`.

| Engine id | Capability ids | R/O | Notes |
|---|---|---|---|
| `commerce` | `catalog`, `inventory`, `orders` | R | Whole vertical; variants, shipping, returns all sit inside these three ids |
| `casesProjects` | `pipeline` | O | Wholesale and bulk enquiries only |
| `appointments` | `services`, `availability` | O | Store visits and styling consults; drop for pure online sellers |

This is the highest-scoring Wave 0 vertical with no blueprint, and it is also the one whose
required engine is least real. Its required pack is "Inventory, variants, shipping, returns,
supplier sync" and the schema offers `stock Int?`. Variants have no table. Returns have no
table. **Supplier sync has no capability id in any engine** — the scorecard asks for a
procurement or supplier concept the engine model does not contain.

Its owner workflows — abandoned-cart follow-up, inventory alerts, campaign drafts — are all
scheduled or event-triggered workflows, so this vertical is also gated on real workflow
execution, not just on commerce tables.

### 3.4 CA and accounting firms — rank 5, score 4.47

Blueprint: **none. Unbuilt.** Suggested id `accounting-practice-v1`, vertical
`ca-accounting`.

| Engine id | Capability ids | R/O | Notes |
|---|---|---|---|
| `casesProjects` | `pipeline`, `delivery`, `billing` | R | Cases, document requests, approvals, fee follow-up |
| `appointments` | `services`, `availability`, `reminders` | R | Consultations plus the document-chase reminder loop |
| `commerce` | `orders` | O | Fee collection only |

Largest gap between what the scorecard demands and what the engine model can express. The
required pack is "Cases, deadlines, document requests, approvals, accounting integrations":

- **Deadlines** — a statutory compliance calendar. No capability id covers it. It is not
  `appointments.availability`, which is staff capacity, and it is not
  `casesProjects.delivery`, which is per-engagement milestones. A recurring
  jurisdictional deadline calendar is a genuine missing primitive.
- **Document requests** — `ENGINE_CONTRACTS.md` says `casesProjects` owns "documents", but
  `engines.ts` has no `documents` capability id, so a blueprint cannot switch it on
  independently. See section 6.
- **Accounting integrations** — no integration capability exists on any engine.

This vertical also has the lowest `safety_readiness_score` in Wave 0 at 3.5, with a hard
boundary of no filing or tax position without professional approval. That boundary is
exactly the approval gate that `workflow.ts` cannot yet enforce. Building this vertical
before real approval persistence would ship an unenforced compliance promise.

### 3.5 Restaurant and cloud kitchen — rank 6, score 4.45

Blueprint: **exists**, `restaurant-venue-v1`, vertical `restaurant-cloud-kitchen`, status
`active`. The only active blueprint and the reference implementation.

| Engine id | Capability ids | R/O | Notes |
|---|---|---|---|
| `venueOrders` | `reservations`, `qrOrdering`, `guestTracking` | R | `qrOrdering` and `guestTracking` are shipped; `reservations` is not |
| `commerce` | `catalog`, `inventory`, `orders` | R | `catalog` and `orders` shipped for the dine-in path; `inventory` is nominal |

The mapping is right; two of its five declared capabilities overstate reality. It is the
only Wave 0 vertical where declaration and code substantially overlap, and it is marked
`active` while the other two blueprints are `draft`, which is consistent with the
scorecard's "finish in-flight reference vertical" instruction.

Its hard boundary — payments, cancellations, and allergy-sensitive claims need explicit
controls — is only partly met. Payment state is audited via `OrderEvent`. Allergy claims
have no control surface; `DigitalProduct` carries `diet` and `spiceLevel` as free-form
fields with no verification.

### 3.6 Wave 0 engine coverage summary

| Engine | Wave 0 verticals requiring it | Code today |
|---|---|---|
| `casesProjects` | consultants, CA | none |
| `appointments` | coaching, CA, consultants (recommended) | legacy, not engine-grade |
| `commerce` | retail, restaurant (+ coaching, CA optional) | partial, catalog and digital orders only |
| `contentCohorts` | coaching | legacy, not engine-grade |
| `venueOrders` | restaurant | shipped, minus reservations |
| `fieldJobs` | none in Wave 0 | none |

## 4. Wave 1 map, briefly

Wave 1 per both sources: salon/spa/wellness, home/field services, events/weddings/media,
real estate/property. **None has a blueprint. All four are unbuilt.**

| Vertical (rank, score) | Engine composition | Missing primitive |
|---|---|---|
| Salon, spa and wellness (4, 4.55) | `appointments` R `services` `availability` `reminders`; `commerce` O `catalog` `orders`; `contentCohorts` O `memberships` | **Deposits** and **waitlist** are in the scorecard's required pack and in the `appointments` ownership row, but neither has a capability id. Staff utilisation reporting has no home |
| Home and field services (7, 4.42) | `fieldJobs` R `intake` `dispatch` `inspection`; `commerce` O `inventory` for parts; `casesProjects` O `billing` | Entire engine is greenfield. **Routes** and **parts** have no capability id. Highest build cost in Wave 1 |
| Events, weddings and media (8, 4.42) | `casesProjects` R `pipeline` `delivery` `billing`; `appointments` R `services` `availability`; `venueOrders` O `reservations` for date holds | **Vendors**, **contracts**, **run-of-show**, and **payment schedules** map to no capability. Packages have no home |
| Real estate and property (9, 4.38) | `casesProjects` R `pipeline` `delivery`; `appointments` R `services` `availability` `reminders`; `fieldJobs` O `intake` `dispatch` for property tickets | **Listings** are not products, so `commerce.catalog` is the wrong shape. Its non-discrimination boundary needs enforced approval gates that do not exist |

Wave 1 adds no new engine to Wave 0 except `fieldJobs`. Everything else is reuse, which is
the point of the engine model and is consistent with the high `reuse_score` values (4 to 4.5)
on these rows.

## 5. Wave 2 and beyond, in one paragraph

The scorecard already encodes engine sequencing in its `recommended_wave` text and it is
worth honouring literally: hotels and homestays says "after restaurant engine" (it reuses
`venueOrders` `reservations` plus `guestTracking`), automotive says "after field-service
pilot" (it reuses `fieldJobs` wholesale), and recruiting says "after shared workflow core",
which is a direct dependency on real workflow execution rather than on any engine. Schools
and daycare, pet care, and NGOs are all `contentCohorts` plus `appointments` reuse with
heavier consent and data-handling requirements. Wave 3 (clinics admin-only, manufacturing)
and Wave 4 (hospitals) stay blueprint-only. Nothing in Wave 2 or later should be started
while any Wave 0 required engine is still unbuilt.

## 6. Capability vocabulary is coarser than the contract

This is the most consequential structural finding, and it affects every mapping above.

`ENGINE_CONTRACTS.md` gives each engine an ownership list of eight or nine nouns.
`engines.ts` gives each engine exactly three capability ids. The compression is lossy, and
because `assertValidBusinessBlueprint` only accepts declared ids, the lost nouns are not
addressable by any blueprint.

| Engine | Nouns in the contract's "Owns" column | Capability ids | Not independently addressable |
|---|---|---|---|
| `commerce` | 8 | 3 | variants, cart, payment, fulfilment, return |
| `appointments` | 8 | 3 | staff, resources, **deposits**, **waitlist**, no-show recovery |
| `contentCohorts` | 8 | 3 | lessons, attendance, assignments, progress, certificates |
| `venueOrders` | 8 | 3 | tables, rooms, seats, live queues, status history |
| `fieldJobs` | 9 | 3 | quote, technician, **route**, asset, job card, **parts**, invoice |
| `casesProjects` | 8 | 3 | lead, brief, **documents**, milestones, tasks, approvals, deliverables |

Consequences to decide in P1, not to paper over:

1. A blueprint cannot express "appointments with deposits but no waitlist". Salon needs
   deposits; coaching does not. Today both get the same `services`/`availability` bundle.
2. Capability descriptions are carrying load that ids should carry. `commerce.orders`
   silently includes returns; `contentCohorts.memberships` silently includes certificates.
   Validation cannot check a description.
3. Either the capability list is deliberately coarse — in which case
   `ENGINE_CONTRACTS.md`'s ownership rows should stop implying finer switches — or the
   capability list needs to grow to match. Pick one and record it as an ADR.

## 7. Where the scorecard and the engine model disagree

Stated plainly rather than smoothed over.

1. **Wave 0 is not the top five by score.** Salon and spa ranks 4 at 4.55, above CA (4.47)
   and restaurant (4.45), yet it is Wave 1 while both lower-ranked rows are Wave 0. Wave
   assignment is actually driven by reuse of the current base and by in-flight work, not by
   `opportunity_score`. The `rank` column therefore does not predict build order and should
   not be read as a queue.
2. **Wave is not a function of score anywhere.** Clinics rank 14 at 4.08 is Wave 3 while pet
   care ranks 15 at 4.00 is Wave 2. The real driver is `safety_readiness_score` — 2.5 versus
   3.5. Two columns are doing the sequencing and neither is `rank`.
3. **The scorecard's archetypes do not map one-to-one onto engine ids.** "Content/cohort +
   appointment", "Case/project + appointment", "Venue/order", "Field job", and "Commerce"
   line up, but "Venue/reservation" (hotels) and "Commerce + case/inventory"
   (manufacturing) are compound labels with no single engine, and "Appointment + case"
   (clinics, pet care) implies a `casesProjects` usage that is clinical-record shaped rather
   than project shaped. The archetype column is a hint, not a composition.
4. **The scorecard demands packs the engine model has no vocabulary for.** Supplier sync
   (retail), statutory deadlines and accounting integrations (CA), subscriptions (coaching),
   vendors and contracts (events), listings (real estate), channel manager (hotels), ERP sync
   (manufacturing). Every one of these is a required pack entry with no capability id.
5. **`restaurant-venue-v1` is `active` while two of its five declared capabilities are not
   implemented.** `venueOrders.reservations` is a JSON blob on a generic `Booking` and
   `commerce.inventory` is one nullable integer. Validation passes because it only checks
   that capability ids exist, never that they are backed by anything. Blueprint status is
   currently an assertion nobody verifies.
6. **Every hard boundary in the scorecard assumes an approval gate that does not run.** The
   `hard_boundary` column is populated for all 18 rows, and `ENGINE_CONTRACTS.md` requires
   approval or audit for money, messaging, and published-surface changes. `workflow.ts`
   plans approvals in memory and persists nothing. Until that is real, no vertical whose
   boundary involves money or external sends should go `active`.
7. **Minor data hygiene in the CSV.** Row 16 has a space between the comma and the opening
   quote of `primary_archetype` (`"Manufacturing & wholesale", "Commerce + case/inventory"`),
   which strict RFC 4180 parsers reject. Row 14's vertical name contains an em dash. Fix
   before anything parses this file programmatically.

## 8. Sequencing rules and build order

**Rule: a vertical must not be built before the engines it requires are real.** "Real" means
the `ENGINE_CONTRACTS.md` bar — owned tables, guarded transitions, server-side money, an
append-only event log, publish-after-commit, and idempotent external writes — not merely a
descriptor entry in `engines.ts`. Only `venueOrders` currently clears it.

Corollaries:

- A blueprint may be authored as `draft` before its engines exist. That is cheap and useful.
  It may not be promoted to `active`, because `draft` is what keeps it off live profiles.
- Shared engines are built once, ahead of the verticals that consume them. No vertical fork
  of an engine, per the `PROGRAM.md` non-negotiables.
- Legacy code is not an engine. Appointments and cohorts have working features that must be
  refactored behind engine contracts, not re-implemented and not assumed compliant.

**Fan-out, counted across all 18 scorecard rows.** This is what should set engine order:

| Engine | Verticals that need it | Waves touched | Status |
|---|---|---|---|
| `appointments` | ~9 (coaching, consultants, CA, salon, events, real estate, schools, pet care, clinics) | 0, 1, 2, 3 | legacy only |
| `casesProjects` | ~8 (consultants, CA, events, real estate, recruiting, clinics, pet care, manufacturing) | 0, 1, 2, 3 | nothing |
| `commerce` | ~6 (retail, restaurant, salon, pet care, manufacturing, coaching optional) | 0, 1, 2, 3 | partial |
| `contentCohorts` | ~3 (coaching, schools, NGOs) | 0, 2 | legacy only |
| `venueOrders` | ~2 (restaurant, hotels) | 0, 2 | shipped |
| `fieldJobs` | ~3 (home services, automotive, real estate tickets) | 1, 2 | nothing |

`appointments` and `casesProjects` together unblock roughly two thirds of the portfolio.
`fieldJobs` unblocks two verticals and is entirely greenfield, so it is correctly last.

**Recommended order, with the gate each step must clear:**

1. **Finish `venueOrders`.** Give `reservations` a real model related to `RestaurantTable`,
   or drop `reservations` from `restaurant-venue-v1` until it exists. An `active` blueprint
   must not declare a capability with no implementation. Gate: table capacity and
   double-book rejection at the boundary.
2. **Make workflows and approvals real.** Persist runs, approvals, and audit records; wire
   event and schedule triggers. This is a precondition for every vertical with a
   money-or-messaging boundary, which is all of them, and it is what the scorecard means by
   "after shared workflow core". Gate: an approval that blocks an action and leaves a record.
3. **Promote `appointments` to an engine.** Wrap `Booking`, `AvailabilitySchedule`,
   `CalendarOverride`, and `ServiceOffering`; add guarded transitions and an event log.
   Decide deposits and waitlist here. Unblocks coaching, CA, salon, events, real estate.
4. **Build `casesProjects`.** Greenfield, highest fan-out, and the blocker on two Wave 0
   verticals. Decide whether `documents` becomes its own capability id. Unblocks consultants
   and CA, then most of Wave 1 and 2.
5. **Promote `contentCohorts` to an engine.** Completes coaching, the top-ranked vertical.
6. **Deepen `commerce`.** Split `DigitalProduct` into product and variant, add a real stock
   ledger with holds, unify the two order implementations, add returns. This is the largest
   schema change and the reason retail is last in Wave 0 despite ranking third.
7. **Build `fieldJobs`.** Opens Wave 1 home services and Wave 2 automotive.

**Resulting vertical order.** Wave 0: restaurant (finish) → coaching → consultants → CA →
retail. Wave 1: salon → events → real estate → home services. That ordering follows engine
readiness, not scorecard rank, and it inverts rank for retail specifically because
`commerce` needs the most work.

## 9. Open questions for P1

1. Does the capability vocabulary grow to match the contract's ownership lists, or does the
   contract stop implying switches it cannot express? One ADR, either way.
2. Does blueprint validation start checking that a declared capability is backed by an
   implementation, so `status: active` means something enforceable?
3. Where do subscriptions and recurring billing live — `commerce.orders`,
   `casesProjects.billing`, or a new capability?
4. Do `documents` and `deposits` become first-class capability ids? Four verticals want the
   first and two want the second.
5. Who owns the integration surface (accounting, POS, channel manager, ERP)? It appears in
   five scorecard rows and in no engine.
