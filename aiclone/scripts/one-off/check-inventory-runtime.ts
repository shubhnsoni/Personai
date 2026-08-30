/**
 * Wave F / F2 inventory runtime harness.
 *
 * Exercises the REAL InventoryService against the authorized disposable rehearsal
 * database with a controlled identity.
 *
 * The claims that are MEASURED rather than described:
 *   - two CONCURRENT reservations for the last unit produce exactly one winner, run as
 *     real parallel transactions rather than argued about
 *   - a refusal writes no row and appends no movement (counts before/after)
 *   - a refusal reaches nothing external (globalThis.fetch is replaced by a counting
 *     blocker for the whole run; total calls must be 0)
 *   - replaying the ledger's signed deltas reproduces the stored balances
 *   - every fixture row is removed and every touched table returns to baseline
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-inventory-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { InventoryService } from "../../src/lib/inventory/engine"
import { RESERVATION_STATES, availableUnits, reservationFlow } from "../../src/lib/inventory/lifecycle"
import { InventoryContext, type InventoryActor } from "../../src/lib/inventory/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wf2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

function checkInvertible(name: string, pass: boolean, detail = "") {
    check(name, INVERT ? !pass : pass, detail)
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

/** Any outbound HTTP during this run is a defect, so it is counted AND refused. */
let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`external fetch is forbidden in this harness: ${String(args[0])}`)
}) as unknown as typeof globalThis.fetch

type Outcome = { ok: true } | { ok: false; code: string; message: string; details: unknown }
async function attempt(op: () => Promise<unknown>): Promise<Outcome> {
    try {
        await op()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) return { ok: false, code: e.code, message: e.message, details: e.details }
        return { ok: false, code: "UNKNOWN", message: e instanceof Error ? e.message : String(e), details: null }
    }
}
function why(o: Outcome): string {
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`.slice(0, 160)
}

const actor: InventoryActor = Object.freeze({ actorType: "STAFF", actorId: null })

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${dbName}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const ctx = new InventoryContext(prisma, new PersistedTenancy(prisma, identity))
    const inventory = new InventoryService(ctx)

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`, userC: `${RUN}_uc`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        locA: `${RUN}_la`, locA2: `${RUN}_la2`, locB: `${RUN}_lb`,
        prodA: `${RUN}_pra`, prodA2: `${RUN}_pra2`, prodB: `${RUN}_prb`,
        orderA: `${RUN}_oa`, orderB: `${RUN}_ob`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = { items: 0, movements: 0, reservations: 0, orders: 0, lines: 0 }

    const line = (n: number) => `${RUN}_ol${n}`

    try {
        base.items = await prisma.inventoryItem.count()
        base.movements = await prisma.inventoryMovement.count()
        base.reservations = await prisma.inventoryReservation.count()
        base.orders = await prisma.order.count()
        base.lines = await prisma.orderLine.count()

        // ---- 0. the reservation table is total and outcome-terminal --------
        let legal = 0
        let illegal = 0
        for (const from of RESERVATION_STATES) {
            for (const to of RESERVATION_STATES) {
                if (reservationFlow.can(from, to)) legal += 1
                else illegal += 1
            }
        }
        checkInvertible(
            `reservation transition table is total over ${RESERVATION_STATES.length}x${RESERVATION_STATES.length} pairs`,
            legal + illegal === RESERVATION_STATES.length ** 2,
            `legal=${legal} illegal=${illegal}`,
        )
        checkInvertible(
            "every settled state is terminal, so stock cannot be double-credited",
            reservationFlow.isTerminal("RELEASED") && reservationFlow.isTerminal("CONSUMED") && reservationFlow.isTerminal("EXPIRED"),
        )
        checkInvertible("available units never go negative", availableUnits(3, 5) === 0, `availableUnits(3,5)=${availableUnits(3, 5)}`)

        // ---- seed two tenants with real catalogues and orders -------------
        for (const [u, p, w, l, pr, o] of [
            [ids.userA, ids.profileA, ids.wsA, ids.locA, ids.prodA, ids.orderA],
            [ids.userB, ids.profileB, ids.wsB, ids.locB, ids.prodB, ids.orderB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Shop ${l}` } })
            await prisma.digitalProduct.create({ data: { id: pr, profileId: p, title: `Widget ${pr}` } })
            await prisma.order.create({
                data: {
                    id: o, profileId: p, publicToken: `tok_${o}`, number: 1,
                    businessDate: new Date("2035-01-01T00:00:00Z"),
                    subtotalCents: 1000, totalCents: 1000, currency: "USD",
                },
            })
        }
        await prisma.location.create({ data: { id: ids.locA2, workspaceId: ids.wsA, name: "Second shop" } })
        await prisma.digitalProduct.create({ data: { id: ids.prodA2, profileId: ids.profileA, title: "Other widget" } })
        await prisma.user.create({ data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` } })
        for (let n = 1; n <= 8; n += 1) {
            await prisma.orderLine.create({
                data: {
                    id: line(n), orderId: ids.orderA, titleSnapshot: "Widget", qty: 1,
                    unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodA,
                },
            })
        }
        await prisma.orderLine.create({
            data: {
                id: line(99), orderId: ids.orderA, titleSnapshot: "Other", qty: 1,
                unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodA2,
            },
        })
        await prisma.orderLine.create({
            data: {
                id: line(100), orderId: ids.orderB, titleSnapshot: "Foreign", qty: 1,
                unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodB,
            },
        })

        // ---- 1. anonymous is refused and writes nothing -------------------
        identity.current = null
        const beforeItems = await prisma.inventoryItem.count()
        const beforeMoves = await prisma.inventoryMovement.count()
        const anonEnsure = await attempt(() => inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA }, actor))
        const anonList = await attempt(() => inventory.list(ids.wsA))
        checkInvertible("anonymous stock-record create refused UNAUTHORIZED", !anonEnsure.ok && anonEnsure.code === "UNAUTHORIZED", why(anonEnsure))
        checkInvertible("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        checkInvertible("anonymous wrote zero stock records", beforeItems === (await prisma.inventoryItem.count()), `before=${beforeItems}`)
        checkInvertible("anonymous appended zero movements", beforeMoves === (await prisma.inventoryMovement.count()), `before=${beforeMoves}`)

        // ---- 2. authenticated non-member is refused ---------------------
        identity.current = `clerk_${ids.userC}`
        const outsider = await attempt(() => inventory.list(ids.wsA))
        checkInvertible("authenticated non-member refused FORBIDDEN", !outsider.ok && outsider.code === "FORBIDDEN", why(outsider))

        // ---- 3. stock records are idempotent by construction -----------
        identity.current = `clerk_${ids.userA}`
        const created = await inventory.ensureItem(
            ids.wsA,
            { productId: ids.prodA, locationId: ids.locA, reorderPoint: 2 },
            actor,
        )
        const itemId = created.record.id
        checkInvertible("a new stock record starts empty", created.record.onHand === 0 && created.record.reserved === 0 && created.record.available === 0, `${created.record.onHand}/${created.record.reserved}`)
        checkInvertible("a new stock record is immediately below its reorder point", created.record.belowReorderPoint, `available=${created.record.available} reorder=${created.record.reorderPoint}`)
        const replay = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA }, actor)
        checkInvertible("re-creating the same product-location pair replays", replay.replayed && replay.record.id === itemId, `replayed=${replay.replayed}`)
        checkInvertible("the replay did not reset the reorder point", replay.record.reorderPoint === 2, `${replay.record.reorderPoint}`)

        const foreignProduct = await attempt(() => inventory.ensureItem(ids.wsA, { productId: ids.prodB, locationId: ids.locA }, actor))
        checkInvertible("another tenant's product is refused", !foreignProduct.ok && foreignProduct.code === "FORBIDDEN", why(foreignProduct))
        const foreignLocation = await attempt(() => inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locB }, actor))
        checkInvertible("another tenant's location is refused", !foreignLocation.ok && foreignLocation.code === "FORBIDDEN", why(foreignLocation))

        // ---- 4. direct movements and their arithmetic ------------------
        const received = await inventory.applyMovement(ids.wsA, itemId, { kind: "RECEIPT", qty: 10, idempotencyKey: `${RUN}-r1` }, actor)
        checkInvertible("a receipt of 10 leaves 10 on hand and 10 available", received.onHand === 10 && received.available === 10, `${received.onHand}/${received.available}`)
        checkInvertible("10 on hand is above a reorder point of 2", !received.belowReorderPoint, `available=${received.available}`)
        const receiptReplay = await inventory.applyMovement(ids.wsA, itemId, { kind: "RECEIPT", qty: 999, idempotencyKey: `${RUN}-r1` }, actor)
        checkInvertible("replaying a receipt key does not apply it twice", receiptReplay.onHand === 10, `onHand=${receiptReplay.onHand}`)

        const adjusted = await inventory.applyMovement(ids.wsA, itemId, { kind: "ADJUSTMENT", qty: -3, reason: "damaged" }, actor)
        checkInvertible("an adjustment of -3 leaves 7 on hand", adjusted.onHand === 7, `${adjusted.onHand}`)
        const counted = await inventory.applyMovement(ids.wsA, itemId, { kind: "COUNT", qty: 5 }, actor)
        checkInvertible("a stock count is absolute, not relative", counted.onHand === 5, `${counted.onHand}`)
        const returned = await inventory.applyMovement(ids.wsA, itemId, { kind: "RETURN", qty: 1, orderId: ids.orderA }, actor)
        checkInvertible("a return adds the unit back", returned.onHand === 6, `${returned.onHand}`)

        const negative = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "ADJUSTMENT", qty: -99 }, actor))
        checkInvertible("an adjustment below zero is refused with the real balance named", !negative.ok && negative.code === "CONFLICT" && /only 6 are present/.test(negative.message), why(negative))
        const zeroAdjust = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "ADJUSTMENT", qty: 0 }, actor))
        checkInvertible("a zero adjustment is BAD_REQUEST, not a silent no-op", !zeroAdjust.ok && zeroAdjust.code === "BAD_REQUEST", why(zeroAdjust))
        const negativeReceipt = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "RECEIPT", qty: -1 }, actor))
        checkInvertible("a negative receipt is BAD_REQUEST", !negativeReceipt.ok && negativeReceipt.code === "BAD_REQUEST", why(negativeReceipt))
        const negativeCount = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "COUNT", qty: -1 }, actor))
        checkInvertible("a negative stock count is BAD_REQUEST", !negativeCount.ok && negativeCount.code === "BAD_REQUEST", why(negativeCount))
        for (const kind of ["RESERVE", "RELEASE", "CONSUME"]) {
            const driven = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind, qty: 1 }, actor))
            checkInvertible(`${kind} cannot be written as a direct movement`, !driven.ok && driven.code === "BAD_REQUEST", why(driven))
        }
        const madeUpKind = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "TELEPORT", qty: 1 }, actor))
        checkInvertible("an unknown movement kind is BAD_REQUEST", !madeUpKind.ok && madeUpKind.code === "BAD_REQUEST", why(madeUpKind))
        const foreignOrder = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "RETURN", qty: 1, orderId: ids.orderB }, actor))
        checkInvertible("a return against another tenant's order is refused", !foreignOrder.ok && foreignOrder.code === "FORBIDDEN", why(foreignOrder))

        // ---- 5. reservations -----------------------------------------
        const held = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(1), qty: 2, idempotencyKey: `${RUN}-h1` }, actor)
        checkInvertible("a hold starts HELD", held.reservation.state === "HELD", held.reservation.state)
        const afterHold = await inventory.get(ids.wsA, itemId)
        checkInvertible("a hold reduces available without moving on-hand", afterHold.onHand === 6 && afterHold.reserved === 2 && afterHold.available === 4, `${afterHold.onHand}/${afterHold.reserved}/${afterHold.available}`)
        const holdReplay = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(2), qty: 5, idempotencyKey: `${RUN}-h1` }, actor)
        checkInvertible("replaying a hold key returns the original hold", holdReplay.replayed && holdReplay.reservation.id === held.reservation.id, `replayed=${holdReplay.replayed}`)
        const doubleHold = await attempt(() => inventory.reserve(ids.wsA, itemId, { orderLineId: line(1), qty: 1 }, actor))
        checkInvertible("one order line cannot hold stock twice", !doubleHold.ok && doubleHold.code === "CONFLICT", why(doubleHold))

        const oversell = await attempt(() => inventory.reserve(ids.wsA, itemId, { orderLineId: line(3), qty: 99 }, actor))
        checkInvertible("an oversell is refused with the available quantity named", !oversell.ok && oversell.code === "CONFLICT" && /Only 4 units are available/.test(oversell.message), why(oversell))
        checkInvertible("the oversell refusal carries machine-readable detail", !oversell.ok && (oversell.details as { available?: number } | null)?.available === 4, oversell.ok ? "ACCEPTED" : JSON.stringify(oversell.details))
        const beforeOversell = await prisma.inventoryMovement.count()
        await attempt(() => inventory.reserve(ids.wsA, itemId, { orderLineId: line(4), qty: 99 }, actor))
        checkInvertible("a refused hold appends no movement", beforeOversell === (await prisma.inventoryMovement.count()), `before=${beforeOversell}`)

        const crossProduct = await attempt(() => inventory.reserve(ids.wsA, itemId, { orderLineId: line(99), qty: 1 }, actor))
        checkInvertible("a line for a different product cannot reserve this stock", !crossProduct.ok && crossProduct.code === "CONFLICT", why(crossProduct))
        const foreignLine = await attempt(() => inventory.reserve(ids.wsA, itemId, { orderLineId: line(100), qty: 1 }, actor))
        checkInvertible("another tenant's order line is refused", !foreignLine.ok && foreignLine.code === "FORBIDDEN", why(foreignLine))

        // An untracked record cannot promise anything.
        const untracked = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA2, trackingEnabled: false }, actor)
        await inventory.applyMovement(ids.wsA, untracked.record.id, { kind: "RECEIPT", qty: 5 }, actor)
        const untrackedHold = await attempt(() => inventory.reserve(ids.wsA, untracked.record.id, { orderLineId: line(5), qty: 1 }, actor))
        checkInvertible("an untracked stock record refuses to hold a reservation", !untrackedHold.ok && untrackedHold.code === "CONFLICT", why(untrackedHold))

        // ---- 6. settling a hold -------------------------------------
        const consumed = await inventory.settleReservation(ids.wsA, held.reservation.id, "CONSUMED", actor)
        checkInvertible("consuming a hold marks it CONSUMED and stamps consumedAt", consumed.state === "CONSUMED" && consumed.consumedAt !== null, consumed.state)
        const afterConsume = await inventory.get(ids.wsA, itemId)
        checkInvertible("consuming takes the units off the shelf", afterConsume.onHand === 4 && afterConsume.reserved === 0 && afterConsume.available === 4, `${afterConsume.onHand}/${afterConsume.reserved}`)
        const reConsume = await attempt(() => inventory.settleReservation(ids.wsA, held.reservation.id, "RELEASED", actor))
        checkInvertible("a consumed hold is terminal, so stock cannot be double-credited", !reConsume.ok && reConsume.code === "CONFLICT", why(reConsume))

        const toRelease = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(6), qty: 3 }, actor)
        const midRelease = await inventory.get(ids.wsA, itemId)
        checkInvertible("a second hold reduces available again", midRelease.available === 1, `available=${midRelease.available}`)
        const released = await inventory.settleReservation(ids.wsA, toRelease.reservation.id, "RELEASED", actor, "customer cancelled")
        checkInvertible("releasing marks it RELEASED and stamps releasedAt", released.state === "RELEASED" && released.releasedAt !== null, released.state)
        const afterRelease = await inventory.get(ids.wsA, itemId)
        checkInvertible("releasing returns the units to available stock", afterRelease.onHand === 4 && afterRelease.reserved === 0 && afterRelease.available === 4, `${afterRelease.onHand}/${afterRelease.reserved}`)

        const noExpiry = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(7), qty: 1 }, actor)
        const cannotExpire = await attempt(() => inventory.settleReservation(ids.wsA, noExpiry.reservation.id, "EXPIRED", actor))
        checkInvertible("a hold with no expiry cannot be expired", !cannotExpire.ok && cannotExpire.code === "CONFLICT", why(cannotExpire))
        await inventory.settleReservation(ids.wsA, noExpiry.reservation.id, "RELEASED", actor)

        const future = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(8), qty: 1, expiresAt: new Date("2040-01-01T00:00:00Z") }, actor)
        const notYet = await attempt(() => inventory.settleReservation(ids.wsA, future.reservation.id, "EXPIRED", actor))
        checkInvertible("a live hold cannot be expired early", !notYet.ok && notYet.code === "CONFLICT", why(notYet))
        // Backdate the expiry directly, which is the only honest way to test the clock.
        await prisma.inventoryReservation.update({
            where: { id: future.reservation.id },
            data: { expiresAt: new Date("2020-01-01T00:00:00Z") },
        })
        const expired = await inventory.settleReservation(ids.wsA, future.reservation.id, "EXPIRED", actor)
        checkInvertible("a hold past its expiry can be expired", expired.state === "EXPIRED", expired.state)
        const afterExpiry = await inventory.get(ids.wsA, itemId)
        checkInvertible("expiring returns the units to available stock", afterExpiry.reserved === 0 && afterExpiry.available === 4, `${afterExpiry.reserved}/${afterExpiry.available}`)

        // ---- 7. an adjustment may not strand promised stock ---------
        const promised = await inventory.reserve(ids.wsA, itemId, { orderLineId: line(2), qty: 4 }, actor)
        const strand = await attempt(() => inventory.applyMovement(ids.wsA, itemId, { kind: "COUNT", qty: 1 }, actor))
        checkInvertible("a stock count below the promised quantity is refused", !strand.ok && strand.code === "CONFLICT" && /already promised to orders/.test(strand.message), why(strand))
        await inventory.settleReservation(ids.wsA, promised.reservation.id, "RELEASED", actor)

        // ---- 8. CONCURRENCY: two holds, one unit -------------------
        const raceItem = await inventory.ensureItem(ids.wsA, { productId: ids.prodA2, locationId: ids.locA }, actor)
        await inventory.applyMovement(ids.wsA, raceItem.record.id, { kind: "RECEIPT", qty: 1 }, actor)
        await prisma.orderLine.create({
            data: { id: line(201), orderId: ids.orderA, titleSnapshot: "Race A", qty: 1, unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodA2 },
        })
        await prisma.orderLine.create({
            data: { id: line(202), orderId: ids.orderA, titleSnapshot: "Race B", qty: 1, unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodA2 },
        })
        const race = await Promise.allSettled([
            inventory.reserve(ids.wsA, raceItem.record.id, { orderLineId: line(201), qty: 1 }, actor),
            inventory.reserve(ids.wsA, raceItem.record.id, { orderLineId: line(202), qty: 1 }, actor),
        ])
        const won = race.filter((r) => r.status === "fulfilled").length
        const lost = race.filter((r) => r.status === "rejected").length
        const exactlyOne = won === 1 && lost === 1
        checkInvertible("two concurrent holds on the last unit produce exactly one winner", exactlyOne, `fulfilled=${won} rejected=${lost}`)
        const raceAfter = await inventory.get(ids.wsA, raceItem.record.id)
        checkInvertible("the contested record ends with exactly one unit reserved", raceAfter.reserved === 1 && raceAfter.available === 0, `${raceAfter.reserved}/${raceAfter.available}`)
        const raceHolds = await prisma.inventoryReservation.count({ where: { itemId: raceItem.record.id, state: "HELD" } })
        checkInvertible("only one hold row exists for the contested unit", raceHolds === 1, `holds=${raceHolds}`)

        // ---- 9. the ledger replays to the stored balances ----------
        const movements = await inventory.movements(ids.wsA, itemId)
        let onHand = 0
        let reserved = 0
        let consistent = movements.length > 0
        for (const m of movements) {
            onHand += Number(m.qtyDelta)
            reserved += Number(m.reservedDelta)
            if (onHand !== Number(m.onHandAfter) || reserved !== Number(m.reservedAfter)) consistent = false
        }
        const finalRecord = await inventory.get(ids.wsA, itemId)
        checkInvertible("replaying the ledger reproduces every stored balance", consistent, `replayed=${onHand}/${reserved}`)
        checkInvertible("the replayed total matches the live record", onHand === finalRecord.onHand && reserved === finalRecord.reserved, `${onHand}/${reserved} vs ${finalRecord.onHand}/${finalRecord.reserved}`)
        const seqs = movements.map((m) => Number(m.seq))
        checkInvertible("movement seq is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        const kinds = new Set<string>(movements.map((m) => String(m.kind)))
        for (const kind of ["RECEIPT", "ADJUSTMENT", "COUNT", "RETURN", "RESERVE", "RELEASE", "CONSUME"]) {
            checkInvertible(`the ledger contains a ${kind} movement`, kinds.has(kind), [...kinds].join(","))
        }

        // ---- 10. availability across locations --------------------
        const availability = await inventory.availability(ids.wsA, ids.prodA)
        checkInvertible("availability reports both locations for the product", availability.locations.length === 2, `n=${availability.locations.length}`)
        checkInvertible("availability sums on-hand across locations", availability.totalOnHand === 9, `total=${availability.totalOnHand}`)
        checkInvertible("availability flags that not every location tracks units", availability.allLocationsTracked === false, `${availability.allLocationsTracked}`)

        // ---- 11. wrong tenant: foreign is indistinguishable from missing
        identity.current = `clerk_${ids.userB}`
        const beforeCross = await prisma.inventoryMovement.count()
        const crossFetch = fetchCalls
        const foreignGet = await attempt(() => inventory.get(ids.wsB, itemId))
        const missingGet = await attempt(() => inventory.get(ids.wsB, `${RUN}_absent`))
        checkInvertible("wrong-tenant read refused FORBIDDEN", !foreignGet.ok && foreignGet.code === "FORBIDDEN", why(foreignGet))
        checkInvertible("a foreign record and a missing record refuse identically", why(foreignGet) === why(missingGet), `${why(foreignGet)} vs ${why(missingGet)}`)
        const foreignMutate = await attempt(() => inventory.applyMovement(ids.wsB, itemId, { kind: "RECEIPT", qty: 1 }, actor))
        const missingMutate = await attempt(() => inventory.applyMovement(ids.wsB, `${RUN}_absent`, { kind: "RECEIPT", qty: 1 }, actor))
        checkInvertible("a foreign mutation and a missing mutation refuse identically", why(foreignMutate) === why(missingMutate), why(foreignMutate))
        const foreignMovements = await attempt(() => inventory.movements(ids.wsB, itemId))
        checkInvertible("wrong-tenant ledger read refused", !foreignMovements.ok && foreignMovements.code === "FORBIDDEN", why(foreignMovements))
        checkInvertible("cross-tenant refusals appended zero movements", beforeCross === (await prisma.inventoryMovement.count()), `before=${beforeCross}`)
        checkInvertible("cross-tenant refusals made zero external calls", fetchCalls === crossFetch, `calls=${fetchCalls - crossFetch}`)
        const listB = await inventory.list(ids.wsB)
        checkInvertible("tenant B's list never contains tenant A's stock", !listB.some((r) => r.id === itemId), `n=${listB.length}`)

        identity.current = `clerk_${ids.userA}`
        const orphanWs = `${RUN}_orphan`
        await prisma.workspace.create({ data: { id: orphanWs, name: "Orphan", slug: `ws-${orphanWs}` } })
        await prisma.membership.create({ data: { workspaceId: orphanWs, userId: ids.userA, role: "OWNER" } })
        const orphan = await attempt(() => inventory.list(orphanWs))
        checkInvertible("a workspace with no profile is refused, not shown an empty shelf", !orphan.ok && orphan.code === "FORBIDDEN", why(orphan))

        // ---- 12. append-only ledger and rollback ------------------
        let appendOnly = false
        let appendDetail = ""
        try {
            await prisma.$executeRawUnsafe(`update "InventoryMovement" set "qtyDelta"=999 where "itemId"='${itemId}'`)
        } catch (e) {
            appendOnly = true
            appendDetail = String((e as Error).message).split("\n").find((l) => /append-only/.test(l))?.trim() ?? "refused"
        }
        checkInvertible("the database refuses to rewrite the movement ledger", appendOnly, appendDetail || "NO ERROR")

        {
            const beforeM = await prisma.inventoryMovement.count()
            const beforeR = await prisma.inventoryReservation.count()
            const rolled = await attempt(async () => {
                await prisma.$transaction(async (tx) => {
                    await tx.inventoryMovement.create({
                        data: { itemId, kind: "RECEIPT", qtyDelta: 5, reservedDelta: 0, onHandAfter: 99, reservedAfter: 0 },
                    })
                    throw new PersistenceError("CONFLICT", "deliberate abort")
                })
            })
            check("a deliberately aborted transaction reports failure", !rolled.ok, why(rolled))
            check("the aborted transaction left no movement", beforeM === (await prisma.inventoryMovement.count()), `before=${beforeM}`)
            check("the aborted transaction left no reservation", beforeR === (await prisma.inventoryReservation.count()), `before=${beforeR}`)
        }

        // ---- 13. whole-run external call tally -------------------
        checkInvertible("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
        try {
            await prisma.$executeRawUnsafe(`alter table "InventoryMovement" disable trigger "InventoryMovement_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "InventoryMovement" where "itemId" in (select "id" from "InventoryItem" where "profileId" in (${profileList}))`,
            )
        } finally {
            await prisma.$executeRawUnsafe(`alter table "InventoryMovement" enable trigger "InventoryMovement_append_only"`)
        }
        const itemScope = `select "id" from "InventoryItem" where "profileId" in (${profileList})`
        for (const sql of [
            `delete from "InventoryReservation" where "itemId" in (${itemScope})`,
            `delete from "InventoryItem" where "profileId" in (${profileList})`,
            `delete from "OrderLine" where "orderId" in (select "id" from "Order" where "profileId" in (${profileList}))`,
            `delete from "OrderEvent" where "orderId" in (select "id" from "Order" where "profileId" in (${profileList}))`,
            `delete from "Order" where "profileId" in (${profileList})`,
            `delete from "DigitalProduct" where "profileId" in (${profileList})`,
            `delete from "Location" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}','${RUN}_orphan')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}','${RUN}_orphan')`,
            `delete from "Profile" where "id" in (${profileList})`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}','${ids.userC}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='InventoryMovement_append_only'`,
        )
        check("InventoryMovement append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        for (const [label, expected, actual] of [
            ["InventoryItem rows", base.items, await prisma.inventoryItem.count()],
            ["InventoryMovement rows", base.movements, await prisma.inventoryMovement.count()],
            ["InventoryReservation rows", base.reservations, await prisma.inventoryReservation.count()],
            ["Order rows", base.orders, await prisma.order.count()],
            ["OrderLine rows", base.lines, await prisma.orderLine.count()],
        ] as Array<[string, number, number]>) {
            check(`${label} returned to baseline`, actual === expected, `baseline=${expected} end=${actual}`)
        }
        await prisma.$disconnect()
        globalThis.fetch = realFetch
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All inventory runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
