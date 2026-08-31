/**
 * Wave B / B3 appointment lifecycle, waitlist, deposit and reminder harness.
 *
 * Executes the REAL AppointmentServices against the authorized disposable rehearsal
 * database with a controlled identity and COUNTING provider stubs.
 *
 * The load-bearing claim here is negative: no Stripe, email, SMS or WhatsApp request is
 * made. That is proven by invocation counters on the injected adapters, asserted to be
 * zero on every refusal path. "We didn't call the provider" is measured, not promised.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-appointment-lifecycle.ts
 */
import { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { PersistedAppointments } from "../../src/lib/appointments/engine"
import {
    DEPOSIT_STATES,
    WAITLIST_STATUSES,
    canTransitionDeposit,
    canTransitionWaitlist,
    type WaitlistStatus,
} from "../../src/lib/appointments/lifecycle"
import type {
    AppointmentProviders,
    DepositAuthorizationResult,
    NotificationProvider,
    PaymentProvider,
    ReminderDispatchResult,
} from "../../src/lib/appointments/providers"
import { AppointmentServices } from "../../src/lib/appointments/services"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wb3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

/** Counting stubs. They perform NO I/O; they only record that they were reached. */
class CountingPayments implements PaymentProvider {
    authorizeCalls = 0
    captureCalls = 0
    refundCalls = 0
    outcome: DepositAuthorizationResult["outcome"] = "unavailable"

    private result(): DepositAuthorizationResult {
        return Object.freeze({
            outcome: this.outcome,
            providerRef: this.outcome === "authorized" ? `stub_${RUN}` : null,
            failureCode: this.outcome === "authorized" ? null : "STUB",
        })
    }
    async authorizeDeposit() {
        this.authorizeCalls += 1
        return this.result()
    }
    async captureDeposit() {
        this.captureCalls += 1
        return this.result()
    }
    async refundDeposit() {
        this.refundCalls += 1
        return this.result()
    }
    get total() {
        return this.authorizeCalls + this.captureCalls + this.refundCalls
    }
}

class CountingNotifications implements NotificationProvider {
    calls = 0
    outcome: ReminderDispatchResult["outcome"] = "unavailable"
    async dispatch() {
        this.calls += 1
        return Object.freeze({ outcome: this.outcome, failureCode: this.outcome === "sent" ? null : "STUB" })
    }
}

type Envelope = { ok: false; code: string; message: string } | { ok: true }
async function attempt(fn: () => Promise<unknown>): Promise<Envelope> {
    try {
        await fn()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) return { ok: false, code: e.code, message: e.message }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }
const at = (iso: string) => new Date(iso)

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const tenancy = new PersistedTenancy(prisma, identity)
    const engine = new PersistedAppointments(prisma, tenancy)
    const payments = new CountingPayments()
    const notifications = new CountingNotifications()
    const providers: AppointmentProviders = Object.freeze({ payments, notifications })
    const services = new AppointmentServices(prisma, tenancy, engine, providers)

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        svcA: `${RUN}_sa`, svcB: `${RUN}_sb`,
        resA: `${RUN}_ra`, resB: `${RUN}_rb`,
    }

    let baseBookings = 0
    let baseWaitlist = 0
    let bookingId = ""

    try {
        baseBookings = await prisma.booking.count()
        baseWaitlist = await prisma.appointmentWaitlistEntry.count()

        for (const [u, p, w, s, r] of [
            [ids.userA, ids.profileA, ids.wsA, ids.svcA, ids.resA],
            [ids.userB, ids.profileB, ids.wsB, ids.svcB, ids.resB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.serviceOffering.create({ data: { id: s, profileId: p, name: "Session" } })
            await prisma.appointmentResource.create({ data: { id: r, profileId: p, name: "Coach", capacity: 1 } })
            for (let d = 0; d < 7; d += 1) {
                await prisma.availabilitySchedule.create({
                    data: { profileId: p, dayOfWeek: d, startTime: "08:00", endTime: "20:00", isEnabled: true },
                })
            }
        }

        identity.current = `clerk_${ids.userA}`
        const booked = await engine.book(
            ids.wsA,
            {
                serviceOfferingId: ids.svcA,
                resourceId: ids.resA,
                startTime: at("2034-01-09T10:00:00Z"),
                endTime: at("2034-01-09T11:00:00Z"),
                visitorName: "Guest",
                visitorEmail: "g@example.test",
            },
            actor,
        )
        bookingId = booked.appointment.id

        // ---- 1. lifecycle vocabulary is exhaustively guarded ----------------
        // Pure-module checks: no state in the world, so every pair can be enumerated.
        let depositIllegal = 0
        let depositLegal = 0
        for (const from of DEPOSIT_STATES) {
            for (const to of DEPOSIT_STATES) {
                if (canTransitionDeposit(from, to)) depositLegal += 1
                else depositIllegal += 1
            }
        }
        check("deposit transition table is total over all state pairs", depositLegal + depositIllegal === DEPOSIT_STATES.length ** 2, `legal=${depositLegal} illegal=${depositIllegal}`)

        // The two terminal-state rules below are of the shape that passes over an empty collection:
        // `[].every(...)` is true, so "terminal states allow nothing" is green when the vocabulary is
        // empty, when the terminal subset is empty, and when the inner state list is empty - having
        // examined no pair at all. The expected COUNTS are therefore pinned as literals inside each
        // condition, which buys two separate things:
        //   1. the rule can fail. An empty DEPOSIT_STATES or WAITLIST_STATUSES now turns it red
        //      instead of satisfying it vacuously.
        //   2. the terminal sets are written out BY HAND rather than derived from the transition
        //      table, precisely so this asserts an expectation instead of comparing the table with
        //      itself. The cost of that choice is that a state added to the table with no outgoing
        //      edge would be a NEW terminal state the hand-written list silently stops covering.
        //      Pinning the vocabulary size makes that addition fail HERE, where the omission is.
        // MEASURED at src/lib/appointments/lifecycle.ts: 7 deposit states, 2 of them terminal;
        // 5 waitlist statuses, 3 of them terminal.
        const terminalDeposit = DEPOSIT_STATES.filter((s) => ["REFUNDED", "FORFEITED"].includes(s))
        const terminalWaitlist: readonly WaitlistStatus[] = ["CONVERTED", "EXPIRED", "CANCELLED"]
        check(
            "terminal deposit states allow nothing",
            DEPOSIT_STATES.length === 7
                && terminalDeposit.length === 2
                && terminalDeposit.every((s) => DEPOSIT_STATES.every((t) => !canTransitionDeposit(s, t))),
            `vocabulary=${DEPOSIT_STATES.length} terminal=${terminalDeposit.join(",")}`,
        )
        check(
            "waitlist terminal states allow nothing",
            WAITLIST_STATUSES.length === 5
                && terminalWaitlist.length === 3
                && terminalWaitlist.every((s) => WAITLIST_STATUSES.every((t) => !canTransitionWaitlist(s, t))),
            `vocabulary=${WAITLIST_STATUSES.length} terminal=${terminalWaitlist.join(",")}`,
        )

        // ---- 2. anonymous is refused everywhere, zero provider calls -------
        identity.current = null
        const anonWaitlist = await attempt(() =>
            services.joinWaitlist(ids.wsA, { serviceOfferingId: ids.svcA, requestedStart: at("2034-01-10T10:00:00Z"), requestedEnd: at("2034-01-10T11:00:00Z"), guestName: "A" }, actor),
        )
        const anonDeposit = await attempt(() => services.requireDeposit(ids.wsA, { bookingId, amountCents: 5000 }, actor))
        const anonReminder = await attempt(() => services.scheduleReminder(ids.wsA, { bookingId, channel: "EMAIL", sendAt: at("2034-01-08T10:00:00Z") }, actor))
        check("anonymous waitlist join refused UNAUTHORIZED", !anonWaitlist.ok && anonWaitlist.code === "UNAUTHORIZED", !anonWaitlist.ok ? anonWaitlist.code : "ACCEPTED")
        check("anonymous deposit refused UNAUTHORIZED", !anonDeposit.ok && anonDeposit.code === "UNAUTHORIZED", !anonDeposit.ok ? anonDeposit.code : "ACCEPTED")
        check("anonymous reminder refused UNAUTHORIZED", !anonReminder.ok && anonReminder.code === "UNAUTHORIZED", !anonReminder.ok ? anonReminder.code : "ACCEPTED")
        check("no payment provider call on anonymous refusal", payments.total === 0, `calls=${payments.total}`)
        check("no notification provider call on anonymous refusal", notifications.calls === 0, `calls=${notifications.calls}`)

        // ---- 3. wrong tenant refused, indistinguishable from missing ------
        identity.current = `clerk_${ids.userB}`
        const foreignDeposit = await attempt(() => services.requireDeposit(ids.wsB, { bookingId, amountCents: 5000 }, actor))
        const missingDeposit = await attempt(() => services.requireDeposit(ids.wsB, { bookingId: `${RUN}_nope`, amountCents: 5000 }, actor))
        check("wrong-tenant deposit refused FORBIDDEN", !foreignDeposit.ok && foreignDeposit.code === "FORBIDDEN", !foreignDeposit.ok ? foreignDeposit.code : "LEAKED")
        check(
            "foreign and nonexistent deposit responses are byte-identical",
            JSON.stringify(foreignDeposit) === JSON.stringify(missingDeposit),
            `${JSON.stringify(foreignDeposit)} vs ${JSON.stringify(missingDeposit)}`,
        )
        const foreignReminder = await attempt(() => services.scheduleReminder(ids.wsB, { bookingId, channel: "SMS", sendAt: at("2034-01-08T10:00:00Z") }, actor))
        check("wrong-tenant reminder refused FORBIDDEN", !foreignReminder.ok && foreignReminder.code === "FORBIDDEN", !foreignReminder.ok ? foreignReminder.code : "LEAKED")
        check("still zero provider calls after tenant refusals", payments.total === 0 && notifications.calls === 0, `pay=${payments.total} notify=${notifications.calls}`)

        const depositRows = await prisma.appointmentDeposit.count()
        const reminderRows = await prisma.appointmentReminder.count()
        check("refusals created no deposit rows", depositRows === 0, `rows=${depositRows}`)
        check("refusals created no reminder rows", reminderRows === 0, `rows=${reminderRows}`)

        // ---- 4. deposits: require, replay, and NO invented authorization ---
        identity.current = `clerk_${ids.userA}`
        const dep = await services.requireDeposit(ids.wsA, { bookingId, amountCents: 5000 }, actor)
        check("deposit requirement recorded as REQUIRED", dep.deposit.state === "REQUIRED", `state=${dep.deposit.state}`)
        check("requireDeposit made no provider call", payments.total === 0, `calls=${payments.total}`)
        const depReplay = await services.requireDeposit(ids.wsA, { bookingId, amountCents: 9999 }, actor)
        check("deposit replay is flagged and does not change the amount", depReplay.replayed === true && depReplay.deposit.amountCents === 5000, `replayed=${depReplay.replayed} amount=${depReplay.deposit.amountCents}`)

        // With the provider unavailable, authorization must NOT claim success.
        payments.outcome = "unavailable"
        const unavailable = await attempt(() => services.authorizeDeposit(ids.wsA, bookingId, actor))
        const stillRequired = await prisma.appointmentDeposit.findUnique({ where: { bookingId } })
        check(
            "an unavailable payment provider yields DEPENDENCY_UNAVAILABLE",
            !unavailable.ok && unavailable.code === "DEPENDENCY_UNAVAILABLE",
            !unavailable.ok ? unavailable.code : "ACCEPTED",
        )
        // This is the single inverted assertion.
        check(
            "an unavailable provider does NOT record an authorization",
            INVERT ? stillRequired?.state !== "REQUIRED" : stillRequired?.state === "REQUIRED",
            `state=${stillRequired?.state}`,
        )
        check("the provider WAS reached exactly once for the authorize attempt", payments.authorizeCalls === 1, `authorizeCalls=${payments.authorizeCalls}`)

        // Now let the stub authorize, proving the accepted path also works.
        payments.outcome = "authorized"
        const authorized = await services.authorizeDeposit(ids.wsA, bookingId, actor)
        check("stubbed authorization moves the deposit to AUTHORIZED", authorized.state === "AUTHORIZED", `state=${authorized.state}`)
        check("authorization recorded a provider reference", (authorized.providerRef ?? "").startsWith("stub_"), `ref=${authorized.providerRef}`)

        // Illegal deposit transition is refused with no state change.
        const beforeState = (await prisma.appointmentDeposit.findUnique({ where: { bookingId } }))?.state
        const illegalDeposit = await attempt(() => services.transitionDeposit(ids.wsA, bookingId, "REQUIRED", actor))
        const afterState = (await prisma.appointmentDeposit.findUnique({ where: { bookingId } }))?.state
        check("illegal deposit transition refused CONFLICT", !illegalDeposit.ok && illegalDeposit.code === "CONFLICT", !illegalDeposit.ok ? illegalDeposit.message : "ACCEPTED")
        check("refused deposit transition left state unchanged", beforeState === afterState, `${beforeState} -> ${afterState}`)

        const refunded = await services.transitionDeposit(ids.wsA, bookingId, "REFUNDED", actor)
        check("AUTHORIZED -> REFUNDED is allowed", refunded.state === "REFUNDED", `state=${refunded.state}`)
        check("REFUNDED is terminal", refunded.allowedTransitions.length === 0, `allowed=${refunded.allowedTransitions.join(",")}`)

        // ---- 5. reminders: schedule, replay, suppression, no send ---------
        const rem = await services.scheduleReminder(ids.wsA, { bookingId, channel: "EMAIL", sendAt: at("2034-01-08T10:00:00Z") }, actor)
        check("reminder scheduled in SCHEDULED state", rem.reminder.state === "SCHEDULED", `state=${rem.reminder.state}`)
        const remReplay = await services.scheduleReminder(ids.wsA, { bookingId, channel: "EMAIL", sendAt: at("2034-01-08T10:00:00Z") }, actor)
        check("reminder replay returns the same row and queues no duplicate", remReplay.replayed === true && remReplay.reminder.id === rem.reminder.id, `replayed=${remReplay.replayed}`)
        const remCount = await prisma.appointmentReminder.count({ where: { bookingId } })
        check("exactly one reminder row exists after replay", remCount === 1, `rows=${remCount}`)

        // Unavailable notification provider must leave the reminder SCHEDULED.
        notifications.outcome = "unavailable"
        const dispatch1 = await services.dispatchDueReminders(ids.wsA, at("2034-01-08T12:00:00Z"), actor)
        const afterDispatch = await prisma.appointmentReminder.findUnique({ where: { id: rem.reminder.id } })
        check("an unavailable notifier leaves the reminder SCHEDULED", afterDispatch?.state === "SCHEDULED", `state=${afterDispatch?.state}`)
        check("no reminder is falsely marked SENT", dispatch1.sent === 0, `sent=${dispatch1.sent}`)
        check("the notifier WAS reached once for the due reminder", notifications.calls === 1, `calls=${notifications.calls}`)

        // A reminder on a cancelled appointment is SUPPRESSED without any send.
        const cancelBooking = await engine.book(
            ids.wsA,
            { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2034-01-11T10:00:00Z"), endTime: at("2034-01-11T11:00:00Z"), visitorName: "C", visitorEmail: "c@example.test" },
            actor,
        )
        await services.scheduleReminder(ids.wsA, { bookingId: cancelBooking.appointment.id, channel: "SMS", sendAt: at("2034-01-10T10:00:00Z") }, actor)
        await engine.transition(ids.wsA, cancelBooking.appointment.id, "CANCELLED", actor, "guest cancelled")
        const notifyBefore = notifications.calls
        const dispatch2 = await services.dispatchDueReminders(ids.wsA, at("2034-01-10T12:00:00Z"), actor)
        check("a reminder for a cancelled appointment is SUPPRESSED", dispatch2.suppressed >= 1, `suppressed=${dispatch2.suppressed}`)
        check("suppression required no notifier call for that reminder", notifications.calls === notifyBefore + (dispatch2.examined - dispatch2.suppressed), `calls=${notifications.calls} before=${notifyBefore} examined=${dispatch2.examined} suppressed=${dispatch2.suppressed}`)

        // ---- 6. waitlist: FIFO order, promotion, duplicate promotion ------
        const w1 = await services.joinWaitlist(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, requestedStart: at("2034-02-06T10:00:00Z"), requestedEnd: at("2034-02-06T11:00:00Z"), guestName: "First", idempotencyKey: "w1" }, actor)
        const w2 = await services.joinWaitlist(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, requestedStart: at("2034-02-06T10:00:00Z"), requestedEnd: at("2034-02-06T11:00:00Z"), guestName: "Second", idempotencyKey: "w2" }, actor)
        const waiting = await services.listWaitlist(ids.wsA, ids.svcA)
        check("waitlist is returned in FIFO order", waiting.length === 2 && waiting[0].id === w1.entry.id && waiting[1].id === w2.entry.id, `order=${waiting.map((w) => w.guestName).join(",")}`)

        const wReplay = await services.joinWaitlist(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, requestedStart: at("2034-02-06T10:00:00Z"), requestedEnd: at("2034-02-06T11:00:00Z"), guestName: "Other", idempotencyKey: "w1" }, actor)
        check("waitlist replay returns the original entry", wReplay.replayed === true && wReplay.entry.id === w1.entry.id, `replayed=${wReplay.replayed}`)

        const promoted = await services.promoteWaitlistEntry(ids.wsA, w1.entry.id, actor)
        check("promotion converts the entry", promoted.entry.status === "CONVERTED", `status=${promoted.entry.status}`)
        check("promotion produced a real booking", promoted.bookingId.length > 0 && promoted.entry.offeredBookingId === promoted.bookingId, `booking=${promoted.bookingId}`)

        const doublePromote = await attempt(() => services.promoteWaitlistEntry(ids.wsA, w1.entry.id, actor))
        check("promoting an already-converted entry is refused", !doublePromote.ok && doublePromote.code === "CONFLICT", !doublePromote.ok ? doublePromote.message : "ACCEPTED")

        // The second entry wants the same slot the first just took, so promotion must be
        // refused by the engine's conflict guard AND the entry must return to WAITING.
        const secondPromote = await attempt(() => services.promoteWaitlistEntry(ids.wsA, w2.entry.id, actor))
        const w2After = await prisma.appointmentWaitlistEntry.findUnique({ where: { id: w2.entry.id } })
        check("promoting into an occupied slot is refused", !secondPromote.ok && secondPromote.code === "CONFLICT", !secondPromote.ok ? secondPromote.message : "ACCEPTED")
        check(
            "a failed promotion returns the entry to WAITING rather than losing its place",
            w2After?.status === "WAITING" && w2After?.offerExpiresAt === null,
            `status=${w2After?.status} offerExpiresAt=${String(w2After?.offerExpiresAt)}`,
        )

        const illegalWaitlist = await attempt(() => services.transitionWaitlist(ids.wsA, w1.entry.id, "OFFERED"))
        check("illegal waitlist transition refused CONFLICT", !illegalWaitlist.ok && illegalWaitlist.code === "CONFLICT", !illegalWaitlist.ok ? illegalWaitlist.message : "ACCEPTED")

        // ---- 7. wrong tenant cannot see or promote ----------------------
        identity.current = `clerk_${ids.userB}`
        const foreignWaitlist = await services.listWaitlist(ids.wsB, ids.svcA)
        check("wrong tenant sees no waitlist entries", foreignWaitlist.length === 0, `count=${foreignWaitlist.length}`)
        const foreignPromote = await attempt(() => services.promoteWaitlistEntry(ids.wsB, w2.entry.id, actor))
        check("wrong-tenant promotion refused FORBIDDEN", !foreignPromote.ok && foreignPromote.code === "FORBIDDEN", !foreignPromote.ok ? foreignPromote.code : "LEAKED")

        // ---- 8. event ledger recorded every accepted change ------------
        identity.current = `clerk_${ids.userA}`
        const events = await engine.history(ids.wsA, bookingId)
        const kinds = events.map((e) => e.kind)
        check("deposit and reminder events were appended", kinds.includes("DEPOSIT") && kinds.includes("REMINDER"), kinds.join(","))
        const promotionEvents = await prisma.appointmentEvent.count({ where: { bookingId: promoted.bookingId, kind: "WAITLIST" } })
        check("a WAITLIST event was appended for the promotion", promotionEvents === 1, `events=${promotionEvents}`)
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "AppointmentEvent" disable trigger "AppointmentEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "AppointmentEvent" where "bookingId" in (select "id" from "Booking" where "profileId" in ('${ids.profileA}','${ids.profileB}'))`,
            )
        } finally {
            await prisma.$executeRawUnsafe(`alter table "AppointmentEvent" enable trigger "AppointmentEvent_append_only"`)
        }
        for (const sql of [
            `delete from "AppointmentReminder" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentDeposit" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentWaitlistEntry" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "Booking" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AppointmentResource" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "AvailabilitySchedule" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "ServiceOffering" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='AppointmentEvent_append_only'`,
        )
        check("append-only trigger re-armed after teardown", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)
        const endB = await prisma.booking.count()
        const endW = await prisma.appointmentWaitlistEntry.count()
        check("booking rows returned to baseline", endB === baseBookings, `baseline=${baseBookings} end=${endB}`)
        check("waitlist rows returned to baseline", endW === baseWaitlist, `baseline=${baseWaitlist} end=${endW}`)

        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All appointment lifecycle, waitlist, deposit and reminder boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
