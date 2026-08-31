/**
 * Deterministic in-memory harness for the foundation contracts.
 * No DB, no network. Exits 0 on pass, prints the failing assertion and
 * exits non-zero on failure.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/one-off/check-foundation-contracts.ts
 * (with TS_NODE_PROJECT=scripts/tsconfig.checks.json, per the wave-1 gate command)
 */

import {
    ActivityTimeline,
    InMemoryTaskQueue,
    bookingToActivityEvents,
    bookingToContactSource,
    computeBackoffMs,
    conversationToActivityEvent,
    conversationToContactSource,
    orderToActivityEvents,
    orderToContactSource,
    projectNotifications,
    resolveContacts,
    type ActivityEvent,
    type BookingRow,
    type ConversationRow,
    type OrderRow,
} from "../../src/lib/foundation"

const report: Record<string, unknown> = {}
let failures = 0

/**
 * ASSERTION EVIDENCE. Counted INSIDE the recorder, so the number the gate reads is produced by the
 * same call that decides the verdict. Never a literal: a hard-coded total would keep printing a
 * healthy count after assertions were deleted — the exact failure the evidence contract exists to
 * catch. Every call increments `assertionsRun`; only a passing condition increments `assertionsPassed`,
 * so a failing assertion LOWERS the passed count and, through `failures`, sets a non-zero exit. Only
 * the real per-condition `assert()` is counted; `section()` is a try/catch grouping, not an assertion.
 */
let assertionsRun = 0
let assertionsPassed = 0

function assert(condition: unknown, message: string): void {
    assertionsRun += 1
    if (condition) {
        assertionsPassed += 1
        return
    }
    failures += 1
    console.error(`FAIL: ${message}`)
}

function section(name: string, fn: () => void): void {
    try {
        fn()
        report[name] = "ok"
    } catch (error) {
        failures += 1
        report[name] = `threw: ${error instanceof Error ? error.message : String(error)}`
        console.error(`FAIL (threw): ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
}

// ---------------------------------------------------------------------------
// 1. Identity resolution — including ambiguous cases
// ---------------------------------------------------------------------------

section("identity_resolution", () => {
    const booking: BookingRow = {
        id: "bk_1",
        profileId: "profile_a",
        visitorName: "Priya Shah",
        visitorEmail: "priya@example.com",
        status: "CONFIRMED",
        createdAt: new Date("2026-01-01T10:00:00Z"),
        updatedAt: new Date("2026-01-01T10:00:00Z"),
    }
    const order: OrderRow = {
        id: "ord_1",
        profileId: "profile_a",
        guestName: "Priya Shah",
        guestEmail: "PRIYA@example.com", // same email, different case
        guestPhone: null,
        status: "SERVED",
        placedAt: new Date("2026-01-02T10:00:00Z"),
        servedAt: new Date("2026-01-02T10:30:00Z"),
        cancelledAt: null,
    }
    const bookingSource = bookingToContactSource(booking)
    const orderSource = orderToContactSource(order)
    assert(orderSource !== null, "orderToContactSource should not drop a row with an email")
    const [resolved] = resolveContacts([bookingSource, orderSource as NonNullable<typeof orderSource>])
    assert(resolved.confidence === "CONFIRMED", `same-email same-name should be CONFIRMED, got ${resolved.confidence}`)
    assert(resolved.sources.length === 2, "same-email records should merge into one contact")
    assert(resolved.email === "priya@example.com", "resolved email should be normalized lowercase")

    // Ambiguous case: same email, different name.
    const conflictingOrder: OrderRow = {
        ...order,
        id: "ord_2",
        guestName: "P. Shah-Malhotra",
        placedAt: new Date("2026-01-03T10:00:00Z"),
    }
    const conflictingSource = orderToContactSource(conflictingOrder)
    const [ambiguous] = resolveContacts([bookingSource, conflictingSource as NonNullable<typeof conflictingSource>])
    assert(ambiguous.confidence === "AMBIGUOUS", `same-email different-name should be AMBIGUOUS, got ${ambiguous.confidence}`)
    assert(ambiguous.ambiguityReason !== null, "AMBIGUOUS contact must carry a reason")
    // Still merges — email is the stronger signal.
    assert(ambiguous.sources.length === 2, "ambiguous same-email records should still merge, not split")

    // Missing email, has phone: merges by phone.
    const phoneOnlyA = {
        sourceId: "s1",
        sourceKind: "ORDER_GUEST" as const,
        profileId: "profile_b",
        name: "Guest One",
        email: null,
        phone: "+1 (555) 010-0001",
        observedAt: new Date("2026-01-01T00:00:00Z"),
    }
    const phoneOnlyB = {
        sourceId: "s2",
        sourceKind: "ORDER_GUEST" as const,
        profileId: "profile_b",
        name: "Guest One",
        email: null,
        phone: "15550100001",
        observedAt: new Date("2026-01-02T00:00:00Z"),
    }
    const [byPhone] = resolveContacts([phoneOnlyA, phoneOnlyB])
    assert(byPhone.sources.length === 2, "phone records with matching digits after normalization should merge")
    assert(byPhone.confidence === "CONFIRMED", "matching phone + matching name should be CONFIRMED")

    // Anonymous guest: no email, no phone — must NOT merge with another anonymous guest even with the same name.
    const anonA = {
        sourceId: "a1",
        sourceKind: "CONVERSATION_VISITOR" as const,
        profileId: "profile_c",
        name: "Guest",
        email: null,
        phone: null,
        observedAt: new Date("2026-01-01T00:00:00Z"),
    }
    const anonB = {
        sourceId: "a2",
        sourceKind: "CONVERSATION_VISITOR" as const,
        profileId: "profile_c",
        name: "Guest",
        email: null,
        phone: null,
        observedAt: new Date("2026-01-02T00:00:00Z"),
    }
    const anonResolved = resolveContacts([anonA, anonB])
    assert(anonResolved.length === 2, "two anonymous guests with no email/phone must resolve to two separate contacts")
    assert(
        anonResolved.length > 0 && anonResolved.every((c) => c.confidence === "ANONYMOUS"),
        "guests with neither email nor phone must be ANONYMOUS",
    )

    // Determinism: re-running resolution on the same (shuffled) input yields the same contactId.
    const shuffled = [conflictingSource as NonNullable<typeof conflictingSource>, bookingSource]
    const [ambiguousAgain] = resolveContacts(shuffled)
    assert(ambiguousAgain.contactId === ambiguous.contactId, "resolution must be deterministic regardless of input order")
})

// ---------------------------------------------------------------------------
// 2. Timeline ordering — including ties and missing timestamps
// ---------------------------------------------------------------------------

section("timeline_ordering", () => {
    const timeline = new ActivityTimeline()
    const t0 = new Date("2026-01-01T00:00:00Z")
    const t1 = new Date("2026-01-02T00:00:00Z")

    const events: ActivityEvent[] = [
        { id: "z:2", contactId: "c1", profileId: "p1", type: "ORDER_PLACED", sourceKind: "ORDER_GUEST", sourceId: "2", occurredAt: t1, summary: "", metadata: {} },
        { id: "a:1", contactId: "c1", profileId: "p1", type: "BOOKING_CREATED", sourceKind: "BOOKING_GUEST", sourceId: "1", occurredAt: t0, summary: "", metadata: {} },
        // Tie on occurredAt with the previous one: id "a:1" < "b:1" lexicographically.
        { id: "b:1", contactId: "c1", profileId: "p1", type: "BOOKING_CREATED", sourceKind: "BOOKING_GUEST", sourceId: "1b", occurredAt: t0, summary: "", metadata: {} },
        // Missing timestamp: must sort after everything with a real timestamp.
        { id: "m:1", contactId: "c1", profileId: "p1", type: "CONVERSATION_MESSAGE", sourceKind: "CONVERSATION_VISITOR", sourceId: "m1", occurredAt: null, summary: "", metadata: {} },
        // Second missing-timestamp event, tie broken by id.
        { id: "m:0", contactId: "c1", profileId: "p1", type: "CONVERSATION_MESSAGE", sourceKind: "CONVERSATION_VISITOR", sourceId: "m0", occurredAt: null, summary: "", metadata: {} },
    ]
    timeline.append(events)
    // Idempotent append: re-appending the same ids must not duplicate.
    timeline.append(events)
    assert(timeline.size() === 5, `append should be idempotent by id, got size ${timeline.size()}`)

    const ordered = timeline.forContact("c1")
    const orderedIds = ordered.map((e) => e.id)
    assert(
        JSON.stringify(orderedIds) === JSON.stringify(["a:1", "b:1", "z:2", "m:0", "m:1"]),
        `unexpected order: ${orderedIds.join(", ")}`,
    )
})

// ---------------------------------------------------------------------------
// 3. Task queue — retry/backoff/dead-letter, idempotent re-enqueue, illegal transitions
// ---------------------------------------------------------------------------

section("task_backoff_math", () => {
    assert(computeBackoffMs(1) === 1_000, "attempt 1 backoff should equal base delay")
    assert(computeBackoffMs(2) === 2_000, "attempt 2 backoff should double")
    assert(computeBackoffMs(3) === 4_000, "attempt 3 backoff should quadruple")
    assert(computeBackoffMs(10) === 60_000, "backoff should cap at maxDelayMs")
})

section("task_retry_and_dead_letter", () => {
    const queue = new InMemoryTaskQueue<{ n: number }>()
    const task = queue.enqueue({ payload: { n: 1 }, maxAttempts: 2 })
    assert(task.state === "PENDING", "freshly enqueued task should be PENDING")

    const [leased1] = queue.lease(10)
    assert(leased1.state === "LEASED" && leased1.attempts === 1, "lease should move to LEASED and count an attempt")

    const afterFail1 = queue.fail(leased1.id, leased1.leaseToken as string, "boom-1")
    assert(afterFail1.state === "PENDING", "fail with retries remaining should return to PENDING")
    assert(afterFail1.nextAttemptAt.getTime() > afterFail1.updatedAt.getTime() - 1, "backoff should push nextAttemptAt into the future")

    // Not due yet — leasing "now" (equal to updatedAt) should yield nothing.
    const notDue = queue.lease(10, 30_000, afterFail1.updatedAt)
    assert(notDue.length === 0, "task should not be leaseable before its backoff nextAttemptAt")

    const [leased2] = queue.lease(10, 30_000, afterFail1.nextAttemptAt)
    assert(leased2.attempts === 2, "second lease should be attempt 2")
    const afterFail2 = queue.fail(leased2.id, leased2.leaseToken as string, "boom-2")
    assert(afterFail2.state === "DEAD_LETTERED", `attempts exhausted (maxAttempts=2) should dead-letter, got ${afterFail2.state}`)
    assert(afterFail2.lastError === "boom-2", "dead-lettered task should retain the last error")

    // Illegal transition: completing a DEAD_LETTERED task must throw.
    let threw = false
    try {
        queue.complete(afterFail2.id, "irrelevant-token")
    } catch {
        threw = true
    }
    assert(threw, "completing a DEAD_LETTERED task must be refused")
})

section("task_idempotent_reenqueue", () => {
    const queue = new InMemoryTaskQueue<{ orderId: string }>()
    const first = queue.enqueue({ payload: { orderId: "o1" }, idempotencyKey: "notify:o1" })
    const second = queue.enqueue({ payload: { orderId: "o1" }, idempotencyKey: "notify:o1" })
    assert(first.id === second.id, "re-enqueue with the same idempotencyKey while in-flight must be a no-op returning the same task")

    const [leased] = queue.lease(10)
    const completed = queue.complete(leased.id, leased.leaseToken as string)
    assert(completed.state === "SUCCEEDED", "task should complete to SUCCEEDED")

    // After the original reached a terminal state, the same key IS allowed to create a new task.
    const third = queue.enqueue({ payload: { orderId: "o1" }, idempotencyKey: "notify:o1" })
    assert(third.id !== first.id, "re-enqueue with the same idempotencyKey after completion must be allowed to create a new task")
})

section("task_lease_expiry_is_not_a_failure", () => {
    const queue = new InMemoryTaskQueue<{ n: number }>()
    const start = new Date()
    const task = queue.enqueue({ payload: { n: 1 } })
    const [leased] = queue.lease(10, 1_000, start)
    const reaped = queue.reapExpiredLeases(new Date(start.getTime() + 2_000))
    assert(reaped.length === 1 && reaped[0].id === leased.id, "expired lease should be reaped")
    const current = queue.get(task.id)
    assert(current?.state === "PENDING", "reaped task should return to PENDING")
    assert(current?.attempts === 1, "lease expiry must not add an extra attempt beyond the original lease() count")
    assert(current?.lastError === null, "lease expiry must not record a failure error")
})

// ---------------------------------------------------------------------------
// 4. Adapters — sanity that projections are read-only and shaped correctly
// ---------------------------------------------------------------------------

section("adapters_readonly_shapes", () => {
    const booking: BookingRow = {
        id: "bk_9",
        profileId: "profile_z",
        visitorName: "Sam",
        visitorEmail: "sam@example.com",
        status: "PENDING_PAYMENT",
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-01T00:00:00Z"),
    }
    const frozenBooking = Object.freeze({ ...booking })
    const source = bookingToContactSource(frozenBooking)
    assert(source.sourceKind === "BOOKING_GUEST", "booking adapter should tag BOOKING_GUEST")
    const events = bookingToActivityEvents(frozenBooking, "contact_x")
    assert(events.length === 1, "a booking with no status change (createdAt === updatedAt) should emit exactly one event")
    assert(events[0].occurredAt?.getTime() === booking.createdAt.getTime(), "created event should use createdAt")

    const convo: ConversationRow = {
        id: "cv_1",
        profileId: "profile_z",
        visitorName: "Sam",
        visitorEmail: "sam@example.com",
        startedAt: new Date("2026-02-01T00:00:00Z"),
        lastMessageAt: new Date("2026-02-01T01:00:00Z"),
    }
    const convoSource = conversationToContactSource(convo)
    assert(convoSource !== null && convoSource.email === "sam@example.com", "conversation adapter should carry visitor email")
    const convoEvent = conversationToActivityEvent(convo, "contact_x")
    assert(convoEvent.type === "CONVERSATION_MESSAGE", "conversation activity event should be CONVERSATION_MESSAGE")

    const orderNoContact: OrderRow = {
        id: "ord_9",
        profileId: "profile_z",
        guestName: "Anon",
        guestEmail: null,
        guestPhone: null,
        status: "PLACED",
        placedAt: new Date(),
        servedAt: null,
        cancelledAt: null,
    }
    const noSource = orderToContactSource(orderNoContact)
    assert(noSource === null, "an order guest row with no email and no phone must not fabricate a contact source")
    const orderEvents = orderToActivityEvents(orderNoContact, "contact_anon")
    assert(orderEvents.length === 1, "an order with no terminal timestamp should emit only the placed event")
})

section("notifications_adapter_projection", () => {
    const rows = [
        { id: "n1", userId: "u1", type: "INFO", title: "Hi", body: null, href: null, readAt: null, createdAt: new Date() },
        { id: "n2", userId: "u1", type: "INFO", title: "Read", body: "b", href: "/x", readAt: new Date(), createdAt: new Date() },
    ]
    const projected = projectNotifications(rows)
    assert(projected[0].state === "UNREAD", "null readAt should project to UNREAD")
    assert(projected[1].state === "READ", "non-null readAt should project to READ")
})

// ---------------------------------------------------------------------------

report.assertionsRun = assertionsRun
report.assertionsPassed = assertionsPassed
report.failures = failures
console.log(JSON.stringify(report, null, 2))

// Machine-readable assertion evidence for scripts/gates/run-gates.js, printed BEFORE the exit
// branches so it appears on both the pass and fail paths. The identity-bearing GATE-EVIDENCE line
// must be the WHOLE line and name this EXACT file, or the driver reports EVIDENCE_IDENTITY_MISMATCH.
// Both numbers come from the counters incremented inside assert(); neutering assert() collapses them.
console.log(`GATE-EVIDENCE harness=check-foundation-contracts.ts assertions=${assertionsPassed}`)
console.log(`${assertionsPassed}/${assertionsRun} assertions passed`)

if (failures > 0) {
    console.error(`${failures} check(s) failed.`)
    process.exit(1)
}
console.log("All foundation contract checks passed.")
process.exit(0)
