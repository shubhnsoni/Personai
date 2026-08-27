# Foundation Design — Contact, Activity, Task/Job & Notification (P1-012)

Wave 1 / Slot 3. Contracts and read-only adapters only — no schema changes this wave.
Everything below lives in pure TypeScript at `src/lib/foundation/` and is exercised by
`scripts/one-off/check-foundation-contracts.ts` without a database.

## 1. Scope and non-goals

- **In scope:** a unified `Contact` identity concept, an append-only `ActivityTimeline`
  contract, a durable task/job queue contract with an in-memory reference implementation,
  and a read-only projection over the existing `Notification` model.
- **Out of scope this wave:** any Prisma schema edit, any migration, any write to an
  existing table, any new persisted table. The task queue's *reference* implementation is
  in-memory and disposable — a durable backing store is future work, gated behind the
  schema proposal in §5.
- **Nothing existing is renamed, dropped, duplicated, or backfilled.** Every adapter in
  `src/lib/foundation/adapters.ts` is a pure function from an existing row shape to a
  foundation type; none of them import Prisma's write client or call `.create`/`.update`/
  `.delete`.

## 2. Identity resolution

Problem: today a single real person can appear as a `Booking.visitorEmail`, an
`Order.guestEmail`, a `Conversation.visitorEmail`, a `CourseEnrollment.visitorEmail`, or a
`Member.email` — four different tables, no shared key. `resolveContacts()`
(`src/lib/foundation/identity.ts`) takes a flat list of `ContactSourceRecord` (one per
source row, produced by the adapters in `adapters.ts`) and returns deduplicated
`ResolvedContact` values.

**Merge key, in priority order:**
1. Normalized email (trimmed, lowercased). Two records sharing a normalized email are
   always merged into one contact.
2. Normalized phone (digits only; whitespace, dashes, parens, and a leading `+` are
   stripped — no country-code inference beyond that). Used only when a record has no
   email.
3. Neither present → the record has no merge key and becomes its own singleton contact.

**Contact id:** a deterministic FNV-1a hash of the merge key (`id:<hash>` for
email/phone-keyed contacts, `anon:<sourceKind>:<sourceId>` for singletons). Same inputs
always produce the same id regardless of array order — verified by the harness
(`identity_resolution` re-runs the same records shuffled and asserts equal `contactId`).

**Confidence:**
| Confidence | When |
|---|---|
| `CONFIRMED` | All merged sources agree on name (case-insensitive) wherever a name is present. |
| `PROBABLE` | Merged by email/phone; only one source in the group supplied a name (nothing to disagree with), or the merge spans profiles. |
| `AMBIGUOUS` | Merged by email/phone AND two or more sources supply *different* non-empty names — e.g. `priya@example.com` booked as "Priya Shah" and later ordered as "P. Shah-Malhotra". The merge still happens (email is the stronger signal) but `ambiguityReason` explains why, for human review. |
| `ANONYMOUS` | No email and no phone on any source in the group — an anonymous guest. Two anonymous guests are **never** merged with each other even if their names match; a shared display name is not a reliable identity signal on its own. |

**Cross-profile spans:** if merged sources disagree on `profileId` (the same email
booked with two different creators/tenants), the resolved contact's `profileId` is `null`
and the span is recorded in `ambiguityReason` rather than silently picking one tenant.

**Missing email, anonymous guest, same-email-different-name** are each covered by an
explicit assertion in the harness's `identity_resolution` section.

## 3. Activity timeline

`ActivityTimeline` (`src/lib/foundation/activity-timeline.ts`) is an in-memory, append-only,
idempotent-by-id ordered view over `ActivityEvent[]` projected from existing rows by the
adapters (`bookingToActivityEvents`, `orderToActivityEvents`,
`conversationToActivityEvent`, `courseEnrollmentToActivityEvents`).

**Ordering rule (total — every pair of events has a defined order):**
1. `occurredAt` ascending when both events have a timestamp.
2. An event with `occurredAt === null` sorts **after** every timestamped event (treated as
   "recent but unconfirmed" rather than arbitrarily backdated to epoch, which would
   misplace it earlier than events we know preceded it).
3. Ties — including two `null`s — break on `id` ascending (`${sourceKind}:${sourceId}`,
   stable per source row), so order never depends on insertion order or a Prisma default
   `orderBy`.

**Append-only** is a projection guarantee: `append()` is idempotent by `id` (re-projecting
the same source row twice does not duplicate it), and there is no `update`/`remove` method
— the only supported operation is appending more projected rows and re-deriving the sorted
view via `all()` / `forContact()`.

## 4. Task/job contract

`src/lib/foundation/task-queue.ts` defines the contract; `task-queue-memory.ts` is the
in-memory reference implementation (`InMemoryTaskQueue`).

**State machine (explicit, total):**
```
PENDING --lease-------------------------> LEASED
LEASED  --complete----------------------> SUCCEEDED         (terminal)
LEASED  --fail (retries remain)---------> PENDING           (nextAttemptAt = now + backoff(attempt))
LEASED  --fail (retries exhausted)------> DEAD_LETTERED      (terminal)
LEASED  --lease expires (visibility timeout)--> PENDING      (re-leaseable; does NOT count as a fail)
SUCCEEDED, DEAD_LETTERED: terminal — no further transition is legal.
```
Any transition not listed (e.g. completing a `DEAD_LETTERED` task, failing a `PENDING`
task, completing with a stale/wrong lease token) throws `IllegalTaskTransitionError`.
Verified by `task_retry_and_dead_letter`.

**Backoff:** `delay(attempt) = min(baseDelayMs * 2^(attempt-1), maxDelayMs)`, deterministic
(no jitter), verified by `task_backoff_math`.

**Idempotency:** `idempotencyKey` is optional per task. Enqueuing with a key that matches
an existing **non-terminal** task is a no-op returning the existing task (guards
"did-my-enqueue-go-through" retries from creating duplicate live jobs). Once the existing
task reaches `SUCCEEDED`/`DEAD_LETTERED`, the same key is allowed to start a new task —
idempotency guards in-flight duplication, not all-time uniqueness. Verified by
`task_idempotent_reenqueue`.

**Lease expiry vs. failure:** `reapExpiredLeases()` returns an expired lease to `PENDING`
without recording an error and without incrementing `attempts` beyond what `lease()`
already counted — a worker crashing mid-task is not the same event as the worker reporting
a failure. Verified by `task_lease_expiry_is_not_a_failure`.

## 5. Notification contract + adapter

`src/lib/foundation/notifications-adapter.ts` projects the existing `Notification` model
(`prisma/schema.prisma`) into `NotificationRecord` (adds a derived `state: "READ"|"UNREAD"`
from `readAt`). It does not replace `src/lib/notifications.ts`, which remains the write
path (`createNotification`, `markNotificationsRead`) — this adapter is read-only and
additive.

## 6. Existing models adapted (read-only)

| Foundation concept | Existing model(s) read | Adapter |
|---|---|---|
| Contact source (guest) | `Booking` (`visitorName`, `visitorEmail`) | `bookingToContactSource` |
| Contact source (guest) | `Order` (`guestName`, `guestEmail`, `guestPhone`) | `orderToContactSource` |
| Contact source (visitor) | `Conversation` (`visitorName`, `visitorEmail`) | `conversationToContactSource` |
| Contact source (learner) | `CourseEnrollment` (`visitorName`, `visitorEmail`) | `courseEnrollmentToContactSource` |
| Contact source (owner) | `Profile` + `User` (`displayName`, owner email) | `profileOwnerToContactSource` |
| Activity | `Booking`, `Order`, `Conversation`, `CourseEnrollment` timestamps/status | `*ToActivityEvents` |
| Notification | `Notification` | `projectNotification(s)` |

`Member` is referenced in the design (it is the closest thing to an existing durable
identity — `Member.email` is unique) but no `Member`-specific adapter ships this wave
because no owned-path caller needs it yet; `ContactSourceKind` already reserves a `MEMBER`
value for when one does, so adding it later is additive.

## 7. Schema proposal (additive-only, for the later single-owner schema wave)

Nothing below is implemented this wave. This is a proposal for whichever wave owns
`prisma/schema.prisma` next; it is written so that adopting it requires no rename, no
drop, and no backfill of anything that exists today — the read-only adapters in
`adapters.ts` are exactly the compatibility layer that lets old readers keep working
unchanged while new tables are introduced beside them.

```prisma
// NEW tables only. All relations to existing models are additive optional
// back-references (existing models are not modified — Prisma lets a relation
// be declared from the new side only, with no FK column added to the old table,
// when the new table holds the foreign key).

model Contact {
  id           String   @id @default(cuid())
  profileId    String?
  displayName  String?
  email        String?
  phone        String?
  confidence   String   // "CONFIRMED" | "PROBABLE" | "AMBIGUOUS" | "ANONYMOUS"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sourceLinks  ContactSourceLink[]
  activities   ActivityEventRow[]

  @@index([profileId, email])
  @@index([profileId, phone])
}

// One row per existing source record folded into a Contact — this table is the
// durable form of today's in-memory ContactSourceRecord[], and is what would let
// resolution be incremental instead of a full re-scan.
model ContactSourceLink {
  id          String   @id @default(cuid())
  contactId   String
  contact     Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  sourceKind  String   // ContactSourceKind
  sourceId    String   // existing row's id (Booking.id, Order.id, ...) — NOT a FK,
                        // deliberately: this table must not force a schema coupling
                        // back onto Booking/Order/Conversation/CourseEnrollment.
  profileId   String?
  observedAt  DateTime

  @@unique([sourceKind, sourceId])
  @@index([contactId])
}

// Durable form of today's in-memory ActivityEvent — append-only by convention
// (no update/delete path is proposed), one row per projected source event.
model ActivityEventRow {
  id          String   @id // = "${sourceKind}:${sourceId}:${suffix}" (matches today's ActivityEvent.id)
  contactId   String
  contact     Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  profileId   String?
  type        String   // ActivityEventType
  sourceKind  String
  sourceId    String
  occurredAt  DateTime?
  summary     String
  metadata    String?  // JSON

  @@index([contactId, occurredAt])
}

// Durable form of today's in-memory TaskRecord.
model TaskJob {
  id              String    @id @default(cuid())
  idempotencyKey  String?   @unique
  payload         String    // JSON
  state           String    // TaskState
  attempts        Int       @default(0)
  maxAttempts     Int
  nextAttemptAt   DateTime
  leaseExpiresAt  DateTime?
  leaseToken      String?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([state, nextAttemptAt])
}
```

**Compatibility path:** every read that exists today against `Booking`, `Order`,
`Conversation`, `CourseEnrollment`, or `Notification` keeps working unchanged — those
tables are untouched. The adapters in `src/lib/foundation/adapters.ts` are exactly the
functions that would populate `ContactSourceLink`/`ActivityEventRow` in a backfill job
*if one is later commissioned*; this wave does not run one. `TaskJob` would back a real
`TaskQueue` implementation with the same interface `InMemoryTaskQueue` already
implements, so callers written against the contract in `task-queue.ts` would not need to
change when the backing store changes.

## 8. Design decisions

- Contracts are decoupled from `@prisma/client` generated types (see narrow `*Row`
  interfaces in `adapters.ts`) so they compile and are testable without a live Prisma
  client or a database — required by the in-memory-only harness constraint this wave.
- Identity resolution prefers email over phone over anonymity, and never merges two
  anonymous (no email, no phone) guests on name alone — matching names are a weak signal
  that would produce false merges across unrelated people.
- Ambiguous merges (same email, different name) still merge — email is treated as a
  stronger signal than name — but are flagged via `ambiguityReason` for human review rather
  than silently picked one way.
- Missing-timestamp activity events sort last, not first — treating "unknown when" as
  "assume oldest" would misorder them ahead of events we know came first.
- Lease expiry (crash/timeout) is modeled as a distinct transition from an explicit
  `fail()`, so retry-count accounting doesn't conflate "the worker told us it failed" with
  "the worker disappeared."
- `sourceId` in the proposed `ContactSourceLink`/`ActivityEventRow` tables is intentionally
  not a foreign key into `Booking`/`Order`/etc. — adding one would require touching those
  models' schemas, which this wave and the identity-resolution contract are designed to
  avoid entirely.

## 9. Verification

```
npx prisma validate                                                   # exit 0
npx tsc --noEmit --pretty false                                       # exit 0
npx eslint src/lib/foundation scripts/one-off/check-foundation-contracts.ts   # exit 0
npm run build                                                          # exit 0
npx ts-node -r tsconfig-paths/register scripts/one-off/check-foundation-contracts.ts  # exit 0
```
`npx prisma generate` was skipped this run per the wave's root-ordering instruction (shared
`node_modules` junction; six worktrees would collide on the query-engine binary). No
schema changed, so the generated client is unaffected.
