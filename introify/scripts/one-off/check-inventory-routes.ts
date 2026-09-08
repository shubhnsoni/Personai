/**
 * Wave F / F3 inventory HTTP boundary harness.
 *
 * Invokes the REAL InventoryApiService — the same object the route files under
 * src/app/api/platform/inventory/** re-export — with a controlled identity, and asserts
 * status, envelope and body for every principal class.
 *
 * Negative claims are measured, not asserted in prose:
 *   - a refusal writes no row and appends no movement (RUN-SCOPED counts before/after: the
 *     question is always about rows THIS execution owns, never about a table's global total)
 *   - a refusal reaches no external service (globalThis.fetch is replaced by a counting
 *     blocker for the whole run; any call is both counted and thrown)
 *   - a foreign record and a nonexistent record produce byte-identical responses
 *   - an oversell refusal reaches the caller with the real available quantity in its
 *     machine-readable details, because a storefront needs that number, not just a 409
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-inventory-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryApiService } from "../../src/lib/inventory/http"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"
import { countRunScopedRows, runPrefixPredicate, type RunScopeSpec } from "../lib/write-detector"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wf3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const INV = "http://127.0.0.1/api/platform/inventory"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}

// ---------------------------------------------------------------------------
// THE RESIDUE SCOPE. Every "wrote nothing" and "left nothing" assertion below is a question about
// rows THIS EXECUTION owns, never about a table's global total.
//
// A global before/after total cannot answer it, three separate ways:
//   (a) FALSE PASS BY CANCELLATION - one leaked row of ours plus one unrelated concurrent delete is
//       a delta of zero, and the old assertion reported success with real residue left behind. This
//       is the hole that mattered: it fails silently and in the safe-looking direction.
//   (b) FALSE FAILURE - an unrelated concurrent insert that stays makes a perfectly clean run red.
//   (c) VACUOUS PASS - on an empty table `0 == 0` holds without this run having cleaned up anything;
//       the baseline output of this harness was literally `baseline=0 end=0`.
//
// The scope is the unique RUN token, following check-workspace-surface-boundary.ts. InventoryItem
// rows carry it in `profileId`. Movement and reservation rows are created by the SERVICE with cuid
// ids, so they carry it indirectly: via `itemId` (a stock record of ours), or via `idempotencyKey`,
// `orderLineId` or `orderId`, all of which this harness supplies RUN-prefixed.
// ---------------------------------------------------------------------------
const CUID = /^[A-Za-z0-9_-]+$/
const ownedItems = new Set<string>()

/** Re-reads the stock records this run owns. Cheap, and correct at any point in the run. */
async function captureOwnedItems(prisma: PrismaClient): Promise<void> {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `select "id" from "InventoryItem" q where ${runPrefixPredicate("profileId", RUN)}`,
    )
    for (const row of rows) {
        if (!CUID.test(row.id)) throw new Error(`refusing to interpolate item id ${JSON.stringify(row.id)}`)
        ownedItems.add(row.id)
    }
}

/**
 * A LITERAL id list, deliberately not a subquery. Teardown DELETES the InventoryItem rows, so
 * `itemId in (select "id" from "InventoryItem" where "profileId" like '<RUN>%')` would come back
 * empty afterwards and the residue assertion would pass by having no scope left to look in - which
 * is the same vacuity this change exists to remove, just wearing a subquery.
 */
function ownedItemList(): string {
    return ownedItems.size === 0 ? `'${RUN}_no_item'` : [...ownedItems].map((id) => `'${id}'`).join(",")
}

function runScopes(): RunScopeSpec[] {
    const byItem = `"itemId" in (${ownedItemList()})`
    return [
        {
            label: "InventoryItem rows owned by this run",
            table: "InventoryItem",
            where: runPrefixPredicate("profileId", RUN),
        },
        {
            label: "InventoryMovement rows owned by this run",
            table: "InventoryMovement",
            where: `${byItem} or ${runPrefixPredicate("idempotencyKey", RUN)} or ${runPrefixPredicate("orderLineId", RUN)} or ${runPrefixPredicate("orderId", RUN)}`,
        },
        {
            label: "InventoryReservation rows owned by this run",
            table: "InventoryReservation",
            where: `${byItem} or ${runPrefixPredicate("idempotencyKey", RUN)} or ${runPrefixPredicate("orderLineId", RUN)}`,
        },
    ]
}

/** How many rows one table's run scope holds RIGHT NOW. The owned-item list is refreshed first. */
async function scopedRows(prisma: PrismaClient, table: string): Promise<number> {
    await captureOwnedItems(prisma)
    const spec = runScopes().find((s) => s.table === table)
    if (spec === undefined) throw new Error(`no run scope is declared for ${table}`)
    const [hit] = await countRunScopedRows(prisma, [spec])
    return hit.rows
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`external fetch is forbidden in this harness: ${String(args[0])}`)
}) as unknown as typeof globalThis.fetch

type Seen = { status: number; body: unknown; text: string }
async function call(res: Promise<Response>): Promise<Seen> {
    const r = await res
    const text = await r.text()
    let body: unknown = null
    try {
        body = JSON.parse(text)
    } catch {
        body = null
    }
    return { status: r.status, body, text }
}

function asRecord(v: unknown): Record<string, unknown> {
    return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function pick(v: unknown, ...path: readonly string[]): unknown {
    let cur: unknown = v
    for (const k of path) cur = asRecord(cur)[k]
    return cur
}
function pickString(v: unknown, ...path: readonly string[]): string {
    const f = pick(v, ...path)
    return typeof f === "string" ? f : ""
}
function pickNumber(v: unknown, ...path: readonly string[]): number {
    const f = pick(v, ...path)
    return typeof f === "number" ? f : Number.NaN
}
function pickArray(v: unknown, ...path: readonly string[]): readonly unknown[] {
    const f = pick(v, ...path)
    return Array.isArray(f) ? f : []
}
function keys(v: unknown): string {
    return Object.keys(asRecord(v)).sort().join(",")
}

const get = (url: string) => new Request(url)
const send = (url: string, payload: unknown, method = "POST") =>
    new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
const malformed = (url: string) =>
    new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" })

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
    const tenancy = new PersistedTenancy(prisma, identity)
    const ctx = new InventoryContext(prisma, tenancy)
    const api = new InventoryApiService(new InventoryService(ctx))

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`, userB: `${RUN}_ub`, userC: `${RUN}_uc`,
        profileA: `${RUN}_pa`, profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`, wsB: `${RUN}_wb`,
        locA: `${RUN}_la`, locB: `${RUN}_lb`,
        prodA: `${RUN}_pra`, prodB: `${RUN}_prb`,
        orderA: `${RUN}_oa`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    // GLOBAL totals. Kept, but REPORTED and never asserted on - see the residue block at the end.
    const base = { items: 0, movements: 0, reservations: 0 }
    let itemId = ""
    const line = (n: number) => `${RUN}_ol${n}`

    try {
        base.items = await prisma.inventoryItem.count()
        base.movements = await prisma.inventoryMovement.count()
        base.reservations = await prisma.inventoryReservation.count()

        for (const [u, p, w, l, pr] of [
            [ids.userA, ids.profileA, ids.wsA, ids.locA, ids.prodA],
            [ids.userB, ids.profileB, ids.wsB, ids.locB, ids.prodB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Shop ${l}` } })
            await prisma.digitalProduct.create({ data: { id: pr, profileId: p, title: `Widget ${pr}` } })
        }
        await prisma.order.create({
            data: {
                id: ids.orderA, profileId: ids.profileA, publicToken: `tok_${ids.orderA}`, number: 1,
                businessDate: new Date("2035-01-01T00:00:00Z"),
                subtotalCents: 1000, totalCents: 1000, currency: "USD",
            },
        })
        for (let n = 1; n <= 4; n += 1) {
            await prisma.orderLine.create({
                data: {
                    id: line(n), orderId: ids.orderA, titleSnapshot: "Widget", qty: 1,
                    unitPriceCents: 500, lineTotalCents: 500, productId: ids.prodA,
                },
            })
        }
        await prisma.user.create({ data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` } })

        // ---- 1. anonymous: 401 on every endpoint, zero writes -----------
        identity.current = null
        // Scoped to this run, not global: a refusal that wrote a row would write it against THIS
        // run's workspace, product and order lines, so it lands in this scope - and a concurrent
        // harness's row can neither enter it nor cancel a leak out of it.
        const beforeItems = await scopedRows(prisma, "InventoryItem")
        const beforeMoves = await scopedRows(prisma, "InventoryMovement")
        const anonFetch = fetchCalls
        const q = `workspaceId=${ids.wsA}`
        const anon = {
            list: await call(api.list(get(`${INV}?${q}`))),
            create: await call(api.create(send(INV, { workspaceId: ids.wsA, productId: ids.prodA, locationId: ids.locA }))),
            getOne: await call(api.get("whatever", get(`${INV}/whatever?${q}`))),
            availability: await call(api.availability(get(`${INV}/availability?${q}&productId=${ids.prodA}`))),
            movements: await call(api.movements("whatever", get(`${INV}/whatever/movements?${q}`))),
            applyMovement: await call(api.applyMovement("whatever", send(`${INV}/whatever/movements`, { workspaceId: ids.wsA, kind: "RECEIPT", qty: 1 }))),
            reservations: await call(api.listReservations("whatever", get(`${INV}/whatever/reservations?${q}`))),
            reserve: await call(api.reserve("whatever", send(`${INV}/whatever/reservations`, { workspaceId: ids.wsA, orderLineId: line(1) }))),
            settle: await call(api.settleReservation("whatever", "rv", send(`${INV}/whatever/reservations/rv`, { workspaceId: ids.wsA, state: "RELEASED" }, "PATCH"))),
        }
        const notUnauthorized = Object.entries(anon).filter(([, v]) => v.status !== 401).map(([k, v]) => `${k}=${v.status}`)
        check(`anonymous is 401 on all ${Object.keys(anon).length} inventory endpoints`, notUnauthorized.length === 0, notUnauthorized.join(" ") || "all 401")
        const afterAnonItems = await scopedRows(prisma, "InventoryItem")
        const afterAnonMoves = await scopedRows(prisma, "InventoryMovement")
        check("anonymous refusal wrote zero stock records", beforeItems === afterAnonItems, `prefix=${RUN} scoped ${beforeItems}->${afterAnonItems}`)
        check("anonymous refusal appended zero movements", beforeMoves === afterAnonMoves, `prefix=${RUN} scoped ${beforeMoves}->${afterAnonMoves}`)
        check("anonymous refusal made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)
        check("anonymous body is an error envelope with no data key", pick(anon.list.body, "ok") === false && pick(anon.list.body, "data") === undefined, anon.list.text.slice(0, 90))

        // ---- 2. authenticated non-member: 403 -------------------------
        identity.current = `clerk_${ids.userC}`
        const outsider = await call(api.list(get(`${INV}?${q}`)))
        const outsiderWrite = await call(api.create(send(INV, { workspaceId: ids.wsA, productId: ids.prodA, locationId: ids.locA })))
        check("authenticated non-member list is 403", outsider.status === 403, `status=${outsider.status}`)
        check("authenticated non-member create is 403", outsiderWrite.status === 403, `status=${outsiderWrite.status}`)
        const afterOutsiderItems = await scopedRows(prisma, "InventoryItem")
        check("non-member refusal wrote zero stock records", beforeItems === afterOutsiderItems, `prefix=${RUN} scoped ${beforeItems}->${afterOutsiderItems}`)

        // ---- 3. valid member opens a stock record --------------------
        identity.current = `clerk_${ids.userA}`
        const created = await call(api.create(send(INV, {
            workspaceId: ids.wsA, productId: ids.prodA, locationId: ids.locA, reorderPoint: 2,
        })))
        check("stock record create is 201", created.status === 201, `status=${created.status}`)
        itemId = pickString(created.body, "data", "item", "id")
        check("a new record reports zero on hand, reserved and available", pickNumber(created.body, "data", "item", "onHand") === 0 && pickNumber(created.body, "data", "item", "available") === 0, created.text.slice(0, 100))
        check("a new record is flagged below its reorder point", pick(created.body, "data", "item", "belowReorderPoint") === true, created.text.slice(0, 120))
        const replay = await call(api.create(send(INV, { workspaceId: ids.wsA, productId: ids.prodA, locationId: ids.locA })))
        check("re-creating the same pair is 200, not 201", replay.status === 200, `status=${replay.status}`)
        check("the replay returns the original record", pickString(replay.body, "data", "item", "id") === itemId && pick(replay.body, "data", "replayed") === true, `id=${pickString(replay.body, "data", "item", "id")}`)

        const foreignProduct = await call(api.create(send(INV, { workspaceId: ids.wsA, productId: ids.prodB, locationId: ids.locA })))
        check("another tenant's product is 403", foreignProduct.status === 403, `status=${foreignProduct.status}`)
        const missingParam = await call(api.list(get(INV)))
        check("a missing workspaceId query parameter is 400", missingParam.status === 400, `status=${missingParam.status}`)
        const badBody = await call(api.create(malformed(INV)))
        check("a malformed JSON body is 400", badBody.status === 400, `status=${badBody.status}`)
        const missingProduct = await call(api.create(send(INV, { workspaceId: ids.wsA, locationId: ids.locA })))
        check("a missing productId is 400", missingProduct.status === 400, `status=${missingProduct.status}`)

        // ---- 4. movements -------------------------------------------
        const received = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, {
            workspaceId: ids.wsA, kind: "RECEIPT", qty: 5, idempotencyKey: `${RUN}-r1`,
        })))
        check("a receipt is 200 and reports the new balance", received.status === 200 && pickNumber(received.body, "data", "item", "onHand") === 5, `status=${received.status}`)
        const receiptReplay = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, {
            workspaceId: ids.wsA, kind: "RECEIPT", qty: 999, idempotencyKey: `${RUN}-r1`,
        })))
        check("replaying a receipt key does not apply it twice", pickNumber(receiptReplay.body, "data", "item", "onHand") === 5, `onHand=${pickNumber(receiptReplay.body, "data", "item", "onHand")}`)
        const badKind = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, { workspaceId: ids.wsA, kind: "TELEPORT", qty: 1 })))
        check("an unknown movement kind is 400", badKind.status === 400, `status=${badKind.status}`)
        const drivenKind = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, { workspaceId: ids.wsA, kind: "RESERVE", qty: 1 })))
        check("RESERVE cannot be written as a direct movement, and that is 400", drivenKind.status === 400, `status=${drivenKind.status}`)
        const nonIntQty = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, { workspaceId: ids.wsA, kind: "RECEIPT", qty: "five" })))
        check("a non-integer qty is 400", nonIntQty.status === 400, `status=${nonIntQty.status}`)
        const tooFar = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, { workspaceId: ids.wsA, kind: "ADJUSTMENT", qty: -99 })))
        check("an adjustment below zero is 409", tooFar.status === 409, `status=${tooFar.status}`)
        check("the 409 names the real balance", /only 5 are present/.test(tooFar.text), tooFar.text.slice(0, 140))

        // ---- 5. reservations ---------------------------------------
        const held = await call(api.reserve(itemId, send(`${INV}/${itemId}/reservations`, {
            workspaceId: ids.wsA, orderLineId: line(1), qty: 3, idempotencyKey: `${RUN}-h1`,
        })))
        check("a hold is 201 and starts HELD", held.status === 201 && pickString(held.body, "data", "reservation", "state") === "HELD", `status=${held.status}`)
        const reservationId = pickString(held.body, "data", "reservation", "id")
        const afterHold = await call(api.get(itemId, get(`${INV}/${itemId}?${q}`)))
        check("a hold reduces available without moving on-hand", pickNumber(afterHold.body, "data", "item", "onHand") === 5 && pickNumber(afterHold.body, "data", "item", "available") === 2, afterHold.text.slice(0, 120))
        const holdReplay = await call(api.reserve(itemId, send(`${INV}/${itemId}/reservations`, {
            workspaceId: ids.wsA, orderLineId: line(2), qty: 1, idempotencyKey: `${RUN}-h1`,
        })))
        check("replaying a hold key is 200 and returns the original", holdReplay.status === 200 && pickString(holdReplay.body, "data", "reservation", "id") === reservationId, `status=${holdReplay.status}`)

        const oversell = await call(api.reserve(itemId, send(`${INV}/${itemId}/reservations`, { workspaceId: ids.wsA, orderLineId: line(3), qty: 99 })))
        check("an oversell is 409", oversell.status === 409, `status=${oversell.status}`)
        // This matters more than the status: a storefront needs the number, not just a no.
        check(
            "the oversell response carries the real available quantity in machine-readable detail",
            pickNumber(oversell.body, "error", "details", "available") === 2,
            oversell.text.slice(0, 160),
        )
        const beforeOversell = await scopedRows(prisma, "InventoryMovement")
        await call(api.reserve(itemId, send(`${INV}/${itemId}/reservations`, { workspaceId: ids.wsA, orderLineId: line(4), qty: 99 })))
        const afterOversell = await scopedRows(prisma, "InventoryMovement")
        // Non-vacuous by construction: by this point the scope holds this run's real movement rows,
        // so it is being asked to notice one MORE row among several, not to compare 0 with 0.
        check("a refused hold appends no movement", beforeOversell === afterOversell, `prefix=${RUN} scoped ${beforeOversell}->${afterOversell}`)

        const badState = await call(api.settleReservation(itemId, reservationId, send(`${INV}/${itemId}/reservations/${reservationId}`, { workspaceId: ids.wsA, state: "VANISHED" }, "PATCH")))
        check("an unknown reservation state is 400 not 409", badState.status === 400, `status=${badState.status}`)
        const cannotExpire = await call(api.settleReservation(itemId, reservationId, send(`${INV}/${itemId}/reservations/${reservationId}`, { workspaceId: ids.wsA, state: "EXPIRED" }, "PATCH")))
        check("expiring a hold with no expiry is 409", cannotExpire.status === 409, `status=${cannotExpire.status}`)
        const consumed = await call(api.settleReservation(itemId, reservationId, send(`${INV}/${itemId}/reservations/${reservationId}`, { workspaceId: ids.wsA, state: "CONSUMED" }, "PATCH")))
        check("consuming a hold is 200", consumed.status === 200, `status=${consumed.status}`)
        const afterConsume = await call(api.get(itemId, get(`${INV}/${itemId}?${q}`)))
        check("consuming takes the units off the shelf", pickNumber(afterConsume.body, "data", "item", "onHand") === 2 && pickNumber(afterConsume.body, "data", "item", "reserved") === 0, afterConsume.text.slice(0, 120))
        const reSettle = await call(api.settleReservation(itemId, reservationId, send(`${INV}/${itemId}/reservations/${reservationId}`, { workspaceId: ids.wsA, state: "RELEASED" }, "PATCH")))
        check("a settled hold cannot be settled again", reSettle.status === 409, `status=${reSettle.status}`)

        const reservationList = await call(api.listReservations(itemId, get(`${INV}/${itemId}/reservations?${q}`)))
        check("the reservation list exposes server-computed allowedTransitions", pickArray(pickArray(reservationList.body, "data", "reservations")[0], "allowedTransitions").length === 0, JSON.stringify(pickArray(pickArray(reservationList.body, "data", "reservations")[0], "allowedTransitions")))

        // ---- 6. availability and the ledger -----------------------
        const availability = await call(api.availability(get(`${INV}/availability?${q}&productId=${ids.prodA}`)))
        check("availability is 200 and aggregates the product", availability.status === 200 && pickNumber(availability.body, "data", "availability", "totalOnHand") === 2, availability.text.slice(0, 140))
        const missingProductParam = await call(api.availability(get(`${INV}/availability?${q}`)))
        check("availability without a productId is 400", missingProductParam.status === 400, `status=${missingProductParam.status}`)

        const movements = await call(api.movements(itemId, get(`${INV}/${itemId}/movements?${q}`)))
        const rows = pickArray(movements.body, "data", "movements")
        const seqs = rows.map((m) => Number(pickString(m, "seq")))
        check("the ledger is returned in sequence order", seqs.length > 0 && seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        check("ledger seq serialises as a string not a BigInt", rows.length > 0 && rows.every((m) => typeof pick(m, "seq") === "string"), typeof pick(rows[0], "seq"))
        let onHand = 0
        let reserved = 0
        let consistent = rows.length > 0
        for (const m of rows) {
            onHand += pickNumber(m, "qtyDelta")
            reserved += pickNumber(m, "reservedDelta")
            if (onHand !== pickNumber(m, "onHandAfter") || reserved !== pickNumber(m, "reservedAfter")) consistent = false
        }
        check("replaying the returned ledger reproduces the stored balances", consistent, `replayed=${onHand}/${reserved}`)

        // ---- 7. wrong tenant is indistinguishable from nonexistent
        identity.current = `clerk_${ids.userB}`
        const beforeForeign = await scopedRows(prisma, "InventoryMovement")
        const foreignFetch = fetchCalls
        const qb = `workspaceId=${ids.wsB}`
        const foreign = await call(api.get(itemId, get(`${INV}/${itemId}?${qb}`)))
        const absent = await call(api.get(`${RUN}_absent`, get(`${INV}/${RUN}_absent?${qb}`)))
        check("wrong-tenant get is 403", foreign.status === 403, `status=${foreign.status}`)
        // This is the single inverted assertion.
        const identical = INVERT
            ? foreign.text !== absent.text
            : foreign.status === absent.status && foreign.text === absent.text
        check("a foreign record and a nonexistent record are byte-identical", identical, `${foreign.status}:${foreign.text} vs ${absent.status}:${absent.text}`)
        const foreignMutate = await call(api.applyMovement(itemId, send(`${INV}/${itemId}/movements`, { workspaceId: ids.wsB, kind: "RECEIPT", qty: 1 })))
        const absentMutate = await call(api.applyMovement(`${RUN}_absent`, send(`${INV}/${RUN}_absent/movements`, { workspaceId: ids.wsB, kind: "RECEIPT", qty: 1 })))
        check("a foreign mutation and a nonexistent mutation are byte-identical", foreignMutate.status === absentMutate.status && foreignMutate.text === absentMutate.text, `${foreignMutate.status}/${absentMutate.status}`)
        const foreignLedger = await call(api.movements(itemId, get(`${INV}/${itemId}/movements?${qb}`)))
        check("wrong-tenant ledger read is 403 and leaks no balances", foreignLedger.status === 403 && !/onHandAfter/.test(foreignLedger.text), foreignLedger.text.slice(0, 90))
        const afterForeign = await scopedRows(prisma, "InventoryMovement")
        check("cross-tenant refusal appended zero movements", beforeForeign === afterForeign, `prefix=${RUN} scoped ${beforeForeign}->${afterForeign}`)
        check("cross-tenant refusal made zero external calls", fetchCalls === foreignFetch, `calls=${fetchCalls - foreignFetch}`)
        const listB = await call(api.list(get(`${INV}?${qb}`)))
        check("tenant B's list never contains tenant A's stock", !pickArray(listB.body, "data", "items").some((i) => pickString(i, "id") === itemId), `n=${pickArray(listB.body, "data", "items").length}`)

        // ---- 8. dependency failure is 503 with no leak -----------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: { findUnique: async () => ({ profileId: ids.profileA }) },
            inventoryItem: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenApi = new InventoryApiService(new InventoryService(new InventoryContext(brokenPrisma, tenancy)))
        const broken = await call(brokenApi.list(get(`${INV}?${q}`)))
        check("dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        check("dependency failure leaks no internal detail", !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text), broken.text.slice(0, 120))

        // ---- 9. envelope agrees with the platform contract -------
        const listA = await call(api.list(get(`${INV}?${q}`)))
        check("success envelope keys are exactly ok,data", keys(listA.body) === "data,ok", keys(listA.body))
        check("error envelope keys are exactly error,ok", keys(anon.list.body) === "error,ok", keys(anon.list.body))
        check(
            "every error envelope carries a code and a message",
            [anon.list, outsider, foreign, tooFar, badKind, broken].every(
                (r) => pickString(r.body, "error", "code") !== "" && pickString(r.body, "error", "message") !== "",
            ),
            "codes present",
        )

        // ---- 10. whole-run external call tally ------------------
        check("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
        // The residue scope is captured BEFORE teardown, while the fixture still exists. Movement and
        // reservation rows point at this run's stock records by cuid, and teardown deletes those
        // records - so the id list has to be taken now or the scope would have nothing to match on.
        await captureOwnedItems(prisma)
        const inWindow = await countRunScopedRows(prisma, runScopes())

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
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Profile" where "id" in (${profileList})`,
            `delete from "User" where "id" in ('${ids.userA}','${ids.userB}','${ids.userC}')`,
        ]) {
            await prisma.$executeRawUnsafe(sql)
        }

        const armed = await prisma.$queryRawUnsafe<{ n: number }[]>(
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name='InventoryMovement_append_only'`,
        )
        check("InventoryMovement append-only trigger re-armed", Number(armed[0].n) >= 1, `triggers=${armed[0].n}`)

        // ---- 11. residue, scoped to THIS execution --------------------
        //
        // WHAT THIS REPLACED: three assertions of the form
        //   check(`${label} returned to baseline`, globalCountNow === globalCountAtStart)
        // which compared a table's GLOBAL total before and after the run. That is unsound by
        // cancellation (our leak plus an unrelated concurrent delete is a delta of zero and the
        // assertion says PASS), unsound by concurrency (an unrelated insert fails a clean run), and
        // vacuous on an empty table (`baseline=0 end=0` proved nothing about this run at all).
        //
        // What is asserted now: zero rows remain in the scope THIS RUN owns. No other execution can
        // put a row into that scope, and no other execution can remove one from it, so the number
        // cannot be moved - in either direction - by anything but this harness.
        const residue = await countRunScopedRows(prisma, runScopes())
        for (const hit of residue) {
            check(`${hit.label}: zero remain after teardown`, hit.rows === 0, `prefix=${RUN} rows=${hit.rows}`)
        }
        // ANTI-VACUITY. The scope above must be one that could have failed: it has to have seen this
        // run's own rows while they existed. Without this, deleting the fixture and then asserting
        // "nothing of mine is left" would be satisfied by a scope that never matched anything.
        const inWindowSeen = inWindow.filter((h) => h.rows > 0)
        check(
            "the residue scope demonstrably held this run's own rows before teardown, so zero-after is not vacuous",
            inWindowSeen.length === inWindow.length,
            `prefix=${RUN} in-window ${inWindow.map((h) => `${h.table}=${h.rows}`).join(",")}`,
        )
        // REPORTED, NEVER ASSERTED. These are the numbers the old assertions used. They move for
        // reasons that have nothing to do with this harness, which is precisely why they are printed
        // rather than checked - and printing them is what makes a cancellation visible: a global
        // delta of zero next to a non-zero scoped residue is the false pass this change removes.
        const globalEnd = {
            items: await prisma.inventoryItem.count(),
            movements: await prisma.inventoryMovement.count(),
            reservations: await prisma.inventoryReservation.count(),
        }
        console.log(
            `REPORT  GLOBAL row totals (the old mechanism's signal, NOT asserted on): ` +
                `InventoryItem ${base.items}->${globalEnd.items}, ` +
                `InventoryMovement ${base.movements}->${globalEnd.movements}, ` +
                `InventoryReservation ${base.reservations}->${globalEnd.reservations}`,
        )
        console.log(`RUN_PREFIX=${RUN}`)
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
    console.log("All inventory route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
