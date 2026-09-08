# Restaurant integration — requirements

Live order handling for staff and guests, printable per-table QR codes, an
ambience gallery, and a review wall.

Scope decisions taken 2026-08-26:

- **Both** a staff kitchen view and a guest-facing tracker.
- Table QR printing must produce **multiple codes per sheet**.
- Payment ends at **staff marking an order paid**. A gateway comes later; the
  model must not have to change when it does.

---

## 1. Order as a real entity

Today an order is N unrelated `ProductPurchase` rows. The table number lives in a
column called `address`, and quantity and modifiers live in `buyerNote` as prose
(`"x2 · Extra cheese, Large"`). Nothing can group the lines of one cart.

**1.1** An order SHALL be a single record with many lines, so every line of one
cart is retrievable together.

**1.2** Each line SHALL store quantity as an integer, the unit price captured at
order time, and modifiers as structured data — not as text to be parsed.

**1.3** An order SHALL store the table it belongs to as a relation, plus a
denormalised label so renaming or deleting a table does not corrupt past orders.

**1.4** An order SHALL carry a status through `PLACED → ACCEPTED → PREPARING →
READY → SERVED → PAID`, and MAY be `CANCELLED` from any state before `PAID`.

**1.5** Each line SHALL carry its own status, because a kitchen finishes items at
different times.

**1.6** Every status change SHALL be recorded with a timestamp and who caused it,
so tickets can be aged and disputes settled.

**1.7** An order SHALL have a short per-restaurant, per-day number for staff to
call out, and a separate unguessable token for guest access.

**1.8** Existing `ProductPurchase` rows from the restaurant flow SHALL be migrated
into orders, with quantity recovered from `buyerNote` where parseable.

**1.9** Revenue reporting SHALL read the order total. Today `/dashboard/money`
values every cash order at one unit of the product price, so multi-quantity
orders are under-counted.

**Acceptance:** given a cart of 3 dishes, one with quantity 2 and two modifiers,
placing it creates one order with three lines, correct integer quantities,
structured modifiers, and a total matching the sum of line totals.

---

## 2. Live updates without a reload

There is no realtime mechanism in the app today beyond the visitor chat widget
polling every 2.5s. A guest placing an order cannot cause a dashboard to change.

**2.1** When an order is placed or changes status, every open staff board for that
restaurant SHALL reflect it within 2 seconds without a manual reload.

**2.2** A guest watching their own order SHALL see status changes within 2 seconds.

**2.3** A dropped connection SHALL reconnect automatically and recover any changes
missed while disconnected — a board that silently stops updating is worse than one
that never did.

**2.4** Where the live connection cannot be established, the UI SHALL fall back to
periodic refresh and SHALL indicate that it is degraded.

**2.5** The staff stream SHALL be authenticated and scoped to profiles the signed-in
user owns. A guest stream SHALL be scoped to **one order** by its token, never to a
whole restaurant.

**Acceptance:** two browsers open on the board; an order placed in a third appears
in both within 2s. Killing the network for 30s and restoring it leaves both boards
showing the same state as a freshly loaded page.

---

## 3. Staff order board

`/dashboard/orders` today lists every purchase ever made, all-time, unpaginated,
and renders neither the table number nor the modifiers. It has **no navigation
entry** — it is reachable only by typing the URL.

**3.1** Staff SHALL have a board reachable from the dashboard navigation.

**3.2** Tickets SHALL be grouped by status, with a toggle to group by table for
floor service.

**3.3** Each ticket SHALL show the order number, table, time since placed, and
every line with its quantity and modifiers.

**3.4** Ticket age SHALL be visually graded so a late order is obvious without
reading timestamps.

**3.5** Staff SHALL advance an order, or tick off an individual line, in one tap.

**3.6** A newly placed order SHALL announce itself audibly and in the tab title,
since the board will not be the focused tab.

**3.7** Staff SHALL mark an order paid, recording who and when. Until a gateway
exists this is the only route to `PAID`.

**3.8** Staff SHALL cancel an order with a reason.

**Acceptance:** a new order triggers a sound and a tab badge; advancing it through
every state to `PAID` updates a second open board each time; the ticket shows
`2× Chicken Burger · Extra cheese` and `Table 7`.

---

## 4. Guest order tracking

Today a guest sees a message and is given no order reference at all.

**4.1** After placing an order the guest SHALL be taken to a tracking view for it.

**4.2** The tracking view SHALL be reachable later from the same link, without an
account, and SHALL survive a refresh or a new browser session.

**4.3** The guest SHALL see the current stage, which items are ready, the order
number, and the table.

**4.4** The guest SHALL NOT be able to see any other order.

**4.5** The tracking link SHALL show an estimate of remaining time where one can be
derived, and SHALL degrade gracefully to stage-only when it cannot.

**Acceptance:** placing an order lands on a tracker; staff advancing to `READY`
updates it within 2s; altering the token in the URL yields not-found, not
another order.

---

## 5. Per-table QR codes, printable

The QR encoder (`src/lib/qr-encode.ts`) and the card renderer
(`src/lib/qr-draw.ts`) already exist, but the renderer is canvas and therefore
browser-only, and `QrCard` hardcodes `/{slug}?ref=qr` with no way to pass a URL.
Nothing in the app reads a `?table=` parameter.

**5.1** A restaurant SHALL manage its tables: label, seat count, zone, active flag,
display order.

**5.2** Each table SHALL have a stable opaque code used in its QR URL, so codes
survive renaming a table.

**5.3** Scanning a table's code SHALL open the menu with that table already
identified, and the guest SHALL NOT have to type a table number.

**5.4** An invalid or retired code SHALL fall back to manual table entry rather
than failing.

**5.5** Staff SHALL print **many table codes on one sheet**, on A4 and Letter, with
a selectable number per page.

**5.6** Print output SHALL be vector, so codes stay sharp at any physical size.
Canvas PNG is not acceptable for print.

**5.7** Each printed card SHALL carry the table label, the restaurant name, and a
short instruction, and SHALL be cuttable — crop marks or clear gutters.

**5.8** Staff SHALL also download a single table's code as an image for use
elsewhere.

**5.9** Scan counts per table SHOULD be recorded.

**Acceptance:** 12 tables print on two A4 sheets, 6 per page, each cuttable, and
scanning one on a phone opens the menu with that table pre-set and non-editable.

---

## 6. Ambience gallery

Multi-image support exists only on products (`DigitalProduct.galleryUrls`).
`Profile` has exactly two image fields, `imageUrl` and `shopLogoUrl`.

**6.1** A restaurant SHALL hold an ordered set of images describing the place, not
the food alone.

**6.2** Each image SHALL support a caption and a category (ambience, interior,
food, team, event).

**6.3** Staff SHALL upload, caption, reorder and remove them from the dashboard.

**6.4** Visitors SHALL see a gallery on the public profile and a fuller dedicated
view.

**6.5** Gallery images SHALL be served at a sensible size. The app currently uses
raw `<img>` everywhere with no optimisation; a gallery is where that begins to
cost real load time.

**Acceptance:** eight images uploaded, captioned, reordered by drag; the public
profile shows them in that order; a phone on a throttled connection loads the
gallery without downloading full-resolution originals.

---

## 7. Review wall

`OfferReview` is per-dish only. There is no profile-level review, no moderation,
no owner reply. `addProductReview` has no authentication, no rate limit and no
purchase verification — anyone can post anything.

**7.1** A visitor SHALL be able to review the restaurant overall, not only a dish.

**7.2** A wall SHALL present restaurant and dish reviews together, with photos.

**7.3** Reviews SHALL have a moderation state, and staff SHALL hide one.

**7.4** Staff SHALL reply publicly to a review.

**7.5** A review linked to a real order SHALL be distinguishable from an anonymous
one.

**7.6** Review submission SHALL be rate limited.

**7.7** Menu ratings SHALL come from real reviews. `[slug]/shop/page.tsx` currently
fabricates them (`downloadCount > 0 ? 4.5 : compareAtCents ? 4.2 : 4.1`) while the
AR viewer shows genuine averages — a wall makes that contradiction visible.

**Acceptance:** a wall shows dish and restaurant reviews with photos and owner
replies; hiding one removes it from public view immediately; the menu grid and the
AR card show the same number for the same dish.

---

## 8. Fix alongside, not after

These are pre-existing defects that this work either depends on or worsens.

**8.1** `POST /api/upload` has **no authentication and no rate limit**, allows
`application/octet-stream`, and writes into `public/uploads/`. Anyone who finds it
can fill the disk with arbitrary files served from the restaurant's own domain.
Requirements 6 and 7 both increase upload traffic, so this SHALL be fixed **before**
them.

**8.2** `prisma/migrations/migration_lock.toml` says `provider = "sqlite"` while the
database is PostgreSQL, so `prisma migrate` fails with P3019. Every requirement
above needs a migration, so this is the first task.

**8.3** `generateSlots` builds times with server-local `new Date("...")` and ignores
`Profile.timezone`, so reservations are wrong whenever the server and the restaurant
are in different zones.

**8.4** `ensureTableService` performs a database write during a public `GET` of the
profile page.

**8.5** `placeCartOrder` does not verify that all cart lines belong to the same
profile.

**8.6** `addProductReview` and `[slug]/shop/[id]/page.tsx` use raw SQL to work
around a stale generated Prisma client. The `imageUrl` column **does** exist in the
database (verified 2026-08-26); regenerating the client and deleting the raw SQL is
a cleanup, not a migration.

---

## Out of scope

Payment gateway integration, printed kitchen dockets, delivery or third-party
aggregator sync, table-side payment, inventory depletion per dish, and staff
accounts with per-role permissions. The order model should not need to change to
add the first of these.
