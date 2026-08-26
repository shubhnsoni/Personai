# Restaurant integration — tasks

Requirement numbers refer to `requirements.md`. Phase order and reasoning are in
`design.md`.

Nothing here is started. Phase 0 task 1 blocks every other task in the document.

---

## Phase 0 — Order model

- [ ] **0.1** Set `prisma/migrations/migration_lock.toml` to `provider = "postgresql"`
      and confirm `prisma migrate status` runs. `prisma migrate` currently fails with
      P3019 because it claims sqlite. *(req 8.2 — blocks everything below)*
- [ ] **0.2** Run `prisma generate` and delete the raw-SQL workarounds for
      `OfferReview.imageUrl` in `src/app/actions/products.ts` (`$executeRaw`) and
      `src/app/[slug]/shop/[id]/page.tsx` (`$queryRaw`). The column exists in the
      database — verified 2026-08-26 — so this is a stale client, not a schema gap.
      *(req 8.6)*
- [ ] **0.3** Add `Order`, `OrderLine`, `OrderEvent`, `RestaurantTable` and
      `OrderCounter` to `schema.prisma` as specified in the design, with indexes.
      *(req 1.1–1.7)*
- [ ] **0.4** Migration for 0.3.
- [ ] **0.5** `createOrder` server action: allocates the daily number under a row
      lock in the same transaction, writes lines with integer `qty`, snapshotted
      `titleSnapshot` and `unitPriceCents`, structured `modifiers`, and computes
      `subtotalCents`/`totalCents` **server-side**. Today the server never computes a
      total. *(req 1.1, 1.2, 1.7)*
- [ ] **0.6** Verify every cart line belongs to the same profile and reject
      otherwise. `placeCartOrder` does not check this today. *(req 8.5)*
- [ ] **0.7** `advanceOrder` / `setLineStatus` / `markPaid` / `cancelOrder` actions,
      each writing an `OrderEvent` with actor and timestamp. Reject illegal
      transitions rather than trusting the caller. *(req 1.4–1.6, 3.7, 3.8)*
- [ ] **0.8** Point `restaurant-menu.tsx` checkout at `createOrder`, returning the
      `publicToken`. Keep `placeCartOrder` for non-restaurant products.
- [ ] **0.9** Backfill script: group existing restaurant `ProductPurchase` rows by
      `(visitorEmail, createdAt)` proximity into orders, recover `qty` from
      `buyerNote`, move `address` to `tableLabel`. **Report the count of rows whose
      quantity could not be parsed rather than defaulting them to 1.** Idempotent and
      dry-runnable. *(req 1.8)*
- [ ] **0.10** `/dashboard/money` and `orders/page.tsx` read `Order.totalCents`.
      Multi-quantity cash orders are currently under-counted because the money board
      values each at one unit. *(req 1.9)*
- [ ] **0.11** Tests: number allocation under concurrency (two simultaneous orders
      must not collide), total arithmetic with modifiers, illegal transition
      rejection, backfill on a copy of the real data.

## Phase 1 — Live transport

- [ ] **1.1** `src/lib/realtime.ts` with `publish(profileId, event)` and
      `subscribe`, backed by an in-process map. Keep `publish` as the only
      write path so it can later become Redis pub/sub. *(design: single-process limit)*
- [ ] **1.2** `GET /api/events/orders` — Clerk-authenticated, scoped to profiles the
      user owns. *(req 2.5)*
- [ ] **1.3** `GET /api/events/order/[token]` — scoped to exactly one order. Must not
      accept a profile id. *(req 2.5, 4.4)*
- [ ] **1.4** 25s heartbeat, `X-Accel-Buffering: no`, compression off. Verify a
      stream survives 5 minutes idle **through a Cloudflare quick tunnel** before
      anything is built on top. *(design risk)*
- [ ] **1.5** `Last-Event-ID` replay from `OrderEvent.seq`. *(req 2.3)*
- [ ] **1.6** Emit from the Phase 0 actions.
- [ ] **1.7** `useOrderStream` hook: `EventSource`, backoff reconnect, 10s
      `router.refresh()` fallback, and a degraded flag for the UI. *(req 2.4)*
- [ ] **1.8** Test: two clients, place and advance, assert both under 2s; kill the
      network 30s and assert recovery matches a fresh load. *(req 2.1–2.3)*

## Phase 2 — Staff board

- [ ] **2.1** Add `orders` to `Surface` in `src/lib/surfaces.ts`, grant it to
      `RESTAURANT` in `KIT`, extend `navHrefToSurface` and `surfaceForPath`.
- [ ] **2.2** Nav entry in `navGroups` (`sidebar.tsx`). `/dashboard/orders` has **no
      nav entry today** and is reachable only by URL. `mobile-sidebar.tsx` shares the
      list so it follows automatically. *(req 3.1)*
- [ ] **2.3** `/dashboard/orders/board` grouped by status, with a group-by-table
      toggle. Leave the existing list page for digital purchases. *(req 3.2)*
- [ ] **2.4** Ticket component: number, table, age, lines with qty and modifiers —
      the current page renders neither `address` nor `buyerNote`. *(req 3.3)*
- [ ] **2.5** Age grading with elapsed minutes as text, not colour alone. *(req 3.4)*
- [ ] **2.6** One-tap advance and per-line tick. *(req 3.5)*
- [ ] **2.7** WebAudio blip plus title badge; arm on first interaction and show that
      it is unarmed until then, since autoplay will block it. *(req 3.6)*
- [ ] **2.8** Mark-paid and cancel-with-reason controls. *(req 3.7, 3.8)*
- [ ] **2.9** Reservations arrivals strip on the board: `booked → seated → done`,
      reusing `Booking` and `parseReservation`. Mostly UI over existing data.
- [ ] **2.10** Test on a phone-width viewport — this gets used on a handset on a
      counter, not a desktop.

## Phase 3 — Guest tracker

- [ ] **3.1** `/{slug}/order/[token]`: stage stepper, per-item state, number, table.
      Not-found on a bad token, never another order. *(req 4.1, 4.3, 4.4)*
- [ ] **3.2** Redirect there after checkout, keeping WhatsApp as a secondary action.
      Guests currently get a message and no order reference at all. *(req 4.1)*
- [ ] **3.3** Subscribe to the single-order stream. *(req 4.2)*
- [ ] **3.4** ETA from the median of the last 20 completed orders; stage-only below
      5 samples. *(req 4.5)*
- [ ] **3.5** Verify the link works in a fresh session and after a refresh. *(req 4.2)*

## Phase 4 — Table QR and print

- [ ] **4.1** `/dashboard/tables` CRUD: label, seats, zone, active, order. Generate
      an opaque `code` that is never the label. *(req 5.1, 5.2)*
- [ ] **4.2** `src/lib/qr-svg.ts` — vector output from the existing `encodeQr`.
      `qr-draw.ts` is canvas and browser-only, so it cannot serve print. *(req 5.6)*
- [ ] **4.3** Resolve `?t=<code>` in `shop/page.tsx`, increment `scans`, pass the
      label into `RestaurantMenu`. *(req 5.3, 5.9)*
- [ ] **4.4** Show the table as confirmed in `CartSheet` instead of asking for it;
      persist the code in `sessionStorage` beside the cart. Unknown or retired codes
      fall back to manual entry. *(req 5.3, 5.4)*
- [ ] **4.5** `/dashboard/tables/print`: A4 and Letter, 4/6/8/12 per page,
      `break-inside: avoid`, crop marks, label + restaurant name + instruction.
      *(req 5.5, 5.7)*
- [ ] **4.6** Single-table PNG download via the existing canvas path. *(req 5.8)*
- [ ] **4.7** **Print one real sheet and scan it with a phone at the intended card
      size** before generating a batch. *(design risk)*

## Phase 5 — Gallery

- [ ] **5.1** Secure `POST /api/upload`: require an authenticated session, rate
      limit, drop `application/octet-stream`, cap per-profile storage. It is
      currently open to anyone and writes into a publicly served directory — do this
      **before** 5.3. *(req 8.1)*
- [ ] **5.2** `ProfileImage` model and migration. *(req 6.1, 6.2)*
- [ ] **5.3** Dashboard editor: upload, caption, category, drag-reorder, remove.
      Extend `PhotoStage`. *(req 6.3)*
- [ ] **5.4** Public gallery section on the profile plus `/{slug}/gallery`, reusing
      `StoryGallery`. *(req 6.4)*
- [ ] **5.5** Introduce `next/image` for gallery images. The app uses raw `<img>`
      throughout and serves originals from disk. *(req 6.5)*
- [ ] **5.6** Verify on a throttled connection that originals are not being shipped.

## Phase 6 — Review wall

- [ ] **6.1** `OfferReview`: nullable `productId`, add `profileId`, `orderId`,
      `status`, `ownerReply`, `ownerRepliedAt`, and a constraint that exactly one of
      product/profile is set. Migration. *(req 7.1, 7.3–7.5)*
- [ ] **6.2** Restaurant-level review submission. *(req 7.1)*
- [ ] **6.3** Wall combining dish and restaurant reviews with photos. *(req 7.2)*
- [ ] **6.4** Moderation: hide/show from the dashboard. *(req 7.3)*
- [ ] **6.5** Owner reply. *(req 7.4)*
- [ ] **6.6** Verified-diner badge from `orderId`. *(req 7.5)*
- [ ] **6.7** Rate limit submission via `src/lib/rate-limit.ts`. Currently
      unauthenticated, unlimited and unverified. *(req 7.6)*
- [ ] **6.8** One `productRating()` helper returning a real aggregate or `null`.
      Use it in `[slug]/shop/page.tsx`, the AR page and the dish page; omit stars
      when null instead of inventing 4.1. *(req 7.7)*

## Cleanups — any time after 0.1

- [ ] **C.1** `generateSlots` to honour `Profile.timezone` instead of server-local
      `new Date("...")`. Reservations are wrong when the server and restaurant are in
      different zones. *(req 8.3)*
- [ ] **C.2** Move `ensureTableService` out of the public profile `GET`; it writes to
      the database during a page view. *(req 8.4)*
- [ ] **C.3** Replace the hardcoded `dishGroups(category, title)` heuristics in
      `src/lib/dish-options.ts` with modifier groups stored on the product. Modifiers
      are currently guessed from the dish name.
- [ ] **C.4** Paginate `/dashboard/orders`; it lists every purchase ever made with
      no date window.

---

## Verification gates

Per phase, before moving on:

- Phase 0 — backfill dry-run on a copy of production data with a reported
  unparseable count; concurrent order numbering test green.
- Phase 1 — a stream survives 5 minutes idle through the tunnel; reconnect replay
  matches a fresh page load.
- Phase 2 — two boards plus a guest order stay in agreement through a full
  `PLACED → PAID` cycle; usable at phone width.
- Phase 3 — token from one order cannot reach another.
- Phase 4 — a physically printed card scans at the intended size.
- Phase 5 — upload rejects an unauthenticated request; gallery does not ship
  originals.
- Phase 6 — the same dish shows one rating in the menu grid, the dish page and the
  AR card.
