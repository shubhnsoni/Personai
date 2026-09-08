# Restaurant integration — design

Companion to `requirements.md`. Records the schema, the transport, and the
decisions that were not obvious, with the reasoning kept attached so a later
reader can tell an intentional choice from an accident.

> **2026-09-03.** Kitchen/order design in this file is the shipped restaurant
> reference. Guest-loop generalization (About footer, FillFromListing, other
> kits) lives in [`docs/strategy/all-ends-plan.md`](../../strategy/all-ends-plan.md).
> Do not add sidebar items from the old tasks list.

---

## Why the data model comes first

`placeCartOrder` writes one `ProductPurchase` per cart line and nothing that ties
them together:

```ts
// src/app/actions/products.ts — current behaviour
buyerNote: [`x${qty}`, line.extras].filter(Boolean).join(" · ")   // "x2 · Extra cheese"
address:   input.address?.trim() ?? null                          // the table number
```

Quantity, modifiers and the table are all strings in fields meant for other
things, and two lines of the same cart can only be correlated by
`(visitorEmail, createdAt)` proximity. A kitchen board needs to group lines,
age a ticket, and advance a state — none of which this supports. Every other
phase reads from orders, so this lands first.

`ProductPurchase` stays as-is for digital goods. Food and downloads have
genuinely different lifecycles (a download has a token and an expiry; a dish has
a table and a kitchen), and forcing them into one table would mean columns that
are null half the time.

---

## Schema

```prisma
model Order {
  id           String  @id @default(cuid())
  profileId    String
  profile      Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  /// Unguessable; lets a guest track their order with no account (req 4.2, 4.4).
  publicToken  String  @unique
  /// Short number staff call out. Unique per restaurant per day, not global.
  number       Int

  channel      String  @default("DINE_IN")   // DINE_IN | TAKEAWAY
  tableId      String?
  table        RestaurantTable? @relation(fields: [tableId], references: [id], onDelete: SetNull)
  /// Denormalised so renaming or deleting a table cannot corrupt history (req 1.3).
  tableLabel   String?

  status       String  @default("PLACED")
  // PLACED | ACCEPTED | PREPARING | READY | SERVED | PAID | CANCELLED

  guestName    String?
  guestPhone   String?
  guestEmail   String?
  note         String?

  subtotalCents Int
  taxCents      Int    @default(0)
  totalCents    Int
  currency      String

  payMethod    String?                       // UPI | COD | WHATSAPP | STRIPE later
  payStatus    String  @default("UNPAID")    // UNPAID | PAID | REFUNDED
  paidAt       DateTime?
  paidBy       String?                       // staff user id; audit for req 3.7
  /// Reserved for a gateway. Unused until then, so the model need not change.
  paymentRef   String?

  placedAt     DateTime @default(now())
  acceptedAt   DateTime?
  readyAt      DateTime?
  servedAt     DateTime?
  cancelledAt  DateTime?
  cancelReason String?

  lines        OrderLine[]
  events       OrderEvent[]
  reviews      OfferReview[]
  updatedAt    DateTime @updatedAt

  @@index([profileId, status])
  @@index([profileId, placedAt])
  @@unique([profileId, number, placedAt])
}

model OrderLine {
  id             String @id @default(cuid())
  orderId        String
  order          Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  /// Nullable, and the title is snapshotted: deleting a dish must not erase
  /// what someone ate or what they paid.
  productId      String?
  product        DigitalProduct? @relation(fields: [productId], references: [id], onDelete: SetNull)
  titleSnapshot  String

  qty            Int                        // integer, not "x2" in prose (req 1.2)
  unitPriceCents Int                        // captured at order time
  /// [{ group, label, priceCents }] — structured, so it can be totalled
  modifiers      String?
  modifiersLabel String?                    // pre-rendered for the ticket
  lineTotalCents Int

  status         String @default("QUEUED")  // QUEUED | PREPARING | READY | SERVED
  createdAt      DateTime @default(now())

  @@index([orderId])
}

/// Audit trail, ticket ageing, and the replay log for a reconnecting stream.
model OrderEvent {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  seq     BigInt @default(autoincrement())   // cursor for Last-Event-ID (req 2.3)
  from    String?
  to      String
  actor   String                             // GUEST | STAFF | SYSTEM
  actorId String?
  at      DateTime @default(now())

  @@index([orderId, seq])
}

model RestaurantTable {
  id        String  @id @default(cuid())
  profileId String
  profile   Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  label     String                 // "7", "Patio 2"
  seats     Int?
  zone      String?                // Indoor | Patio | Rooftop
  /// Opaque and stable, so a QR already stuck to a table keeps working when the
  /// table is renamed (req 5.2). Never the label.
  code      String  @unique
  isActive  Boolean @default(true)
  sortOrder Int     @default(0)
  scans     Int     @default(0)    // req 5.9

  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([profileId, label])
}

model ProfileImage {
  id        String  @id @default(cuid())
  profileId String
  profile   Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  url       String
  caption   String?
  category  String  @default("AMBIENCE")  // AMBIENCE | INTERIOR | FOOD | TEAM | EVENT
  sortOrder Int     @default(0)
  createdAt DateTime @default(now())

  @@index([profileId, sortOrder])
}
```

A separate table rather than another `galleryUrls` JSON string, because ordering,
captions and per-image categories all need querying and updating individually.

### OfferReview additions

```prisma
// productId becomes nullable: a review is now of a dish OR of the restaurant.
productId     String?
profileId     String?
profile       Profile? @relation(...)
/// Links a review to a real order, which is what makes "verified diner" honest.
orderId       String?
order         Order?   @relation(...)
status        String   @default("PUBLISHED")  // PENDING | PUBLISHED | HIDDEN
ownerReply    String?
ownerRepliedAt DateTime?
```

A check constraint that exactly one of `productId` / `profileId` is set.

---

## Order numbering

Requirement 1.7 wants a short number, per restaurant, per day. The obvious
`count(*) + 1` races under concurrent orders and would hand two tables the same
number — exactly when a restaurant is busy enough to care.

Allocate inside the same transaction that creates the order, taking a row lock on
a per-profile counter, resetting when the stored date is not today:

```
BEGIN
  SELECT ... FROM "OrderCounter" WHERE "profileId" = $1 FOR UPDATE
  -- reset to 0 when day <> today, then increment
  INSERT Order (number = next) ...
COMMIT
```

The `@@unique([profileId, number, placedAt])` is a backstop, not the mechanism.

---

## Live transport

The app self-hosts `next start`, writes uploads to local disk, and has no realtime
dependency of any kind. One long-lived process makes **server-sent events viable
with no new infrastructure** — which is why SSE over WebSockets or a hosted
service. SSE is also one-directional, which is all this needs: mutations go
through existing server actions.

```
src/lib/realtime.ts
  publish(profileId, event)          // called by order server actions
  subscribe(profileId, handler)      // returns unsubscribe
  // in-process Map<profileId, Set<controller>>
```

Two endpoints, deliberately not one:

| Route | Auth | Scope |
|---|---|---|
| `GET /api/events/orders` | Clerk session, profiles the user owns | whole restaurant |
| `GET /api/events/order/[token]` | the token itself | exactly one order |

Requirement 4.4 is the reason. A single profile-wide stream that guests could also
open would leak every table's orders to anyone who ordered a coffee.

Operational details that SSE gets wrong if ignored:

- **Heartbeat every 25s.** These demos run through a Cloudflare quick tunnel,
  which will drop an idle stream.
- **`X-Accel-Buffering: no`** and no compression, or a proxy will buffer events
  into batches and the "live" board updates in clumps.
- **`Last-Event-ID`** replayed from `OrderEvent.seq`, satisfying requirement 2.3.
  Reconnect without replay is the failure mode where a board looks healthy and is
  silently stale.
- The existing global `Cache-Control: no-store` in `next.config.ts` is already
  correct for this.

**Known limit, stated plainly:** this dies with a second instance or a move to
serverless. `publish()` is the seam — swapping its body for Redis pub/sub is a
contained change, and nothing else needs to know.

Client: `useOrderStream(scope)` wrapping `EventSource`, with exponential-backoff
reconnect and a 10s `router.refresh()` fallback that also sets a "reconnecting"
flag for requirement 2.4.

---

## Staff board

New route `/dashboard/orders/board`, leaving the existing list intact for digital
purchases.

Requirement 3.1 needs a navigation entry, and `/dashboard/orders` currently has
none — `surfaceForPath` maps it to `shop` and `navHrefToSurface` only knows the
ten top-level hrefs. Add an `orders` value to `Surface` in `src/lib/surfaces.ts`,
grant it to `RESTAURANT` in `KIT`, and add the nav item to `navGroups` in
`sidebar.tsx`. `mobile-sidebar.tsx` reads the same list, so both follow.

Ticket ageing (3.4) from `placedAt`: under 5 min calm, 5–15 warning, over 15
urgent. Colour alone is not enough — carry the elapsed minutes as text too.

New-order announcement (3.6) via a short WebAudio blip rather than an audio file,
plus a document-title badge. Autoplay policy means the first sound needs a user
gesture; arm it on the first interaction with the board and say so in the UI until
then, rather than silently failing.

---

## Guest tracker

`/{slug}/order/[token]`, a server component for the first paint plus the
single-order stream. `placeCartOrder` returns the token; `restaurant-menu.tsx`
replaces its three current terminal messages with a redirect there, keeping the
WhatsApp hand-off as a secondary action.

ETA (4.5): median of `readyAt - placedAt` over that restaurant's last 20 completed
orders, shown as a range. With fewer than 5 samples show stage only — a fabricated
countdown is worse than none.

---

## Table QR and printing

Reuse `encodeQr` from `src/lib/qr-encode.ts`. Do **not** reuse `qr-draw.ts` for
print: it builds an `HTMLCanvasElement`, so it cannot run on the server, and a
raster QR is soft on paper at tent-card size.

New `src/lib/qr-svg.ts` — pure string output from the same encoder, therefore
server-renderable and vector, satisfying 5.6:

```ts
qrSvg(text: string, opts?: { moduleSize?, quietZone?, dark?, light? }): string
```

`/dashboard/tables` manages tables; `/dashboard/tables/print` is a server
component rendering an A4/Letter grid with a `print:` stylesheet,
`break-inside: avoid` per card, selectable 4/6/8/12 per page, and gutters with
crop marks. Browser print-to-PDF is the delivery mechanism — adequate for 5.5 and
5.7, and it avoids adding a PDF dependency. If bleed or exact trim ever matters,
that is the point to add one.

Single-table download (5.8) keeps the existing canvas path, since PNG is right for
screens.

**Scan flow.** QR encodes `/{slug}/menu?t=<code>`. `shop/page.tsx` resolves `t` to
a `RestaurantTable`, increments `scans`, and passes the resolved label into
`RestaurantMenu`. The menu then shows the table as confirmed rather than as an
editable field, and `CartSheet` stops asking. An unknown or retired code falls
through to today's manual input (5.4). The code is remembered in `sessionStorage`
next to the cart so a mid-session refresh does not lose it.

This also removes a class of error: the table number is currently free text typed
by the guest.

---

## Gallery

`ProfileImage` rows, ordered. Dashboard editor reuses `PhotoStage`, which already
does thumbnails, add and remove; it needs drag-reorder and a caption field. Public
side reuses `StoryGallery` — already built, already good, currently used only on
dish detail pages.

Requirement 6.5 means introducing `next/image` here. The app uses raw `<img>`
throughout and serves originals from local disk, so a gallery of phone photos
would ship several megabytes per visit.

---

## Reviews

Making `productId` nullable and adding `profileId` lets one model serve both, so
the wall is one query rather than a merge of two shapes.

`orderId` is what makes a "verified diner" badge truthful rather than decorative
(7.5). Combined with rate limiting (7.6) it also blunts the current situation
where `addProductReview` has no auth, no limit and no purchase check.

Fabricated ratings (7.7): `[slug]/shop/page.tsx` invents a rating per dish while
`[slug]/ar/page.tsx` computes a real average. Both should call one helper that
returns a real aggregate and `null` when there are no reviews, with the UI
omitting the stars rather than inventing 4.1.

---

## Sequencing and why

| Phase | Contents | Depends on |
|---|---|---|
| 0 | migration lock fix, order + line + event + table models, backfill, money board reads totals | — |
| 1 | SSE hub, two endpoints, client hook | 0 |
| 2 | staff board, nav entry, statuses, mark-paid | 1 |
| 3 | guest tracker, checkout redirect | 1 |
| 4 | table CRUD, `?t=` handling, `qr-svg`, print sheet | 0 |
| 5 | upload auth fix, then `ProfileImage`, editor, public gallery | 8.1 |
| 6 | review model changes, wall, moderation, real ratings | 5 |

Phase 0 alone, because everything reads its shape. Then 1 and 2 together — the
board is what proves the transport actually works. Then 4, which closes the loop
from scanning a table to a ticket appearing. Then 3. Phases 5 and 6 are the most
independent and could run in parallel with a second pair of hands, provided 8.1
lands first.

## Risks

- **Backfill fidelity.** `buyerNote` quantities are prose; anything unparseable
  must be flagged rather than silently defaulted to 1. Report the count.
- **SSE through the tunnel.** Verify heartbeats survive a Cloudflare quick tunnel
  early, before building the board on top.
- **Autoplay.** The new-order sound will not play until the page is interacted
  with. Surface that state.
- **Single process.** Recorded above; the `publish()` seam is the mitigation.
- **Print fidelity.** Verify a real printed sheet scans from a phone at the
  intended card size before generating hundreds.
