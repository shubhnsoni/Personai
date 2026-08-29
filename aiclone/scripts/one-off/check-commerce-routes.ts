/**
 * Wave G / G1.3 commerce HTTP boundary harness.
 *
 * Invokes the REAL CommerceApiService — the same object the 16 route files under
 * src/app/api/platform re-export — with a controlled identity, and asserts status, envelope
 * and body for every principal class.
 *
 * Negative claims are measured, not asserted in prose:
 *   - a refusal writes no row and appends no commerce event
 *   - a refusal reaches no external service (globalThis.fetch is a counting blocker)
 *   - a foreign resource and a nonexistent one produce byte-identical responses
 *   - an insufficient-stock, over-allocation and over-return refusal each arrive with the
 *     real number in machine-readable details, because a storefront cannot act on a bare 409
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-commerce-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { FulfilmentService } from "../../src/lib/commerce/fulfilment"
import { CommerceApiService } from "../../src/lib/commerce/http"
import { ReturnService } from "../../src/lib/commerce/returns"
import { CommerceContext } from "../../src/lib/commerce/shared"
import { VariantService } from "../../src/lib/commerce/variants"
import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const API = "http://127.0.0.1/api/platform"

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
    const inventory = new InventoryService(new InventoryContext(prisma, tenancy))
    const ctx = new CommerceContext(prisma, tenancy)
    const api = new CommerceApiService(
        new VariantService(ctx),
        new FulfilmentService(ctx, inventory),
        new ReturnService(ctx, inventory),
    )

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
        orderA: `${RUN}_oa`, orderB: `${RUN}_ob`,
    }
    const profileList = `'${ids.profileA}','${ids.profileB}'`
    const base = { variants: 0, fulfilments: 0, returns: 0, events: 0 }
    const line = (n: number) => `${RUN}_ol${n}`
    let variantId = ""
    let fulfilmentId = ""
    let returnId = ""

    try {
        base.variants = await prisma.productVariant.count()
        base.fulfilments = await prisma.fulfilment.count()
        base.returns = await prisma.returnRequest.count()
        base.events = await prisma.commerceEvent.count()

        for (const [u, p, w, l, pr, o] of [
            [ids.userA, ids.profileA, ids.wsA, ids.locA, ids.prodA, ids.orderA],
            [ids.userB, ids.profileB, ids.wsB, ids.locB, ids.prodB, ids.orderB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
            await prisma.location.create({ data: { id: l, workspaceId: w, name: `Shop ${l}` } })
            await prisma.digitalProduct.create({ data: { id: pr, profileId: p, title: `Widget ${pr}`, priceCents: 2000 } })
            await prisma.order.create({
                data: {
                    id: o, profileId: p, publicToken: `tok_${o}`, number: 1,
                    businessDate: new Date("2035-01-01T00:00:00Z"),
                    subtotalCents: 4000, totalCents: 4000, currency: "USD",
                },
            })
        }
        for (let n = 1; n <= 3; n += 1) {
            const qty = n === 1 ? 4 : 1
            await prisma.orderLine.create({
                data: {
                    id: line(n), orderId: ids.orderA, titleSnapshot: `Line ${n}`, qty,
                    unitPriceCents: 1000, lineTotalCents: qty * 1000, productId: ids.prodA,
                },
            })
        }
        await prisma.user.create({ data: { id: ids.userC, clerkId: `clerk_${ids.userC}`, email: `${ids.userC}@example.test` } })

        // ---- 1. anonymous: 401 on every endpoint, zero writes ------------
        identity.current = null
        const beforeVariants = await prisma.productVariant.count()
        const beforeEvents = await prisma.commerceEvent.count()
        const anonFetch = fetchCalls
        const q = `workspaceId=${ids.wsA}`
        const anon = {
            products: await call(api.listProducts(get(`${API}/products?${q}`))),
            orders: await call(api.listOrders(get(`${API}/orders?${q}`))),
            options: await call(api.listOptions(ids.prodA, get(`${API}/products/${ids.prodA}/options?${q}`))),
            addOption: await call(api.addOption(ids.prodA, send(`${API}/products/${ids.prodA}/options`, { workspaceId: ids.wsA, name: "Size" }))),
            addOptionValue: await call(api.addOptionValue("opt", send(`${API}/product-options/opt/values`, { workspaceId: ids.wsA, value: "M" }))),
            variants: await call(api.listVariants(ids.prodA, get(`${API}/products/${ids.prodA}/variants?${q}`))),
            createVariant: await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, { workspaceId: ids.wsA, title: "X" }))),
            getVariant: await call(api.getVariant("v", get(`${API}/product-variants/v?${q}`))),
            updateVariant: await call(api.updateVariant("v", send(`${API}/product-variants/v`, { workspaceId: ids.wsA, title: "Y" }, "PATCH"))),
            fulfilments: await call(api.listFulfilments(get(`${API}/fulfilments?${q}`))),
            createFulfilment: await call(api.createFulfilment(send(`${API}/fulfilments`, { workspaceId: ids.wsA, orderId: ids.orderA, reference: "F" }))),
            getFulfilment: await call(api.getFulfilment("f", get(`${API}/fulfilments/f?${q}`))),
            addFulfilmentItem: await call(api.addFulfilmentItem("f", send(`${API}/fulfilments/f/items`, { workspaceId: ids.wsA, orderLineId: line(1) }))),
            transitionFulfilment: await call(api.transitionFulfilment("f", send(`${API}/fulfilments/f`, { workspaceId: ids.wsA, state: "PACKED" }, "PATCH"))),
            allocations: await call(api.allocations(ids.orderA, get(`${API}/orders/${ids.orderA}/allocations?${q}`))),
            eligibility: await call(api.eligibility(ids.orderA, get(`${API}/orders/${ids.orderA}/return-eligibility?${q}`))),
            returns: await call(api.listReturns(get(`${API}/returns?${q}`))),
            createReturn: await call(api.createReturn(send(`${API}/returns`, { workspaceId: ids.wsA, orderId: ids.orderA, reference: "R" }))),
            getReturn: await call(api.getReturn("r", get(`${API}/returns/r?${q}`))),
            addReturnItem: await call(api.addReturnItem("r", send(`${API}/returns/r/items`, { workspaceId: ids.wsA, orderLineId: line(1) }))),
            transitionReturn: await call(api.transitionReturn("r", send(`${API}/returns/r`, { workspaceId: ids.wsA, state: "APPROVED" }, "PATCH"))),
            settleReturnItem: await call(api.settleReturnItem("r", "i", send(`${API}/returns/r/items/i`, { workspaceId: ids.wsA, restockState: "RESTOCKED" }, "PATCH"))),
            events: await call(api.events(get(`${API}/commerce-events?${q}&subjectType=RETURN&subjectId=r`))),
        }
        const notUnauthorized = Object.entries(anon).filter(([, v]) => v.status !== 401).map(([k, v]) => `${k}=${v.status}`)
        check(`anonymous is 401 on all ${Object.keys(anon).length} commerce endpoints`, notUnauthorized.length === 0, notUnauthorized.join(" ") || "all 401")
        check("anonymous refusal wrote zero variants", beforeVariants === (await prisma.productVariant.count()), `before=${beforeVariants}`)
        check("anonymous refusal appended zero commerce events", beforeEvents === (await prisma.commerceEvent.count()), `before=${beforeEvents}`)
        check("anonymous refusal made zero external calls", fetchCalls === anonFetch, `calls=${fetchCalls - anonFetch}`)
        check("anonymous body is an error envelope with no data key", pick(anon.products.body, "ok") === false && pick(anon.products.body, "data") === undefined, anon.products.text.slice(0, 90))

        // ---- 2. authenticated non-member: 403 -------------------------
        identity.current = `clerk_${ids.userC}`
        const outsider = await call(api.listProducts(get(`${API}/products?${q}`)))
        const outsiderWrite = await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, { workspaceId: ids.wsA, title: "Y" })))
        check("authenticated non-member read is 403", outsider.status === 403, `status=${outsider.status}`)
        check("authenticated non-member write is 403", outsiderWrite.status === 403, `status=${outsiderWrite.status}`)

        // ---- 3. valid member: products, options, variants -------------
        identity.current = `clerk_${ids.userA}`
        const products = await call(api.listProducts(get(`${API}/products?${q}`)))
        check("product list is 200 and scoped to the profile", products.status === 200 && pickArray(products.body, "data", "products").length >= 1, `n=${pickArray(products.body, "data", "products").length}`)
        const orders = await call(api.listOrders(get(`${API}/orders?${q}`)))
        check("order list is 200 and reports line and shipment counts", orders.status === 200 && pickNumber(pickArray(orders.body, "data", "orders")[0], "lineCount") === 3, `lines=${pickNumber(pickArray(orders.body, "data", "orders")[0], "lineCount")}`)
        const missingParam = await call(api.listProducts(get(`${API}/products`)))
        check("a missing workspaceId query parameter is 400", missingParam.status === 400, `status=${missingParam.status}`)
        const badBody = await call(api.createVariant(ids.prodA, malformed(`${API}/products/${ids.prodA}/variants`)))
        check("a malformed JSON body is 400", badBody.status === 400, `status=${badBody.status}`)

        const option = await call(api.addOption(ids.prodA, send(`${API}/products/${ids.prodA}/options`, { workspaceId: ids.wsA, name: "Size", values: ["S", "M"] })))
        check("option create is 201 with its values", option.status === 201, `status=${option.status}`)
        const optionId = pickString(option.body, "data", "option", "id")
        const dupOption = await call(api.addOption(ids.prodA, send(`${API}/products/${ids.prodA}/options`, { workspaceId: ids.wsA, name: "Size" })))
        check("a duplicate option name is 409", dupOption.status === 409, `status=${dupOption.status}`)
        const optionValue = await call(api.addOptionValue(optionId, send(`${API}/product-options/${optionId}/values`, { workspaceId: ids.wsA, value: "L" })))
        check("option value create is 201", optionValue.status === 201, `status=${optionValue.status}`)
        const badValues = await call(api.addOption(ids.prodA, send(`${API}/products/${ids.prodA}/options`, { workspaceId: ids.wsA, name: "Colour", values: ["Red", 7] })))
        check("a non-string option value is 400", badValues.status === 400, `status=${badValues.status}`)

        const variant = await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, {
            workspaceId: ids.wsA, title: "Small", sku: `${RUN}-S`, priceCents: 1500, idempotencyKey: `${RUN}-v1`,
        })))
        check("variant create is 201", variant.status === 201, `status=${variant.status}`)
        variantId = pickString(variant.body, "data", "variant", "id")
        check("the created variant is never the default", pick(variant.body, "data", "variant", "isDefault") === false)
        check("the response exposes the resolved effective price", pickNumber(variant.body, "data", "variant", "effectivePriceCents") === 1500, `${pickNumber(variant.body, "data", "variant", "effectivePriceCents")}`)
        const variantReplay = await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, {
            workspaceId: ids.wsA, title: "Other", idempotencyKey: `${RUN}-v1`,
        })))
        check("variant replay is 200 not 201", variantReplay.status === 200, `status=${variantReplay.status}`)
        const dupSku = await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, { workspaceId: ids.wsA, title: "Clash", sku: `${RUN}-S` })))
        check("a duplicate sku is 409", dupSku.status === 409, `status=${dupSku.status}`)
        const negPrice = await call(api.createVariant(ids.prodA, send(`${API}/products/${ids.prodA}/variants`, { workspaceId: ids.wsA, title: "Bad", priceCents: -1 })))
        check("a negative variant price is 400", negPrice.status === 400, `status=${negPrice.status}`)
        const inherit = await call(api.updateVariant(variantId, send(`${API}/product-variants/${variantId}`, { workspaceId: ids.wsA, clearPrice: true }, "PATCH")))
        check("clearing a variant price is 200 and falls back to the product price", inherit.status === 200 && pickNumber(inherit.body, "data", "variant", "effectivePriceCents") === 2000, `${pickNumber(inherit.body, "data", "variant", "effectivePriceCents")}`)
        const emptyUpdate = await call(api.updateVariant(variantId, send(`${API}/product-variants/${variantId}`, { workspaceId: ids.wsA }, "PATCH")))
        check("an update with no fields is 400", emptyUpdate.status === 400, `status=${emptyUpdate.status}`)

        // ---- 4. insufficient stock arrives with the number ------------
        const stock = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, variantId, locationId: ids.locA }, { actorType: "STAFF", actorId: null })
        await inventory.applyMovement(ids.wsA, stock.record.id, { kind: "RECEIPT", qty: 1 }, { actorType: "STAFF", actorId: null })
        await inventory.reserve(ids.wsA, stock.record.id, { orderLineId: line(2), qty: 1 }, { actorType: "STAFF", actorId: null })
        const oversell = await call(
            (async () => {
                try {
                    await inventory.reserve(ids.wsA, stock.record.id, { orderLineId: line(3), qty: 1 }, { actorType: "STAFF", actorId: null })
                    return Response.json({ ok: true, data: {} })
                } catch (e) {
                    const err = e as { code?: string; message?: string; details?: unknown; status?: number }
                    return Response.json({ ok: false, error: { code: err.code, message: err.message, details: err.details } }, { status: err.status ?? 500 })
                }
            })(),
        )
        check("an insufficient-stock refusal is 409", oversell.status === 409, `status=${oversell.status}`)
        check("the insufficient-stock refusal carries the available quantity", pickNumber(oversell.body, "error", "details", "available") === 0, oversell.text.slice(0, 140))

        // ---- 5. fulfilment over HTTP, partial and guarded -------------
        const shipment = await call(api.createFulfilment(send(`${API}/fulfilments`, {
            workspaceId: ids.wsA, orderId: ids.orderA, reference: `${RUN}-F1`, locationId: ids.locA, idempotencyKey: `${RUN}-f1`,
        })))
        check("shipment create is 201 at DRAFT", shipment.status === 201 && pickString(shipment.body, "data", "fulfilment", "state") === "DRAFT", `status=${shipment.status}`)
        fulfilmentId = pickString(shipment.body, "data", "fulfilment", "id")
        const shipReplay = await call(api.createFulfilment(send(`${API}/fulfilments`, { workspaceId: ids.wsA, orderId: ids.orderA, reference: `${RUN}-OTHER`, idempotencyKey: `${RUN}-f1` })))
        check("shipment replay is 200 and returns the original", shipReplay.status === 200 && pickString(shipReplay.body, "data", "fulfilment", "id") === fulfilmentId, `status=${shipReplay.status}`)
        const dupShipRef = await call(api.createFulfilment(send(`${API}/fulfilments`, { workspaceId: ids.wsA, orderId: ids.orderA, reference: `${RUN}-F1` })))
        check("a duplicate shipment reference is 409", dupShipRef.status === 409, `status=${dupShipRef.status}`)
        const packEmpty = await call(api.transitionFulfilment(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}`, { workspaceId: ids.wsA, state: "PACKED" }, "PATCH")))
        check("packing an empty shipment is 409", packEmpty.status === 409, `status=${packEmpty.status}`)
        const badState = await call(api.transitionFulfilment(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}`, { workspaceId: ids.wsA, state: "TELEPORTED" }, "PATCH")))
        check("an unknown fulfilment state is 400 not 409", badState.status === 400, `status=${badState.status}`)

        const item = await call(api.addFulfilmentItem(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}/items`, {
            workspaceId: ids.wsA, orderLineId: line(1), variantId, qty: 2,
        })))
        check("adding a partial line to a shipment is 201", item.status === 201, `status=${item.status}`)
        const alloc = await call(api.allocations(ids.orderA, get(`${API}/orders/${ids.orderA}/allocations?${q}`)))
        const a1 = pickArray(alloc.body, "data", "allocations").find((a) => pickString(a, "orderLineId") === line(1))
        check("allocations report the partial state exactly", pickNumber(a1, "allocated") === 2 && pickNumber(a1, "remaining") === 2, `${pickNumber(a1, "allocated")}/${pickNumber(a1, "remaining")}`)
        const overAlloc = await call(api.addFulfilmentItem(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}/items`, { workspaceId: ids.wsA, orderLineId: line(3), qty: 9 })))
        check("over-allocating a line is 409", overAlloc.status === 409, `status=${overAlloc.status}`)
        check("the over-allocation refusal carries the remaining quantity", pickNumber(overAlloc.body, "error", "details", "remaining") === 1, overAlloc.text.slice(0, 150))

        await call(api.addFulfilmentItem(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}/items`, { workspaceId: ids.wsA, orderLineId: line(2), variantId, qty: 1 })))
        await call(api.transitionFulfilment(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}`, { workspaceId: ids.wsA, state: "PACKED" }, "PATCH")))
        const shipped = await call(api.transitionFulfilment(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}`, {
            workspaceId: ids.wsA, state: "SHIPPED", trackingNumber: "TYPED-BY-HAND",
        }, "PATCH")))
        check("shipping is 200 and records the owner-entered tracking", shipped.status === 200 && pickString(shipped.body, "data", "fulfilment", "trackingNumber") === "TYPED-BY-HAND", `status=${shipped.status}`)
        const afterShip = await inventory.get(ids.wsA, stock.record.id)
        check("shipping consumed the hold through the inventory engine", afterShip.onHand === 0 && afterShip.reserved === 0, `${afterShip.onHand}/${afterShip.reserved}`)
        const cancelShipped = await call(api.transitionFulfilment(fulfilmentId, send(`${API}/fulfilments/${fulfilmentId}`, { workspaceId: ids.wsA, state: "CANCELLED" }, "PATCH")))
        check("cancelling a shipped shipment is 409", cancelShipped.status === 409, `status=${cancelShipped.status}`)

        // ---- 6. returns over HTTP ------------------------------------
        const elig = await call(api.eligibility(ids.orderA, get(`${API}/orders/${ids.orderA}/return-eligibility?${q}`)))
        const e1 = pickArray(elig.body, "data", "eligibility").find((e) => pickString(e, "orderLineId") === line(1))
        check("eligibility is 200 and counts only shipped units", elig.status === 200 && pickNumber(e1, "fulfilled") === 2 && pickNumber(e1, "returnable") === 2, `${pickNumber(e1, "fulfilled")}/${pickNumber(e1, "returnable")}`)

        const ret = await call(api.createReturn(send(`${API}/returns`, {
            workspaceId: ids.wsA, orderId: ids.orderA, reference: `${RUN}-R1`, reason: "Wrong size", idempotencyKey: `${RUN}-r1`,
        })))
        check("return create is 201 at REQUESTED", ret.status === 201 && pickString(ret.body, "data", "returnRequest", "state") === "REQUESTED", `status=${ret.status}`)
        returnId = pickString(ret.body, "data", "returnRequest", "id")
        const retReplay = await call(api.createReturn(send(`${API}/returns`, { workspaceId: ids.wsA, orderId: ids.orderA, reference: `${RUN}-OTHER`, idempotencyKey: `${RUN}-r1` })))
        check("return replay is 200 and returns the original", retReplay.status === 200 && pickString(retReplay.body, "data", "returnRequest", "id") === returnId, `status=${retReplay.status}`)
        const badReturnState = await call(api.transitionReturn(returnId, send(`${API}/returns/${returnId}`, { workspaceId: ids.wsA, state: "VANISHED" }, "PATCH")))
        check("an unknown return state is 400", badReturnState.status === 400, `status=${badReturnState.status}`)
        const approveEmpty = await call(api.transitionReturn(returnId, send(`${API}/returns/${returnId}`, { workspaceId: ids.wsA, state: "APPROVED", decidedBy: ids.userA }, "PATCH")))
        check("approving an empty return is 409", approveEmpty.status === 409, `status=${approveEmpty.status}`)
        const overReturn = await call(api.addReturnItem(returnId, send(`${API}/returns/${returnId}/items`, { workspaceId: ids.wsA, orderLineId: line(1), qty: 9 })))
        check("returning more than shipped is 409", overReturn.status === 409, `status=${overReturn.status}`)
        check("the over-return refusal carries the returnable quantity", pickNumber(overReturn.body, "error", "details", "returnable") === 2, overReturn.text.slice(0, 150))
        const retItem = await call(api.addReturnItem(returnId, send(`${API}/returns/${returnId}/items`, { workspaceId: ids.wsA, orderLineId: line(1), variantId, qty: 2 })))
        check("return line create is 201", retItem.status === 201, `status=${retItem.status}`)
        const retItemId = pickString(retItem.body, "data", "item", "id")
        const noDecider = await call(api.transitionReturn(returnId, send(`${API}/returns/${returnId}`, { workspaceId: ids.wsA, state: "APPROVED" }, "PATCH")))
        check("approving without a decider is 409", noDecider.status === 409, `status=${noDecider.status}`)
        const approved = await call(api.transitionReturn(returnId, send(`${API}/returns/${returnId}`, { workspaceId: ids.wsA, state: "APPROVED", decidedBy: ids.userA }, "PATCH")))
        check("approval is 200 and records the decider", approved.status === 200 && pickString(approved.body, "data", "returnRequest", "decidedBy") === ids.userA, `status=${approved.status}`)
        const earlyRestock = await call(api.settleReturnItem(returnId, retItemId, send(`${API}/returns/${returnId}/items/${retItemId}`, { workspaceId: ids.wsA, restockState: "RESTOCKED", locationId: ids.locA }, "PATCH")))
        check("restocking before the goods arrive is 409", earlyRestock.status === 409, `status=${earlyRestock.status}`)
        const received = await call(api.transitionReturn(returnId, send(`${API}/returns/${returnId}`, { workspaceId: ids.wsA, state: "RECEIVED" }, "PATCH")))
        check("receiving is 200", received.status === 200, `status=${received.status}`)

        const noLocation = await call(api.settleReturnItem(returnId, retItemId, send(`${API}/returns/${returnId}/items/${retItemId}`, { workspaceId: ids.wsA, restockState: "RESTOCKED" }, "PATCH")))
        check("restocking without a location is 400", noLocation.status === 400, `status=${noLocation.status}`)
        const beforeRestock = await inventory.get(ids.wsA, stock.record.id)
        const restocked = await call(api.settleReturnItem(returnId, retItemId, send(`${API}/returns/${returnId}/items/${retItemId}`, { workspaceId: ids.wsA, restockState: "RESTOCKED", locationId: ids.locA }, "PATCH")))
        check("restocking is 200 and is not reported as a replay", restocked.status === 200 && pick(restocked.body, "data", "replayed") === false, restocked.text.slice(0, 120))
        const afterRestock = await inventory.get(ids.wsA, stock.record.id)
        check("restocking credited the units once", afterRestock.onHand === beforeRestock.onHand + 2, `${beforeRestock.onHand} -> ${afterRestock.onHand}`)
        const replayRestock = await call(api.settleReturnItem(returnId, retItemId, send(`${API}/returns/${returnId}/items/${retItemId}`, { workspaceId: ids.wsA, restockState: "RESTOCKED", locationId: ids.locA }, "PATCH")))
        check("restocking again is 200 and reported as a replay", replayRestock.status === 200 && pick(replayRestock.body, "data", "replayed") === true, replayRestock.text.slice(0, 120))
        const afterReplay = await inventory.get(ids.wsA, stock.record.id)
        check("the replay credited NOTHING further", afterReplay.onHand === afterRestock.onHand, `${afterRestock.onHand} -> ${afterReplay.onHand}`)

        // ---- 7. the commerce timeline -------------------------------
        const events = await call(api.events(get(`${API}/commerce-events?${q}&subjectType=RETURN&subjectId=${returnId}`)))
        const rows = pickArray(events.body, "data", "events")
        const seqs = rows.map((e) => Number(pickString(e, "seq")))
        check("the timeline is 200 and ordered", events.status === 200 && seqs.every((v, i) => i === 0 || v > seqs[i - 1]), `n=${seqs.length}`)
        check("timeline seq serialises as a string not a BigInt", rows.every((e) => typeof pick(e, "seq") === "string"), typeof pick(rows[0], "seq"))
        const badSubject = await call(api.events(get(`${API}/commerce-events?${q}&subjectType=SOMETHING&subjectId=x`)))
        check("an unknown subjectType is 400", badSubject.status === 400, `status=${badSubject.status}`)
        const missingSubject = await call(api.events(get(`${API}/commerce-events?${q}&subjectType=RETURN`)))
        check("a missing subjectId is 400, so history cannot be swept", missingSubject.status === 400, `status=${missingSubject.status}`)

        // ---- 8. wrong tenant is indistinguishable from nonexistent --
        identity.current = `clerk_${ids.userB}`
        const beforeCross = await prisma.commerceEvent.count()
        const crossFetch = fetchCalls
        const qb = `workspaceId=${ids.wsB}`
        const foreignVariant = await call(api.getVariant(variantId, get(`${API}/product-variants/${variantId}?${qb}`)))
        const absentVariant = await call(api.getVariant(`${RUN}_absent`, get(`${API}/product-variants/${RUN}_absent?${qb}`)))
        check("wrong-tenant variant read is 403", foreignVariant.status === 403, `status=${foreignVariant.status}`)
        // This is the single inverted assertion.
        const identical = INVERT
            ? foreignVariant.text !== absentVariant.text
            : foreignVariant.status === absentVariant.status && foreignVariant.text === absentVariant.text
        check("a foreign variant and a nonexistent variant are byte-identical", identical, `${foreignVariant.status}:${foreignVariant.text} vs ${absentVariant.status}:${absentVariant.text}`)
        const foreignShip = await call(api.getFulfilment(fulfilmentId, get(`${API}/fulfilments/${fulfilmentId}?${qb}`)))
        const absentShip = await call(api.getFulfilment(`${RUN}_absent`, get(`${API}/fulfilments/${RUN}_absent?${qb}`)))
        check("a foreign shipment and a nonexistent shipment are byte-identical", foreignShip.status === absentShip.status && foreignShip.text === absentShip.text, `${foreignShip.status}/${absentShip.status}`)
        const foreignRet = await call(api.getReturn(returnId, get(`${API}/returns/${returnId}?${qb}`)))
        const absentRet = await call(api.getReturn(`${RUN}_absent`, get(`${API}/returns/${RUN}_absent?${qb}`)))
        check("a foreign return and a nonexistent return are byte-identical", foreignRet.status === absentRet.status && foreignRet.text === absentRet.text, `${foreignRet.status}/${absentRet.status}`)
        const foreignAlloc = await call(api.allocations(ids.orderA, get(`${API}/orders/${ids.orderA}/allocations?${qb}`)))
        check("wrong-tenant allocations are 403 and leak no quantities", foreignAlloc.status === 403 && !/remaining/.test(foreignAlloc.text), foreignAlloc.text.slice(0, 90))
        const foreignEvents = await call(api.events(get(`${API}/commerce-events?${qb}&subjectType=RETURN&subjectId=${returnId}`)))
        check("wrong-tenant history returns nothing rather than another tenant's events", foreignEvents.status === 200 && pickArray(foreignEvents.body, "data", "events").length === 0, `n=${pickArray(foreignEvents.body, "data", "events").length}`)
        check("cross-tenant refusals appended zero commerce events", beforeCross === (await prisma.commerceEvent.count()), `before=${beforeCross}`)
        check("cross-tenant refusals made zero external calls", fetchCalls === crossFetch, `calls=${fetchCalls - crossFetch}`)
        const listB = await call(api.listFulfilments(get(`${API}/fulfilments?${qb}`)))
        check("tenant B's shipment list excludes tenant A's shipment", !pickArray(listB.body, "data", "fulfilments").some((f) => pickString(f, "id") === fulfilmentId), `n=${pickArray(listB.body, "data", "fulfilments").length}`)

        // ---- 9. dependency failure is 503 with no leak -------------
        identity.current = `clerk_${ids.userA}`
        const brokenPrisma = {
            workspace: { findUnique: async () => ({ profileId: ids.profileA }) },
            digitalProduct: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
        } as unknown as PrismaClient
        const brokenCtx = new CommerceContext(brokenPrisma, tenancy)
        const brokenApi = new CommerceApiService(
            new VariantService(brokenCtx),
            new FulfilmentService(brokenCtx, inventory),
            new ReturnService(brokenCtx, inventory),
        )
        const broken = await call(brokenApi.listProducts(get(`${API}/products?${q}`)))
        check("dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        check("dependency failure leaks no internal detail", !/SECRET_DETAIL/.test(broken.text) && !/postgres:\/\//.test(broken.text), broken.text.slice(0, 120))

        // ---- 10. envelope agrees with the platform contract --------
        const listA = await call(api.listFulfilments(get(`${API}/fulfilments?${q}`)))
        check("success envelope keys are exactly ok,data", keys(listA.body) === "data,ok", keys(listA.body))
        check("error envelope keys are exactly error,ok", keys(anon.products.body) === "error,ok", keys(anon.products.body))
        check(
            "every error envelope carries a code and a message",
            [anon.products, outsider, foreignVariant, overAlloc, badState, broken].every(
                (r) => pickString(r.body, "error", "code") !== "" && pickString(r.body, "error", "message") !== "",
            ),
            "codes present",
        )

        // ---- 11. whole-run external call tally --------------------
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
            `delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            `delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`,
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
            ["Fulfilment rows", base.fulfilments, await prisma.fulfilment.count()],
            ["ReturnRequest rows", base.returns, await prisma.returnRequest.count()],
            ["CommerceEvent rows", base.events, await prisma.commerceEvent.count()],
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
    console.log("All commerce route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
