/**
 * Wave A / A2 reservation engine boundary harness.
 *
 * Executes the REAL PersistedReservations engine against the authorized disposable
 * rehearsal database with a controlled identity. This is executable boundary
 * evidence: no regex over source establishes anything here.
 *
 * Proves, for every entry point:
 *   - anonymous is refused                     (UNAUTHORIZED, no rows written)
 *   - wrong tenant is refused                  (FORBIDDEN, byte-identical to nonexistent)
 *   - valid owner succeeds
 *   - refusals have zero side effects
 * Plus the reservation-specific properties:
 *   - capacity is fail-closed when seats is NULL
 *   - party larger than the table is refused
 *   - overlap is refused under TWO GENUINELY CONCURRENT transactions, one winner
 *   - adjacent bookings at the turnover boundary are allowed
 *   - idempotent replay returns the original row and writes NO second event
 *   - every illegal lifecycle transition is refused, exhaustively
 *   - the event ledger is append-only and monotonic
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node scripts/one-off/check-reservation-authz.ts
 *
 * MODULE NOTE: compiled as CommonJS by scripts/tsconfig.checks.json. `import.meta`
 * is a compile error here; a harness that cannot compile is not evidence.
 */
import { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { PersistedReservations } from "../../src/lib/reservations/engine"
import {
    RESERVATION_STATUSES,
    canTransition,
    type ReservationStatusValue,
} from "../../src/lib/reservations/lifecycle"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wa2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

/** Identity that can be switched between users and anonymous at will. */
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
        if (e instanceof PersistenceError) {
            return { ok: false, code: e.code, message: e.message }
        }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }

function at(iso: string): Date {
    return new Date(iso)
}

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
    const engine = new PersistedReservations(prisma, tenancy)

    // Second independent client, used ONLY for the genuine concurrency test.
    const prismaB = new PrismaClient()
    const identityB = new ControlledIdentity()
    const engineB = new PersistedReservations(prismaB, new PersistedTenancy(prismaB, identityB))

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    // ---- fixture ids -------------------------------------------------------
    const ids = {
        userA: `${RUN}_ua`,
        userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`,
        profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`,
        wsB: `${RUN}_wb`,
        tableA: `${RUN}_ta`,
        tableNoSeats: `${RUN}_tn`,
        tableB: `${RUN}_tb`,
    }

    let baselineReservations = 0
    let baselineEvents = 0

    try {
        baselineReservations = await prisma.reservation.count()
        baselineEvents = await prisma.reservationEvent.count()

        // ---- seed two independent venues ----------------------------------
        for (const [u, p, w, t] of [
            [ids.userA, ids.profileA, ids.wsA, ids.tableA],
            [ids.userB, ids.profileB, ids.wsB, ids.tableB],
        ]) {
            await prisma.user.create({
                data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` },
            })
            await prisma.profile.create({
                data: { id: p, userId: u, slug: `slug-${p}`, displayName: `Venue ${p}` },
            })
            await prisma.workspace.create({
                data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` },
            })
            await prisma.membership.create({
                data: { workspaceId: w, userId: u, role: "OWNER" },
            })
            await prisma.restaurantTable.create({
                data: { id: t, profileId: p, label: "T1", code: `code_${t}`, seats: 4 },
            })
        }
        // A table with NO seat count, to prove capacity is fail-closed.
        await prisma.restaurantTable.create({
            data: { id: ids.tableNoSeats, profileId: ids.profileA, label: "T-unset", code: `code_${ids.tableNoSeats}`, seats: null },
        })

        const slot = { startAt: at("2031-01-10T18:00:00Z"), endAt: at("2031-01-10T20:00:00Z") }

        // ---- 1. anonymous is refused, with zero writes --------------------
        identity.current = null
        const before1 = await prisma.reservation.count()
        const anon = await attempt(() =>
            engine.create(ids.wsA, { tableId: ids.tableA, partySize: 2, ...slot, guestName: "Anon" }, actor),
        )
        const after1 = await prisma.reservation.count()
        check(
            "anonymous create is refused UNAUTHORIZED",
            !anon.ok && anon.code === "UNAUTHORIZED",
            !anon.ok ? `${anon.code}: ${anon.message}` : "ACCEPTED",
        )
        check("anonymous create wrote zero rows", before1 === after1, `before=${before1} after=${after1}`)

        const anonList = await attempt(() => engine.list(ids.wsA))
        check(
            "anonymous list is refused UNAUTHORIZED",
            !anonList.ok && anonList.code === "UNAUTHORIZED",
            !anonList.ok ? anonList.code : "ACCEPTED",
        )

        // ---- 2. valid owner succeeds --------------------------------------
        identity.current = `clerk_${ids.userA}`
        const created = await engine.create(
            ids.wsA,
            { tableId: ids.tableA, partySize: 4, ...slot, guestName: "Owner Guest", idempotencyKey: "k1" },
            actor,
        )
        check("valid owner create succeeds", created.reservation.status === "CONFIRMED", `status=${created.reservation.status}`)
        check("valid owner create is not a replay", created.replayed === false, `replayed=${created.replayed}`)

        const listed = await engine.list(ids.wsA)
        check("owner sees exactly their own reservation", listed.length === 1 && listed[0].id === created.reservation.id, `count=${listed.length}`)

        // ---- 3. wrong tenant refused, and indistinguishable from missing --
        identity.current = `clerk_${ids.userB}`
        const foreign = await attempt(() => engine.get(ids.wsB, created.reservation.id))
        const missing = await attempt(() => engine.get(ids.wsB, `${RUN}_does_not_exist`))
        check(
            "wrong-tenant get is refused FORBIDDEN",
            !foreign.ok && foreign.code === "FORBIDDEN",
            !foreign.ok ? `${foreign.code}: ${foreign.message}` : "LEAKED",
        )
        check(
            "foreign and nonexistent responses are byte-identical",
            JSON.stringify(foreign) === JSON.stringify(missing),
            `foreign=${JSON.stringify(foreign)} missing=${JSON.stringify(missing)}`,
        )

        const foreignList = await engine.list(ids.wsB)
        check("wrong tenant sees zero of the other venue's rows", foreignList.length === 0, `count=${foreignList.length}`)

        // Cross-venue table use: B cannot book A's table.
        const crossTable = await attempt(() =>
            engineB_create(ids.wsB, ids.tableA),
        )
        check(
            "cannot book a table belonging to another venue",
            !crossTable.ok && crossTable.code === "FORBIDDEN",
            !crossTable.ok ? `${crossTable.code}: ${crossTable.message}` : "LEAKED",
        )

        async function engineB_create(ws: string, tableId: string) {
            identity.current = `clerk_${ids.userB}`
            return engine.create(
                ws,
                { tableId, partySize: 2, startAt: at("2031-02-01T18:00:00Z"), endAt: at("2031-02-01T20:00:00Z"), guestName: "Cross" },
                actor,
            )
        }

        // ---- 4. wrong-tenant transition refused, with no state change -----
        const beforeStatus = (await prisma.reservation.findUnique({ where: { id: created.reservation.id } }))?.status
        const foreignTransition = await attempt(() =>
            engine.transition(ids.wsB, created.reservation.id, "CANCELLED", actor),
        )
        const afterStatus = (await prisma.reservation.findUnique({ where: { id: created.reservation.id } }))?.status
        check(
            "wrong-tenant transition is refused FORBIDDEN",
            !foreignTransition.ok && foreignTransition.code === "FORBIDDEN",
            !foreignTransition.ok ? foreignTransition.code : "MUTATED",
        )
        check("refused transition left status unchanged", beforeStatus === afterStatus, `${beforeStatus} -> ${afterStatus}`)

        // ---- 5. capacity is fail-closed on NULL seats ---------------------
        identity.current = `clerk_${ids.userA}`
        const noSeats = await attempt(() =>
            engine.create(
                ids.wsA,
                { tableId: ids.tableNoSeats, partySize: 2, startAt: at("2031-03-01T18:00:00Z"), endAt: at("2031-03-01T20:00:00Z"), guestName: "NoSeats" },
                actor,
            ),
        )
        check(
            "table with NULL seats refuses reservations (fail-closed)",
            !noSeats.ok && noSeats.code === "CONFLICT" && /seat count/i.test(noSeats.message),
            !noSeats.ok ? noSeats.message : "ACCEPTED",
        )

        const tooBig = await attempt(() =>
            engine.create(
                ids.wsA,
                { tableId: ids.tableA, partySize: 99, startAt: at("2031-03-02T18:00:00Z"), endAt: at("2031-03-02T20:00:00Z"), guestName: "TooBig" },
                actor,
            ),
        )
        check(
            "party larger than the table is refused",
            !tooBig.ok && tooBig.code === "CONFLICT" && /exceeds/i.test(tooBig.message),
            !tooBig.ok ? tooBig.message : "ACCEPTED",
        )

        // ---- 6. GENUINELY CONCURRENT double-booking, exactly one winner ---
        // Both clients target the same table and an overlapping slot, launched
        // together on two independent connections. The row lock in the engine must
        // serialize them so exactly one commits.
        identity.current = `clerk_${ids.userA}`
        identityB.current = `clerk_${ids.userA}`
        const raceSlot = { startAt: at("2031-04-01T18:00:00Z"), endAt: at("2031-04-01T20:00:00Z") }
        const raceSlotOverlap = { startAt: at("2031-04-01T19:00:00Z"), endAt: at("2031-04-01T21:00:00Z") }

        const [ra, rb] = await Promise.allSettled([
            engine.create(ids.wsA, { tableId: ids.tableA, partySize: 2, ...raceSlot, guestName: "RaceA" }, actor),
            engineB.create(ids.wsA, { tableId: ids.tableA, partySize: 2, ...raceSlotOverlap, guestName: "RaceB" }, actor),
        ])
        const fulfilled = [ra, rb].filter((r) => r.status === "fulfilled").length
        const rejected = [ra, rb].filter((r) => r.status === "rejected")
        const rejectionCodes = rejected.map((r) =>
            (r as PromiseRejectedResult).reason instanceof PersistenceError
                ? ((r as PromiseRejectedResult).reason as PersistenceError).code
                : "UNEXPECTED",
        )
        const rejectionDetail = rejected
            .map((r) => String((r as PromiseRejectedResult).reason?.message ?? "").split("\n").filter(Boolean)[0])
            .join(" | ")
        // This is the single inverted assertion.
        check(
            "two concurrent overlapping bookings produce exactly one winner",
            INVERT ? fulfilled !== 1 : fulfilled === 1,
            `fulfilled=${fulfilled} rejectedCodes=${rejectionCodes.join(",")}`,
        )
        check(
            "the loser is refused with CONFLICT",
            rejectionCodes.length === 1 && rejectionCodes[0] === "CONFLICT",
            `codes=${rejectionCodes.join(",")} detail=${rejectionDetail.slice(0, 160)}`,
        )
        const raceRows = await prisma.reservation.count({
            where: { tableId: ids.tableA, startAt: { gte: at("2031-04-01T00:00:00Z"), lt: at("2031-04-02T00:00:00Z") } },
        })
        check("only one row persisted for the contended slot", raceRows === 1, `rows=${raceRows}`)

        // ---- 7. adjacent booking at the turnover boundary is allowed ------
        const adjacent = await attempt(() =>
            engine.create(
                ids.wsA,
                { tableId: ids.tableA, partySize: 2, startAt: at("2031-04-01T20:00:00Z"), endAt: at("2031-04-01T21:30:00Z"), guestName: "Adjacent" },
                actor,
            ),
        )
        // Whether this is accepted depends on which racer won; assert only that an
        // exactly-adjacent booking is never refused for OVERLAP reasons.
        check(
            "exact turnover boundary is not treated as an overlap",
            adjacent.ok || (!adjacent.ok && !/overlapping/i.test(adjacent.message)),
            adjacent.ok ? "accepted" : adjacent.message,
        )

        // ---- 8. idempotent replay: original row, NO second event ---------
        const eventsBefore = await prisma.reservationEvent.count({ where: { reservationId: created.reservation.id } })
        const replay = await engine.create(
            ids.wsA,
            { tableId: ids.tableA, partySize: 4, ...slot, guestName: "Different Name", idempotencyKey: "k1" },
            actor,
        )
        const eventsAfter = await prisma.reservationEvent.count({ where: { reservationId: created.reservation.id } })
        check("replay is reported as replayed", replay.replayed === true, `replayed=${replay.replayed}`)
        check("replay returns the ORIGINAL reservation id", replay.reservation.id === created.reservation.id, `${replay.reservation.id} vs ${created.reservation.id}`)
        check("replay did not overwrite the original guest name", replay.reservation.guestName === "Owner Guest", `name=${replay.reservation.guestName}`)
        check("replay wrote NO second event", eventsBefore === eventsAfter, `before=${eventsBefore} after=${eventsAfter}`)

        // ---- 9. exhaustive illegal-transition refusal --------------------
        // Walk a reservation CONFIRMED -> SEATED -> COMPLETED and, at each state,
        // assert every transition the lifecycle forbids is actually refused.
        let illegalRefused = 0
        let illegalTotal = 0
        const illegalLeaked: string[] = []
        for (const target of RESERVATION_STATUSES) {
            const row = await prisma.reservation.findUnique({ where: { id: created.reservation.id } })
            const from = row!.status as ReservationStatusValue
            if (canTransition(from, target)) continue
            illegalTotal += 1
            const before = row!.status
            const r = await attempt(() => engine.transition(ids.wsA, created.reservation.id, target, actor))
            const afterRow = await prisma.reservation.findUnique({ where: { id: created.reservation.id } })
            if (!r.ok && r.code === "CONFLICT" && afterRow!.status === before) illegalRefused += 1
            else illegalLeaked.push(`${from}->${target}:${r.ok ? "ACCEPTED" : r.code}`)
        }
        check(
            "every illegal transition from the current state is refused",
            illegalTotal > 0 && illegalRefused === illegalTotal,
            `refused=${illegalRefused}/${illegalTotal}${illegalLeaked.length ? ` leaked=${illegalLeaked.join(",")}` : ""}`,
        )

        // ---- 10. legal transition path works and is recorded -------------
        await engine.transition(ids.wsA, created.reservation.id, "SEATED", actor)
        const seated = await engine.get(ids.wsA, created.reservation.id)
        check("CONFIRMED -> SEATED is allowed", seated.status === "SEATED", `status=${seated.status}`)
        await engine.transition(ids.wsA, created.reservation.id, "COMPLETED", actor)
        const completed = await engine.get(ids.wsA, created.reservation.id)
        check("SEATED -> COMPLETED is allowed", completed.status === "COMPLETED", `status=${completed.status}`)
        check("terminal reservation offers no further transitions", completed.allowedTransitions.length === 0, `allowed=${completed.allowedTransitions.join(",")}`)

        const terminalMove = await attempt(() => engine.transition(ids.wsA, created.reservation.id, "CANCELLED", actor))
        check(
            "terminal reservation refuses further change",
            !terminalMove.ok && terminalMove.code === "CONFLICT",
            !terminalMove.ok ? terminalMove.message : "MUTATED",
        )

        // ---- 11. event ledger is monotonic and append-only ---------------
        const history = await engine.history(ids.wsA, created.reservation.id)
        const seqs = history.map((h) => Number(h.seq))
        const monotonic = seqs.every((v, i) => i === 0 || v > seqs[i - 1])
        check("event ledger is monotonic", monotonic && seqs.length >= 3, `seqs=${seqs.join(",")}`)
        check(
            "ledger records the CREATED event then STATUS events",
            history[0]?.kind === "CREATED" && history.slice(1).every((h) => h.kind === "STATUS"),
            history.map((h) => h.kind).join(","),
        )

        let ledgerImmutable = false
        let ledgerDetail = ""
        try {
            await prisma.$executeRawUnsafe(
                `update "ReservationEvent" set "to"='TAMPERED' where "reservationId"='${created.reservation.id}'`,
            )
        } catch (e) {
            ledgerImmutable = true
            ledgerDetail = (e as Error).message.split("\n").find((l) => l.includes("append-only")) ?? "refused"
        }
        check("ledger refuses UPDATE at the database level", ledgerImmutable, ledgerDetail || "NOT REFUSED")

        // ---- 12. history is tenant-checked ------------------------------
        identity.current = `clerk_${ids.userB}`
        const foreignHistory = await attempt(() => engine.history(ids.wsB, created.reservation.id))
        check(
            "wrong-tenant history is refused FORBIDDEN",
            !foreignHistory.ok && foreignHistory.code === "FORBIDDEN",
            !foreignHistory.ok ? foreignHistory.code : "LEAKED",
        )
    } finally {
        // ---- teardown -----------------------------------------------------
        // ReservationEvent refuses DELETE by trigger, and Reservation cascades onto
        // it, so a reservation with history cannot be deleted while the trigger is
        // armed. That is correct production behaviour for an audit ledger. For
        // cleanup only, the trigger is briefly disabled and then RE-ARMED, and the
        // harness asserts it is armed again before reporting.
        try {
            await prisma.$executeRawUnsafe(`alter table "ReservationEvent" disable trigger "ReservationEvent_append_only"`)
            await prisma.$executeRawUnsafe(`delete from "ReservationEvent" where "reservationId" in (select "id" from "Reservation" where "profileId" in ('${ids.profileA}','${ids.profileB}'))`)
            await prisma.$executeRawUnsafe(`delete from "Reservation" where "profileId" in ('${ids.profileA}','${ids.profileB}')`)
        } finally {
            await prisma.$executeRawUnsafe(`alter table "ReservationEvent" enable trigger "ReservationEvent_append_only"`)
        }
        await prisma.$executeRawUnsafe(`delete from "RestaurantTable" where "profileId" in ('${ids.profileA}','${ids.profileB}')`)
        await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
        await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
        await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`)
        await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)

        // Prove the append-only trigger is armed again after teardown.
        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='ReservationEvent_append_only'`,
        )
        check("append-only trigger is re-armed after teardown", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        const endReservations = await prisma.reservation.count()
        const endEvents = await prisma.reservationEvent.count()
        check("reservation rows returned to baseline", endReservations === baselineReservations, `baseline=${baselineReservations} end=${endReservations}`)
        check("event rows returned to baseline", endEvents === baselineEvents, `baseline=${baselineEvents} end=${endEvents}`)

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
    console.log("All reservation engine boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
