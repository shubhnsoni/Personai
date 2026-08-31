/**
 * Wave B / B2 appointment engine boundary harness.
 *
 * Executes the REAL PersistedAppointments engine against the authorized disposable
 * rehearsal database with a controlled identity. Executable boundary evidence; no regex
 * over source establishes anything here.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-appointment-authz.ts
 */
import { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { evaluateAvailability, parseClock } from "../../src/lib/appointments/availability"
import { PersistedAppointments } from "../../src/lib/appointments/engine"
import {
    APPOINTMENT_STATUSES,
    OCCUPYING_STATUSES,
    canTransition,
    type AppointmentStatus,
} from "../../src/lib/appointments/lifecycle"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wb2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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
    const engine = new PersistedAppointments(prisma, new PersistedTenancy(prisma, identity))

    // Independent client for the genuine concurrency test.
    const prismaB = new PrismaClient()
    const identityB = new ControlledIdentity()
    const engineB = new PersistedAppointments(prismaB, new PersistedTenancy(prismaB, identityB))

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
        resA: `${RUN}_ra`, resNoCap: `${RUN}_rn`, resB: `${RUN}_rb`,
    }

    let baseBookings = 0
    let bookingId = ""

    try {
        baseBookings = await prisma.booking.count()

        // ---- 0. the alignment contract between code and constraint -----------
        // If OCCUPYING_STATUSES and the exclusion predicate drift, the database and the
        // application disagree about what a conflict is. Assert they agree.
        const excl = await prisma.$queryRawUnsafe<{ def: string }[]>(
            "select pg_get_constraintdef(oid) as def from pg_constraint where conname='Booking_resource_no_overlap'",
        )
        const def = excl[0]?.def ?? ""
        const inConstraint = OCCUPYING_STATUSES.every((s) => def.includes(`'${s}'`))
        const nonOccupying = APPOINTMENT_STATUSES.filter((s) => !OCCUPYING_STATUSES.includes(s))
        const noExtras = nonOccupying.every((s) => !def.includes(`'${s}'`))
        check(
            "OCCUPYING_STATUSES exactly matches the exclusion constraint predicate",
            inConstraint && noExtras,
            `occupying=${OCCUPYING_STATUSES.join(",")} constraintHasExtras=${!noExtras}`,
        )

        // ---- seed two independent tenants -----------------------------------
        for (const [u, p, w, s, r] of [
            [ids.userA, ids.profileA, ids.wsA, ids.svcA, ids.resA],
            [ids.userB, ids.profileB, ids.wsB, ids.svcB, ids.resB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({
                data: { id: p, userId: u, slug: `slug-${p}`, displayName: `Practice ${p}`, bufferMinutes: 0 },
            })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.serviceOffering.create({ data: { id: s, profileId: p, name: "Consultation", durationMinutes: 60 } })
            await prisma.appointmentResource.create({
                data: { id: r, profileId: p, name: "Alice", kind: "STAFF", capacity: 1 },
            })
            // Publish availability every day 08:00-20:00 so slot times are predictable.
            for (let d = 0; d < 7; d += 1) {
                await prisma.availabilitySchedule.create({
                    data: { profileId: p, dayOfWeek: d, startTime: "08:00", endTime: "20:00", isEnabled: true },
                })
            }
        }
        await prisma.appointmentResource.create({
            data: { id: ids.resNoCap, profileId: ids.profileA, name: "Unconfigured", kind: "ROOM", capacity: null },
        })

        // 2033-01-03 is a Monday; 10:00-11:00 UTC sits inside 08:00-20:00.
        const slot = { startTime: at("2033-01-03T10:00:00Z"), endTime: at("2033-01-03T11:00:00Z") }
        const base = { visitorName: "Guest", visitorEmail: "g@example.test" }

        // ---- 1. anonymous refused, zero writes -----------------------------
        identity.current = null
        const before = await prisma.booking.count()
        const anon = await attempt(() =>
            engine.book(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, ...slot, ...base }, actor),
        )
        const after = await prisma.booking.count()
        check("anonymous book is refused UNAUTHORIZED", !anon.ok && anon.code === "UNAUTHORIZED", !anon.ok ? anon.code : "ACCEPTED")
        check("anonymous book wrote zero rows", before === after, `before=${before} after=${after}`)
        const anonList = await attempt(() => engine.list(ids.wsA))
        check("anonymous list is refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", !anonList.ok ? anonList.code : "ACCEPTED")

        // ---- 2. valid owner succeeds ---------------------------------------
        identity.current = `clerk_${ids.userA}`
        const created = await engine.book(
            ids.wsA,
            { serviceOfferingId: ids.svcA, resourceId: ids.resA, ...slot, ...base, idempotencyKey: "k1" },
            actor,
        )
        bookingId = created.appointment.id
        check("valid owner book succeeds and is CONFIRMED", created.appointment.status === "CONFIRMED", `status=${created.appointment.status}`)
        check("book is not reported as a replay", created.replayed === false, `replayed=${created.replayed}`)
        check("resource name is resolved", created.appointment.resourceName === "Alice", `name=${created.appointment.resourceName}`)

        const listed = await engine.list(ids.wsA)
        check("owner sees exactly their own appointment", listed.length === 1 && listed[0].id === bookingId, `count=${listed.length}`)

        // ---- 3. wrong tenant refused, indistinguishable from missing -------
        identity.current = `clerk_${ids.userB}`
        const foreign = await attempt(() => engine.get(ids.wsB, bookingId))
        const missing = await attempt(() => engine.get(ids.wsB, `${RUN}_nope`))
        check("wrong-tenant get is refused FORBIDDEN", !foreign.ok && foreign.code === "FORBIDDEN", !foreign.ok ? foreign.code : "LEAKED")
        check(
            "foreign and nonexistent responses are byte-identical",
            JSON.stringify(foreign) === JSON.stringify(missing),
            `foreign=${JSON.stringify(foreign)} missing=${JSON.stringify(missing)}`,
        )
        const foreignList = await engine.list(ids.wsB)
        check("wrong tenant sees none of the other tenant's rows", foreignList.length === 0, `count=${foreignList.length}`)

        // Cross-tenant resource use must be refused.
        const crossResource = await attempt(() =>
            engine.book(
                ids.wsB,
                { serviceOfferingId: ids.svcB, resourceId: ids.resA, startTime: at("2033-01-04T10:00:00Z"), endTime: at("2033-01-04T11:00:00Z"), ...base },
                actor,
            ),
        )
        check("cannot book a resource owned by another tenant", !crossResource.ok && crossResource.code === "FORBIDDEN", !crossResource.ok ? crossResource.code : "LEAKED")

        // Cross-tenant service use must be refused.
        const crossService = await attempt(() =>
            engine.book(
                ids.wsB,
                { serviceOfferingId: ids.svcA, resourceId: ids.resB, startTime: at("2033-01-04T12:00:00Z"), endTime: at("2033-01-04T13:00:00Z"), ...base },
                actor,
            ),
        )
        check("cannot book another tenant's service", !crossService.ok && crossService.code === "FORBIDDEN", !crossService.ok ? crossService.code : "LEAKED")

        // ---- 4. refused transition leaves state untouched -----------------
        const stBefore = (await prisma.booking.findUnique({ where: { id: bookingId } }))?.status
        const foreignTransition = await attempt(() => engine.transition(ids.wsB, bookingId, "CANCELLED", actor))
        const stAfter = (await prisma.booking.findUnique({ where: { id: bookingId } }))?.status
        check("wrong-tenant transition refused FORBIDDEN", !foreignTransition.ok && foreignTransition.code === "FORBIDDEN", !foreignTransition.ok ? foreignTransition.code : "MUTATED")
        check("refused transition left status unchanged", stBefore === stAfter, `${stBefore} -> ${stAfter}`)

        // ---- 5. capacity is fail-closed -----------------------------------
        identity.current = `clerk_${ids.userA}`
        const noCap = await attempt(() =>
            engine.book(
                ids.wsA,
                { serviceOfferingId: ids.svcA, resourceId: ids.resNoCap, startTime: at("2033-01-05T10:00:00Z"), endTime: at("2033-01-05T11:00:00Z"), ...base },
                actor,
            ),
        )
        check(
            "resource with NULL capacity refuses bookings (fail-closed)",
            !noCap.ok && noCap.code === "CONFLICT" && /capacity configured/i.test(noCap.message),
            !noCap.ok ? noCap.message : "ACCEPTED",
        )
        const tooBig = await attempt(() =>
            engine.book(
                ids.wsA,
                { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2033-01-06T10:00:00Z"), endTime: at("2033-01-06T11:00:00Z"), partySize: 9, ...base },
                actor,
            ),
        )
        check(
            "party larger than resource capacity is refused",
            !tooBig.ok && tooBig.code === "CONFLICT" && /exceeds the capacity/i.test(tooBig.message),
            !tooBig.ok ? tooBig.message : "ACCEPTED",
        )

        // ---- 6. availability is enforced ---------------------------------
        const outsideHours = await attempt(() =>
            engine.book(
                ids.wsA,
                { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2033-01-07T05:00:00Z"), endTime: at("2033-01-07T06:00:00Z"), ...base },
                actor,
            ),
        )
        check(
            "a slot outside published hours is refused",
            !outsideHours.ok && /outside published hours/i.test(outsideHours.message),
            !outsideHours.ok ? outsideHours.message : "ACCEPTED",
        )

        // A blocking override must win over the weekly schedule.
        await prisma.calendarOverride.create({
            data: { profileId: ids.profileA, date: at("2033-01-10T00:00:00Z"), isBlocked: true, startTime: null, endTime: null },
        })
        const blockedDay = await attempt(() =>
            engine.book(
                ids.wsA,
                { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2033-01-10T10:00:00Z"), endTime: at("2033-01-10T11:00:00Z"), ...base },
                actor,
            ),
        )
        check(
            "a blocked calendar override refuses the whole day",
            !blockedDay.ok && /blocked/i.test(blockedDay.message),
            !blockedDay.ok ? blockedDay.message : "ACCEPTED",
        )

        // ---- 7. GENUINELY CONCURRENT double-booking, one winner -----------
        identityB.current = `clerk_${ids.userA}`
        const raceA = { startTime: at("2033-02-07T10:00:00Z"), endTime: at("2033-02-07T11:00:00Z") }
        const raceB = { startTime: at("2033-02-07T10:30:00Z"), endTime: at("2033-02-07T11:30:00Z") }
        const [ra, rb] = await Promise.allSettled([
            engine.book(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, ...raceA, ...base }, actor),
            engineB.book(ids.wsA, { serviceOfferingId: ids.svcA, resourceId: ids.resA, ...raceB, ...base }, actor),
        ])
        const fulfilled = [ra, rb].filter((r) => r.status === "fulfilled").length
        const codes = [ra, rb]
            .filter((r) => r.status === "rejected")
            .map((r) => {
                const reason = (r as PromiseRejectedResult).reason
                return reason instanceof PersistenceError ? reason.code : "UNEXPECTED"
            })
        // This is the single inverted assertion.
        check(
            "two concurrent overlapping bookings produce exactly one winner",
            INVERT ? fulfilled !== 1 : fulfilled === 1,
            `fulfilled=${fulfilled} rejected=${codes.join(",")}`,
        )
        check("the loser is refused with CONFLICT", codes.length === 1 && codes[0] === "CONFLICT", `codes=${codes.join(",")}`)
        const raceRows = await prisma.booking.count({
            where: { resourceId: ids.resA, startTime: { gte: at("2033-02-07T00:00:00Z"), lt: at("2033-02-08T00:00:00Z") } },
        })
        check("only one row persisted for the contended slot", raceRows === 1, `rows=${raceRows}`)

        // ---- 8. back-to-back allowed when buffer is zero -----------------
        const adjacent = await attempt(() =>
            engine.book(
                ids.wsA,
                { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2033-02-07T11:30:00Z"), endTime: at("2033-02-07T12:30:00Z"), ...base },
                actor,
            ),
        )
        check("back-to-back booking is allowed with a zero buffer", adjacent.ok, adjacent.ok ? "accepted" : adjacent.message)

        // ---- 9. buffer minutes widen the conflict window -----------------
        // This is the assertion that proves the APPLICATION check works. The exclusion
        // constraint cannot see bufferMinutes, so a conflict inside the buffer gap is
        // detectable ONLY by the engine. Before the timezone fix this silently passed
        // through: raw Date parameters bound as local wall-clock made the predicate
        // false on a UTC+05:30 host, so the app check was inert and the constraint was
        // doing all the work.
        await prisma.profile.update({ where: { id: ids.profileA }, data: { bufferMinutes: 30 } })
        let bufferDetectedBy: unknown = null
        const withinBuffer = await attempt(async () => {
            try {
                return await engine.book(
                    ids.wsA,
                    { serviceOfferingId: ids.svcA, resourceId: ids.resA, startTime: at("2033-02-07T12:30:00Z"), endTime: at("2033-02-07T13:00:00Z"), ...base },
                    actor,
                )
            } catch (e) {
                if (e instanceof PersistenceError) bufferDetectedBy = e.details?.detectedBy
                throw e
            }
        })
        check(
            "a booking inside the buffer gap is refused once bufferMinutes is set",
            !withinBuffer.ok && withinBuffer.code === "CONFLICT",
            !withinBuffer.ok ? withinBuffer.message : "ACCEPTED",
        )
        check(
            "the buffer conflict was detected by the APPLICATION, not the database constraint",
            bufferDetectedBy === "application",
            `detectedBy=${String(bufferDetectedBy)}`,
        )
        await prisma.profile.update({ where: { id: ids.profileA }, data: { bufferMinutes: 0 } })

        // ---- 10. idempotent replay -------------------------------------
        const eventsBefore = await prisma.appointmentEvent.count({ where: { bookingId } })
        const replay = await engine.book(
            ids.wsA,
            { serviceOfferingId: ids.svcA, resourceId: ids.resA, ...slot, visitorName: "Someone Else", visitorEmail: "x@example.test", idempotencyKey: "k1" },
            actor,
        )
        const eventsAfter = await prisma.appointmentEvent.count({ where: { bookingId } })
        check("replay is flagged as replayed", replay.replayed === true, `replayed=${replay.replayed}`)
        check("replay returns the ORIGINAL id", replay.appointment.id === bookingId, `${replay.appointment.id} vs ${bookingId}`)
        check("replay did not overwrite the original visitor", replay.appointment.visitorName === "Guest", `name=${replay.appointment.visitorName}`)
        check("replay wrote NO second event", eventsBefore === eventsAfter, `before=${eventsBefore} after=${eventsAfter}`)

        // ---- 11. exhaustive illegal-transition refusal ------------------
        let refusedCount = 0
        let totalIllegal = 0
        const leaked: string[] = []
        for (const target of APPOINTMENT_STATUSES) {
            const row = await prisma.booking.findUnique({ where: { id: bookingId } })
            const from = row!.status as AppointmentStatus
            if (canTransition(from, target)) continue
            totalIllegal += 1
            const r = await attempt(() => engine.transition(ids.wsA, bookingId, target, actor))
            const post = await prisma.booking.findUnique({ where: { id: bookingId } })
            if (!r.ok && r.code === "CONFLICT" && post!.status === from) refusedCount += 1
            else leaked.push(`${from}->${target}:${r.ok ? "ACCEPTED" : r.code}`)
        }
        check(
            "every illegal transition from the current state is refused",
            totalIllegal > 0 && refusedCount === totalIllegal,
            `refused=${refusedCount}/${totalIllegal}${leaked.length ? ` leaked=${leaked.join(",")}` : ""}`,
        )

        // ---- 12. legal path and append-only ledger ---------------------
        await engine.transition(ids.wsA, bookingId, "CHECKED_IN", actor)
        check("CONFIRMED -> CHECKED_IN allowed", (await engine.get(ids.wsA, bookingId)).status === "CHECKED_IN")
        await engine.transition(ids.wsA, bookingId, "COMPLETED", actor)
        const done = await engine.get(ids.wsA, bookingId)
        check("CHECKED_IN -> COMPLETED allowed", done.status === "COMPLETED", `status=${done.status}`)
        check("terminal appointment offers no transitions", done.allowedTransitions.length === 0, `allowed=${done.allowedTransitions.join(",")}`)
        const afterTerminal = await attempt(() => engine.transition(ids.wsA, bookingId, "CANCELLED", actor))
        check("terminal appointment refuses further change", !afterTerminal.ok && afterTerminal.code === "CONFLICT", !afterTerminal.ok ? afterTerminal.message : "MUTATED")

        const history = await engine.history(ids.wsA, bookingId)
        const seqs = history.map((h) => Number(h.seq))
        check("ledger is monotonic", seqs.length >= 3 && seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `seqs=${seqs.join(",")}`)
        check("ledger starts with CREATED then STATUS", history[0]?.kind === "CREATED" && history.slice(1).length > 0 && history.slice(1).every((h) => h.kind === "STATUS"), history.map((h) => h.kind).join(","))

        let immutable = false
        try {
            await prisma.$executeRawUnsafe(`update "AppointmentEvent" set "to"='TAMPERED' where "bookingId"='${bookingId}'`)
        } catch {
            immutable = true
        }
        check("ledger refuses UPDATE at the database level", immutable, immutable ? "refused" : "MUTATED")

        identity.current = `clerk_${ids.userB}`
        const foreignHistory = await attempt(() => engine.history(ids.wsB, bookingId))
        check("wrong-tenant history refused FORBIDDEN", !foreignHistory.ok && foreignHistory.code === "FORBIDDEN", !foreignHistory.ok ? foreignHistory.code : "LEAKED")

        // ---- 13. pure availability unit checks ------------------------
        check("parseClock rejects nonsense", parseClock("99:99") === null && parseClock("noon") === null)
        check("parseClock accepts HH:MM", parseClock("08:30") === 510)
        const spanning = evaluateAvailability({
            start: at("2033-03-01T23:00:00Z"),
            end: at("2033-03-02T01:00:00Z"),
            windows: [{ dayOfWeek: 2, startTime: "00:00", endTime: "23:59", isEnabled: true }],
            overrides: [],
        })
        check("a slot spanning two days is refused rather than mis-evaluated", spanning.available === false, JSON.stringify(spanning))
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
            `delete from "ServiceResource" where "resourceId" in ('${ids.resA}','${ids.resB}','${ids.resNoCap}')`,
            `delete from "AppointmentResource" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
            `delete from "CalendarOverride" where "profileId" in ('${ids.profileA}','${ids.profileB}')`,
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

        const end = await prisma.booking.count()
        check("booking rows returned to baseline", end === baseBookings, `baseline=${baseBookings} end=${end}`)

        await prisma.$disconnect()
        await prismaB.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All appointment engine boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
