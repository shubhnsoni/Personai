/**
 * Wave G / G1.2 commerce runtime harness.
 *
 * Exercises the REAL VariantService, FulfilmentService and ReturnService — composed with the
 * REAL InventoryService — against the authorized disposable rehearsal database with a
 * controlled identity.
 *
 * The claims that are MEASURED rather than described:
 *   - two CONCURRENT reservations for the last unit of a VARIANT produce exactly one winner,
 *     run as real parallel transactions
 *   - shipping consumes the hold, so stock leaves at SHIPPED and not at pack time
 *   - restocking an accepted return twice credits stock ONCE
 *   - a refusal writes no row and appends no commerce event
 *   - nothing external is contacted: globalThis.fetch is a counting blocker for the run
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-commerce-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { FulfilmentService } from "../../src/lib/commerce/fulfilment"
import {
    FULFILMENT_STATES,
    RESTOCK_STATES,
    RETURN_STATES,
    fulfilmentFlow,
    restockFlow,
    returnFlow,
} from "../../src/lib/commerce/lifecycle"
import { ReturnService } from "../../src/lib/commerce/returns"
import { CommerceContext, type CommerceActor } from "../../src/lib/commerce/shared"
import { VariantService } from "../../src/lib/commerce/variants"
import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`.slice(0, 170)
}

const actor: CommerceActor = Object.freeze({ actorType: "STAFF", actorId: null })
const invActor = Object.freeze({ actorType: "STAFF" as const, actorId: null })

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
    const inventory = new InventoryService(new InventoryContext(prisma, tenancy))
    const ctx = new CommerceContext(prisma, tenancy)
    const variants = new VariantService(ctx)
    const fulfilments = new FulfilmentService(ctx, inventory)
    const returns = new ReturnService(ctx, inventory)

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
        prodA: `${RUN}_pra`, prodA2: `${RUN}_pra2`, prodB: `${RUN}_prb`,
        orderA: `${RUN}_oa`, orderB: `${RUN}_ob`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = { variants: 0, options: 0, fulfilments: 0, returns: 0, events: 0, items: 0, movements: 0 }
    const line = (n: number) => `${RUN}_ol${n}`

    try {
        base.variants = await prisma.productVariant.count()
        base.options = await prisma.productOption.count()
        base.fulfilments = await prisma.fulfilment.count()
        base.returns = await prisma.returnRequest.count()
        base.events = await prisma.commerceEvent.count()
        base.items = await prisma.inventoryItem.count()
        base.movements = await prisma.inventoryMovement.count()

        // ---- 0. lifecycle tables are total and outcome-terminal -----------
        const flows: Array<{ label: string; all: readonly string[]; can: (a: string, b: string) => boolean }> = [
            { label: "fulfilment", all: FULFILMENT_STATES, can: (a, b) => fulfilmentFlow.can(a as never, b as never) },
            { label: "return", all: RETURN_STATES, can: (a, b) => returnFlow.can(a as never, b as never) },
            { label: "restock", all: RESTOCK_STATES, can: (a, b) => restockFlow.can(a as never, b as never) },
        ]
        for (const { label, all, can } of flows) {
            let legal = 0
            let illegal = 0
            for (const from of all) {
                for (const to of all) {
                    if (can(from, to)) legal += 1
                    else illegal += 1
                }
            }
            check(`${label} transition table is total over ${all.length}x${all.length} pairs`, legal + illegal === all.length ** 2, `legal=${legal} illegal=${illegal}`)
        }
        check("a shipped shipment cannot be cancelled, only delivered", !fulfilmentFlow.can("SHIPPED", "CANCELLED") && fulfilmentFlow.can("SHIPPED", "DELIVERED"))
        check("delivered and cancelled shipments are terminal", fulfilmentFlow.isTerminal("DELIVERED") && fulfilmentFlow.isTerminal("CANCELLED"))
        check("every return outcome is terminal", returnFlow.isTerminal("REJECTED") && returnFlow.isTerminal("RECEIVED") && returnFlow.isTerminal("CANCELLED"))
        check("both restock outcomes are terminal", restockFlow.isTerminal("RESTOCKED") && restockFlow.isTerminal("DISCARDED"))

        // ---- seed two tenants with catalogues and orders ----------------
        for (const [u, p, w, l, pr, o] of [
            [ids.userA, ids.profileA, ids.wsA, ids.locA, ids.prodA, ids.orderA],
            [ids.userB, ids.profileB, ids.wsB, ids.locB, ids.prodB, ids.orderB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Shop ${l}` } })
            await prisma.digitalProduct.create({ data: { id: pr, profileId: p, title: `Widget ${pr}`, priceCents: 2500, sku: `${pr}-SKU` } })
            await prisma.order.create({
                data: {
                    id: o, profileId: p, publicToken: `tok_${o}`, number: 1,
                    businessDate: new Date("2035-01-01T00:00:00Z"),
                    subtotalCents: 5000, totalCents: 5000, currency: "USD",
                },
            })
        }
        await prisma.digitalProduct.create({ data: { id: ids.prodA2, profileId: ids.profileA, title: "Second", priceCents: 100 } })
        await prisma.user.create({ data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` } })
        for (let n = 1; n <= 6; n += 1) {
            const qty = n === 1 ? 5 : 1
            await prisma.orderLine.create({
                data: {
                    id: line(n), orderId: ids.orderA, titleSnapshot: `Line ${n}`, qty,
                    // OrderLine carries a pre-existing OrderLine_amounts_check constraint, so
                    // the line total must actually equal qty x unit price.
                    unitPriceCents: 1000, lineTotalCents: qty * 1000, productId: ids.prodA,
                },
            })
        }
        await prisma.orderLine.create({
            data: { id: line(90), orderId: ids.orderB, titleSnapshot: "Foreign", qty: 1, unitPriceCents: 1, lineTotalCents: 1, productId: ids.prodB },
        })

        // ---- 1. anonymous and non-member are refused, nothing written ----
        identity.current = null
        const beforeVariants = await prisma.productVariant.count()
        const beforeEvents = await prisma.commerceEvent.count()
        const anonFetch = fetchCalls
        const anonVariant = await attempt(() => variants.create(ids.wsA, ids.prodA, { title: "X" }, actor))
        const anonFulfil = await attempt(() => fulfilments.create(ids.wsA, { orderId: ids.orderA, reference: "F" }, actor))
        const anonReturn = await attempt(() => returns.request(ids.wsA, { orderId: ids.orderA, reference: "R" }, actor))
        check("anonymous variant create refused UNAUTHORIZED", !anonVariant.ok && anonVariant.code === "UNAUTHORIZED", why(anonVariant))
        check("anonymous shipment create refused UNAUTHORIZED", !anonFulfil.ok && anonFulfil.code === "UNAUTHORIZED", why(anonFulfil))
        check("anonymous return request refused UNAUTHORIZED", !anonReturn.ok && anonReturn.code === "UNAUTHORIZED", why(anonReturn))
        check("anonymous wrote zero variants", beforeVariants === (await prisma.productVariant.count()), `before=${beforeVariants}`)
        check("anonymous appended zero commerce events", beforeEvents === (await prisma.commerceEvent.count()), `before=${beforeEvents}`)
        check("anonymous made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)

        identity.current = `clerk_${ids.userC}`
        const outsider = await attempt(() => variants.list(ids.wsA, ids.prodA))
        check("authenticated non-member refused FORBIDDEN", !outsider.ok && outsider.code === "FORBIDDEN", why(outsider))

        // ---- 2. the default variant is created on demand, once ----------
        identity.current = `clerk_${ids.userA}`
        const firstDefault = await inventory.ensureDefaultVariant(ids.profileA, ids.prodA)
        check("the default variant id follows the migration's convention", firstDefault === `var_${ids.prodA}`, firstDefault)
        const secondDefault = await inventory.ensureDefaultVariant(ids.profileA, ids.prodA)
        check("resolving the default variant twice returns the same row", secondDefault === firstDefault, secondDefault)
        const defaultRow = await prisma.productVariant.findUnique({ where: { id: firstDefault } })
        check("the default variant inherits the product price rather than copying it", defaultRow?.priceCents === null, `${defaultRow?.priceCents}`)
        check("the default variant carries the product sku", defaultRow?.sku === `${ids.prodA}-SKU`, `${defaultRow?.sku}`)
        const defaultCount = await prisma.productVariant.count({ where: { productId: ids.prodA, isDefault: true } })
        check("exactly one default variant exists for the product", defaultCount === 1, `n=${defaultCount}`)

        // ---- 3. options, values and variants ---------------------------
        const option = await variants.addOption(ids.wsA, ids.prodA, { name: "Size", values: ["S", "M", "L"] }, actor)
        const optionRows = await variants.listOptions(ids.wsA, ids.prodA)
        check("the option was created with its three values", optionRows.length === 1 && optionRows[0].values.length === 3, `values=${optionRows[0]?.values.length}`)
        const dupOption = await attempt(() => variants.addOption(ids.wsA, ids.prodA, { name: "Size" }, actor))
        check("a duplicate option name on one product is refused", !dupOption.ok && dupOption.code === "CONFLICT", why(dupOption))
        const dupValues = await attempt(() => variants.addOption(ids.wsA, ids.prodA, { name: "Colour", values: ["Red", "Red"] }, actor))
        check("repeated option values are refused before anything is written", !dupValues.ok && dupValues.code === "CONFLICT", why(dupValues))
        const dupValue = await attempt(() => variants.addOptionValue(ids.wsA, option.id, { value: "M" }, actor))
        check("a duplicate value on one option is refused", !dupValue.ok && dupValue.code === "CONFLICT", why(dupValue))

        const sizeS = optionRows[0].values.find((v) => v.value === "S")!
        const sizeM = optionRows[0].values.find((v) => v.value === "M")!
        const small = await variants.create(
            ids.wsA, ids.prodA,
            { title: "Small", sku: `${RUN}-S`, priceCents: 1800, optionValueIds: [sizeS.id], idempotencyKey: `${RUN}-v1` },
            actor,
        )
        check("a variant was created with its own price", small.record.priceCents === 1800 && small.record.effectivePriceCents === 1800, `${small.record.priceCents}`)
        check("a created variant is never the default", small.record.isDefault === false)
        const replay = await variants.create(ids.wsA, ids.prodA, { title: "Different", idempotencyKey: `${RUN}-v1` }, actor)
        check("variant replay returns the original", replay.replayed && replay.record.id === small.record.id, `replayed=${replay.replayed}`)
        const dupSku = await attempt(() => variants.create(ids.wsA, ids.prodA, { title: "Clash", sku: `${RUN}-S` }, actor))
        check("a duplicate sku within a profile is refused", !dupSku.ok && dupSku.code === "CONFLICT", why(dupSku))
        const otherProfileSku = await attempt(async () => {
            identity.current = `clerk_${ids.userB}`
            const r = await variants.create(ids.wsB, ids.prodB, { title: "Same sku other tenant", sku: `${RUN}-S` }, actor)
            identity.current = `clerk_${ids.userA}`
            return r
        })
        check("the SAME sku is allowed in a different profile", otherProfileSku.ok, why(otherProfileSku))
        identity.current = `clerk_${ids.userA}`

        const twoValuesOneOption = await attempt(() =>
            variants.create(ids.wsA, ids.prodA, { title: "Ambiguous", optionValueIds: [sizeS.id, sizeM.id] }, actor),
        )
        check("a variant selecting two values of one option is refused", !twoValuesOneOption.ok && twoValuesOneOption.code === "CONFLICT", why(twoValuesOneOption))
        const inheriting = await variants.create(ids.wsA, ids.prodA, { title: "Medium", optionValueIds: [sizeM.id] }, actor)
        check("a variant with no price inherits the product's", inheriting.record.priceCents === null && inheriting.record.effectivePriceCents === 2500, `${inheriting.record.effectivePriceCents}`)
        const negativePrice = await attempt(() => variants.create(ids.wsA, ids.prodA, { title: "Bad", priceCents: -5 }, actor))
        check("a negative variant price is BAD_REQUEST", !negativePrice.ok && negativePrice.code === "BAD_REQUEST", why(negativePrice))
        const foreignProduct = await attempt(() => variants.create(ids.wsA, ids.prodB, { title: "Nope" }, actor))
        check("creating a variant on another tenant's product is refused", !foreignProduct.ok && foreignProduct.code === "FORBIDDEN", why(foreignProduct))

        const renamed = await variants.update(ids.wsA, small.record.id, { title: "Small (UK)" }, actor)
        check("a variant can be renamed", renamed.title === "Small (UK)", renamed.title)
        const cleared = await variants.update(ids.wsA, small.record.id, { clearPrice: true }, actor)
        check("clearing a variant price makes it inherit again", cleared.priceCents === null && cleared.effectivePriceCents === 2500, `${cleared.effectivePriceCents}`)
        const noop = await attempt(() => variants.update(ids.wsA, small.record.id, {}, actor))
        check("an update with no fields is BAD_REQUEST", !noop.ok && noop.code === "BAD_REQUEST", why(noop))

        // ---- 4. variant-aware stock and concurrency -------------------
        const stockSmall = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, variantId: small.record.id, locationId: ids.locA }, invActor)
        const stockMedium = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, variantId: inheriting.record.id, locationId: ids.locA }, invActor)
        check("two variants of one product hold separate stock at one location", stockSmall.record.id !== stockMedium.record.id, `${stockSmall.record.id} vs ${stockMedium.record.id}`)
        const stockDefault = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA }, invActor)
        check("omitting variantId resolves the default variant, so Wave F callers still work", stockDefault.record.variantId === firstDefault, stockDefault.record.variantId)
        const foreignVariantStock = await attempt(() =>
            inventory.ensureItem(ids.wsA, { productId: ids.prodA2, variantId: small.record.id, locationId: ids.locA }, invActor),
        )
        check("a variant of a different product cannot be given that product's stock", !foreignVariantStock.ok && foreignVariantStock.code === "FORBIDDEN", why(foreignVariantStock))

        await inventory.applyMovement(ids.wsA, stockSmall.record.id, { kind: "RECEIPT", qty: 1 }, invActor)
        const race = await Promise.allSettled([
            inventory.reserve(ids.wsA, stockSmall.record.id, { orderLineId: line(2), qty: 1 }, invActor),
            inventory.reserve(ids.wsA, stockSmall.record.id, { orderLineId: line(3), qty: 1 }, invActor),
        ])
        const won = race.filter((r) => r.status === "fulfilled").length
        // This is the single inverted assertion: variant-level stock must still be sellable
        // exactly once, measured with genuinely parallel transactions.
        const exactlyOne = INVERT ? won !== 1 : won === 1 && race.length - won === 1
        check("two concurrent holds on the last unit of a VARIANT produce exactly one winner", exactlyOne, `fulfilled=${won} rejected=${race.length - won}`)
        const afterRace = await inventory.get(ids.wsA, stockSmall.record.id)
        check("the contested variant ends with one unit reserved and none available", afterRace.reserved === 1 && afterRace.available === 0, `${afterRace.reserved}/${afterRace.available}`)

        const deactivateHeld = await attempt(() => variants.update(ids.wsA, small.record.id, { isActive: false }, actor))
        check("a variant with stock promised to orders cannot be deactivated", !deactivateHeld.ok && deactivateHeld.code === "CONFLICT" && /1 units promised/.test(deactivateHeld.message), why(deactivateHeld))

        // ---- 5. fulfilment, partial and guarded ----------------------
        const shipment = await fulfilments.create(ids.wsA, { orderId: ids.orderA, reference: `${RUN}-F1`, locationId: ids.locA, idempotencyKey: `${RUN}-f1` }, actor)
        check("a shipment starts DRAFT", shipment.fulfilment.state === "DRAFT", shipment.fulfilment.state)
        const shipReplay = await fulfilments.create(ids.wsA, { orderId: ids.orderA, reference: `${RUN}-OTHER`, idempotencyKey: `${RUN}-f1` }, actor)
        check("shipment replay returns the original", shipReplay.replayed && shipReplay.fulfilment.id === shipment.fulfilment.id, `replayed=${shipReplay.replayed}`)
        const dupRef = await attempt(() => fulfilments.create(ids.wsA, { orderId: ids.orderA, reference: `${RUN}-F1` }, actor))
        check("a duplicate shipment reference within a profile is refused", !dupRef.ok && dupRef.code === "CONFLICT", why(dupRef))
        const foreignOrder = await attempt(() => fulfilments.create(ids.wsA, { orderId: ids.orderB, reference: `${RUN}-X` }, actor))
        check("a shipment against another tenant's order is refused", !foreignOrder.ok && foreignOrder.code === "FORBIDDEN", why(foreignOrder))

        const packEmpty = await attempt(() => fulfilments.transition(ids.wsA, shipment.fulfilment.id, "PACKED", actor))
        check("a shipment with no lines cannot be packed", !packEmpty.ok && packEmpty.code === "CONFLICT", why(packEmpty))

        // Line 1 was ordered 5. Ship 2, then 3, then refuse a 6th.
        await fulfilments.addItem(ids.wsA, shipment.fulfilment.id, { orderLineId: line(1), variantId: small.record.id, qty: 2 }, actor)
        const allocPartial = await fulfilments.allocations(ids.wsA, ids.orderA)
        const l1 = allocPartial.find((a) => a.orderLineId === line(1))!
        check("partial allocation is reported, not rounded up", l1.ordered === 5 && l1.allocated === 2 && l1.remaining === 3, `${l1.allocated}/${l1.ordered} remaining=${l1.remaining}`)
        check("nothing counts as fulfilled until it ships", l1.fulfilled === 0, `fulfilled=${l1.fulfilled}`)
        const overAllocate = await attempt(() =>
            fulfilments.addItem(ids.wsA, shipment.fulfilment.id, { orderLineId: line(4), qty: 99 }, actor),
        )
        check("shipping more than a line ordered is refused with the remaining quantity named", !overAllocate.ok && /Only 1 units of that line are still unshipped/.test(overAllocate.message), why(overAllocate))
        const dupLine = await attempt(() =>
            fulfilments.addItem(ids.wsA, shipment.fulfilment.id, { orderLineId: line(1), qty: 1 }, actor),
        )
        check("one order line cannot appear twice on one shipment", !dupLine.ok && dupLine.code === "CONFLICT", why(dupLine))

        // Whichever line won the race holds the last unit. Put THAT line on the shipment
        // while it is still a draft, rather than guessing, so consumption is deterministic.
        const heldReservation = await prisma.inventoryReservation.findFirst({
            where: { itemId: stockSmall.record.id, state: "HELD" },
            select: { id: true, orderLineId: true },
        })
        check("the race left exactly one hold to consume", heldReservation !== null, `${heldReservation?.orderLineId}`)
        if (heldReservation) {
            await fulfilments.addItem(
                ids.wsA,
                shipment.fulfilment.id,
                { orderLineId: heldReservation.orderLineId, variantId: small.record.id, qty: 1 },
                actor,
            )
        }
        const atDraft = await inventory.get(ids.wsA, stockSmall.record.id)
        check("adding lines to a draft shipment does not move stock", atDraft.onHand === 1 && atDraft.reserved === 1, `${atDraft.onHand}/${atDraft.reserved}`)
        const foreignLine = await attempt(() =>
            fulfilments.addItem(ids.wsA, shipment.fulfilment.id, { orderLineId: line(90), qty: 1 }, actor),
        )
        check("another tenant's order line cannot be shipped", !foreignLine.ok && foreignLine.code === "FORBIDDEN", why(foreignLine))

        await fulfilments.transition(ids.wsA, shipment.fulfilment.id, "PACKED", actor)
        const addAfterPack = await attempt(() =>
            fulfilments.addItem(ids.wsA, shipment.fulfilment.id, { orderLineId: line(5), qty: 1 }, actor),
        )
        check("a packed shipment cannot gain new lines", !addAfterPack.ok && addAfterPack.code === "CONFLICT", why(addAfterPack))

        // Stock must NOT have moved at pack time.
        const atPack = await inventory.get(ids.wsA, stockSmall.record.id)
        check("packing does not move stock, because the goods are still on the shelf", atPack.onHand === 1 && atPack.reserved === 1, `${atPack.onHand}/${atPack.reserved}`)

        // Line 2 holds one unit of the small variant. Ship it and the hold is consumed.
        await fulfilments.transition(ids.wsA, shipment.fulfilment.id, "SHIPPED", actor, { carrier: "Owner entered", trackingNumber: "TYPED-BY-HAND" })
        const atShip = await inventory.get(ids.wsA, stockSmall.record.id)
        const holdAfter = heldReservation
            ? await prisma.inventoryReservation.findUnique({ where: { id: heldReservation.id } })
            : null
        check("shipping consumes the hold, so stock leaves at SHIPPED", atShip.onHand === 0 && atShip.reserved === 0, `${atShip.onHand}/${atShip.reserved}`)
        check("the consumed hold is recorded as CONSUMED, not deleted", holdAfter?.state === "CONSUMED", `${holdAfter?.state}`)
        const cancelShipped = await attempt(() => fulfilments.transition(ids.wsA, shipment.fulfilment.id, "CANCELLED", actor))
        check("a shipped shipment cannot be cancelled", !cancelShipped.ok && cancelShipped.code === "CONFLICT", why(cancelShipped))
        await fulfilments.transition(ids.wsA, shipment.fulfilment.id, "DELIVERED", actor)
        const afterDelivered = await attempt(() => fulfilments.transition(ids.wsA, shipment.fulfilment.id, "PACKED", actor))
        check("a delivered shipment is terminal", !afterDelivered.ok && afterDelivered.code === "CONFLICT", why(afterDelivered))

        const allocFinal = await fulfilments.allocations(ids.wsA, ids.orderA)
        const l1f = allocFinal.find((a) => a.orderLineId === line(1))!
        check("a delivered shipment counts as fulfilled", l1f.fulfilled === 2, `fulfilled=${l1f.fulfilled}`)

        // ---- 6. return eligibility is derived -----------------------
        const elig = await returns.eligibility(ids.wsA, ids.orderA)
        const e1 = elig.find((e) => e.orderLineId === line(1))!
        check("only shipped units are returnable", e1.fulfilled === 2 && e1.returnable === 2, `fulfilled=${e1.fulfilled} returnable=${e1.returnable}`)
        const e5 = elig.find((e) => e.orderLineId === line(5))!
        check("a line that never shipped is not returnable", e5.fulfilled === 0 && e5.returnable === 0, `returnable=${e5.returnable}`)

        const ret = await returns.request(ids.wsA, { orderId: ids.orderA, reference: `${RUN}-R1`, reason: "Wrong size", idempotencyKey: `${RUN}-r1` }, actor)
        check("a return starts REQUESTED", ret.returnRequest.state === "REQUESTED", ret.returnRequest.state)
        const retReplay = await returns.request(ids.wsA, { orderId: ids.orderA, reference: `${RUN}-OTHER`, idempotencyKey: `${RUN}-r1` }, actor)
        check("return replay returns the original", retReplay.replayed && retReplay.returnRequest.id === ret.returnRequest.id, `replayed=${retReplay.replayed}`)

        const approveEmpty = await attempt(() => returns.transition(ids.wsA, ret.returnRequest.id, "APPROVED", actor, { decidedBy: ids.userA }))
        check("a return with no lines cannot be approved", !approveEmpty.ok && approveEmpty.code === "CONFLICT", why(approveEmpty))
        const overReturn = await attempt(() => returns.addItem(ids.wsA, ret.returnRequest.id, { orderLineId: line(1), qty: 99 }, actor))
        check("returning more than shipped is refused with the returnable quantity named", !overReturn.ok && /Only 2 units of that line can still be returned/.test(overReturn.message), why(overReturn))
        const unshippedReturn = await attempt(() => returns.addItem(ids.wsA, ret.returnRequest.id, { orderLineId: line(5), qty: 1 }, actor))
        check("a line that never shipped cannot be returned", !unshippedReturn.ok && unshippedReturn.code === "CONFLICT", why(unshippedReturn))
        const retItem = await returns.addItem(ids.wsA, ret.returnRequest.id, { orderLineId: line(1), variantId: small.record.id, qty: 2 }, actor)
        check("a return line was recorded against the shipped variant", retItem.variantId === small.record.id, retItem.variantId)
        const dupRetLine = await attempt(() => returns.addItem(ids.wsA, ret.returnRequest.id, { orderLineId: line(1), qty: 1 }, actor))
        check("one order line cannot appear twice on one return", !dupRetLine.ok && dupRetLine.code === "CONFLICT", why(dupRetLine))

        const eligAfterClaim = await returns.eligibility(ids.wsA, ids.orderA)
        const e1c = eligAfterClaim.find((e) => e.orderLineId === line(1))!
        check("a live claim reduces what is still returnable", e1c.claimed === 2 && e1c.returnable === 0, `claimed=${e1c.claimed} returnable=${e1c.returnable}`)

        const noDecider = await attempt(() => returns.transition(ids.wsA, ret.returnRequest.id, "APPROVED", actor))
        check("approving without naming the decider is refused", !noDecider.ok && noDecider.code === "CONFLICT", why(noDecider))
        const earlyRestock = await attempt(() => returns.settleItem(ids.wsA, ret.returnRequest.id, retItem.id, "RESTOCKED", actor, { locationId: ids.locA }))
        check("goods cannot be restocked before the return is received", !earlyRestock.ok && earlyRestock.code === "CONFLICT", why(earlyRestock))

        await returns.transition(ids.wsA, ret.returnRequest.id, "APPROVED", actor, { decidedBy: ids.userA, decisionNote: "Approved" })
        const received = await returns.transition(ids.wsA, ret.returnRequest.id, "RECEIVED", actor)
        check("an approved return can be received", received.state === "RECEIVED" && received.receivedAt !== null, received.state)
        const reDecide = await attempt(() => returns.transition(ids.wsA, ret.returnRequest.id, "REJECTED", actor, { decidedBy: ids.userA }))
        check("a received return is terminal", !reDecide.ok && reDecide.code === "CONFLICT", why(reDecide))

        // ---- 7. restocking is idempotent ---------------------------
        const beforeRestock = await inventory.get(ids.wsA, stockSmall.record.id)
        const noLocation = await attempt(() => returns.settleItem(ids.wsA, ret.returnRequest.id, retItem.id, "RESTOCKED", actor))
        check("restocking without a location is BAD_REQUEST", !noLocation.ok && noLocation.code === "BAD_REQUEST", why(noLocation))
        const restocked = await returns.settleItem(ids.wsA, ret.returnRequest.id, retItem.id, "RESTOCKED", actor, { locationId: ids.locA })
        check("restocking is not reported as a replay the first time", restocked.replayed === false)
        const afterRestock = await inventory.get(ids.wsA, stockSmall.record.id)
        check("restocking credited the returned units once", afterRestock.onHand === beforeRestock.onHand + 2, `${beforeRestock.onHand} -> ${afterRestock.onHand}`)
        const replayRestock = await returns.settleItem(ids.wsA, ret.returnRequest.id, retItem.id, "RESTOCKED", actor, { locationId: ids.locA })
        check("restocking the same line again is an idempotent replay", replayRestock.replayed === true)
        const afterReplay = await inventory.get(ids.wsA, stockSmall.record.id)
        check("the replay credited NOTHING further", afterReplay.onHand === afterRestock.onHand, `${afterRestock.onHand} -> ${afterReplay.onHand}`)
        const movements = await prisma.inventoryMovement.count({
            where: { itemId: stockSmall.record.id, idempotencyKey: `return:${retItem.id}` },
        })
        check("exactly one RETURN movement exists for the return line", movements === 1, `movements=${movements}`)
        const itemRow = await prisma.returnItem.findUnique({ where: { id: retItem.id } })
        check("the return line records which movement credited it", itemRow?.restockMovementId !== null, `${itemRow?.restockMovementId}`)
        const discardAfter = await attempt(() => returns.settleItem(ids.wsA, ret.returnRequest.id, retItem.id, "DISCARDED", actor))
        check("a restocked line cannot then be discarded", !discardAfter.ok && discardAfter.code === "CONFLICT", why(discardAfter))

        // ---- 8. tenant isolation and non-enumeration --------------
        identity.current = `clerk_${ids.userB}`
        const beforeCross = await prisma.commerceEvent.count()
        const crossFetch = fetchCalls
        const foreignVariantGet = await attempt(() => variants.get(ids.wsB, small.record.id))
        const missingVariantGet = await attempt(() => variants.get(ids.wsB, `${RUN}_absent`))
        check("wrong-tenant variant read refused FORBIDDEN", !foreignVariantGet.ok && foreignVariantGet.code === "FORBIDDEN", why(foreignVariantGet))
        check("a foreign variant and a missing variant refuse identically", why(foreignVariantGet) === why(missingVariantGet), `${why(foreignVariantGet)}`)
        const foreignShip = await attempt(() => fulfilments.get(ids.wsB, shipment.fulfilment.id))
        const missingShip = await attempt(() => fulfilments.get(ids.wsB, `${RUN}_absent`))
        check("a foreign shipment and a missing shipment refuse identically", why(foreignShip) === why(missingShip), `${why(foreignShip)}`)
        const foreignRet = await attempt(() => returns.get(ids.wsB, ret.returnRequest.id))
        const missingRet = await attempt(() => returns.get(ids.wsB, `${RUN}_absent`))
        check("a foreign return and a missing return refuse identically", why(foreignRet) === why(missingRet), `${why(foreignRet)}`)
        const foreignElig = await attempt(() => returns.eligibility(ids.wsB, ids.orderA))
        check("wrong-tenant eligibility is refused, leaking no quantities", !foreignElig.ok && foreignElig.code === "FORBIDDEN", why(foreignElig))
        check("cross-tenant refusals appended zero commerce events", beforeCross === (await prisma.commerceEvent.count()), `before=${beforeCross}`)
        check("cross-tenant refusals made zero external calls", fetchCalls === crossFetch, `calls=${fetchCalls - crossFetch}`)
        const listB = await fulfilments.list(ids.wsB)
        check("tenant B's shipment list never contains tenant A's shipment", !listB.some((f) => f.id === shipment.fulfilment.id), `n=${listB.length}`)

        identity.current = `clerk_${ids.userA}`
        const orphanWs = `${RUN}_orphan`
        await prisma.workspace.create({ data: { id: orphanWs, name: "Orphan", slug: `ws-${orphanWs}` } })
        await prisma.membership.create({ data: { workspaceId: orphanWs, userId: ids.userA, role: "OWNER" } })
        const orphan = await attempt(() => fulfilments.list(orphanWs))
        check("a workspace with no profile is refused, not shown an empty list", !orphan.ok && orphan.code === "FORBIDDEN", why(orphan))

        // ---- 9. append-only commerce timeline ---------------------
        const timeline = await variants.events(ids.wsA, "FULFILMENT", shipment.fulfilment.id)
        const seqs = timeline.map((e) => Number(e.seq))
        check("the shipment timeline recorded every accepted change", timeline.length >= 5, `events=${timeline.length}`)
        check("timeline seq is strictly increasing", seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        const kinds = new Set<string>(
            (await prisma.commerceEvent.findMany({ where: { profileId: ids.profileA }, select: { kind: true } })).map((e) => String(e.kind)),
        )
        for (const kind of ["VARIANT", "FULFILMENT", "RETURN", "RESTOCK"]) {
            check(`the commerce ledger contains a ${kind} event`, kinds.has(kind), [...kinds].join(","))
        }
        let appendOnly = false
        let appendDetail = ""
        try {
            await prisma.$executeRawUnsafe(`update "CommerceEvent" set "to"='TAMPERED' where "profileId"='${ids.profileA}'`)
        } catch (e) {
            appendOnly = true
            appendDetail = String((e as Error).message).split("\n").find((l) => /append-only/.test(l))?.trim() ?? "refused"
        }
        check("the database refuses to rewrite the commerce ledger", appendOnly, appendDetail || "NO ERROR")

        // ---- 10. a failed transaction leaves no residue -----------
        {
            const beforeF = await prisma.fulfilment.count()
            const beforeE = await prisma.commerceEvent.count()
            const rolled = await attempt(async () => {
                await prisma.$transaction(async (tx) => {
                    await tx.fulfilment.create({
                        data: { profileId: ids.profileA, orderId: ids.orderA, reference: `${RUN}-DOOMED` },
                    })
                    await tx.commerceEvent.create({
                        data: { profileId: ids.profileA, kind: "FULFILMENT", subjectType: "FULFILMENT", subjectId: "x", to: "DRAFT" },
                    })
                    throw new PersistenceError("CONFLICT", "deliberate abort")
                })
            })
            check("a deliberately aborted transaction reports failure", !rolled.ok, why(rolled))
            check("the aborted transaction left no shipment", beforeF === (await prisma.fulfilment.count()), `before=${beforeF}`)
            check("the aborted transaction left no commerce event", beforeE === (await prisma.commerceEvent.count()), `before=${beforeE}`)
        }

        // ---- 11. whole-run external call tally -------------------
        check("no external call was EVER made in this run", fetchCalls === 0, `calls=${fetchCalls}`)
    } finally {
        for (const [table, trigger] of [["CommerceEvent", "CommerceEvent_append_only"], ["InventoryMovement", "InventoryMovement_append_only"]]) {
            try {
                await prisma.$executeRawUnsafe(`alter table "${table}" disable trigger "${trigger}"`)
                if (table === "CommerceEvent") {
                    await prisma.$executeRawUnsafe(`delete from "CommerceEvent" where "profileId" in (${profileList})`)
                } else {
                    await prisma.$executeRawUnsafe(
                        `delete from "InventoryMovement" where "itemId" in (select "id" from "InventoryItem" where "profileId" in (${profileList}))`,
                    )
                }
            } finally {
                await prisma.$executeRawUnsafe(`alter table "${table}" enable trigger "${trigger}"`)
            }
        }
        const itemScope = `select "id" from "InventoryItem" where "profileId" in (${profileList})`
        for (const sql of [
            `delete from "ReturnItem" where "returnRequestId" in (select "id" from "ReturnRequest" where "profileId" in (${profileList}))`,
            `delete from "ReturnRequest" where "profileId" in (${profileList})`,
            `delete from "FulfilmentItem" where "fulfilmentId" in (select "id" from "Fulfilment" where "profileId" in (${profileList}))`,
            `delete from "Fulfilment" where "profileId" in (${profileList})`,
            `delete from "InventoryReservation" where "itemId" in (${itemScope})`,
            `delete from "InventoryItem" where "profileId" in (${profileList})`,
            `delete from "ProductVariantOptionValue" where "variantId" in (select "id" from "ProductVariant" where "profileId" in (${profileList}))`,
            `delete from "ProductOptionValue" where "optionId" in (select "id" from "ProductOption" where "productId" in (select "id" from "DigitalProduct" where "profileId" in (${profileList})))`,
            `delete from "ProductOption" where "productId" in (select "id" from "DigitalProduct" where "profileId" in (${profileList}))`,
            `delete from "ProductVariant" where "profileId" in (${profileList})`,
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
            `select count(*)::int n from information_schema.triggers where trigger_schema='public' and trigger_name in ('CommerceEvent_append_only','InventoryMovement_append_only')`,
        )
        check("both append-only triggers re-armed", Number(armed[0].n) >= 2, `triggers=${armed[0].n}`)

        for (const [label, expected, actual] of [
            ["ProductVariant rows", base.variants, await prisma.productVariant.count()],
            ["ProductOption rows", base.options, await prisma.productOption.count()],
            ["Fulfilment rows", base.fulfilments, await prisma.fulfilment.count()],
            ["ReturnRequest rows", base.returns, await prisma.returnRequest.count()],
            ["CommerceEvent rows", base.events, await prisma.commerceEvent.count()],
            ["InventoryItem rows", base.items, await prisma.inventoryItem.count()],
            ["InventoryMovement rows", base.movements, await prisma.inventoryMovement.count()],
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
    console.log("All commerce runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
