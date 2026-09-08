import { logDependencyFailure } from "@/lib/operations/dependency-failure-log"
import { PersistenceError } from "@/lib/persistence/errors"

import type { FulfilmentService } from "./fulfilment"
import { fulfilmentFlow, restockFlow, returnFlow } from "./lifecycle"
import type { ReturnService } from "./returns"
import type { CommerceActor } from "./shared"
import type { VariantService } from "./variants"

/**
 * HTTP boundary for the commerce surface.
 *
 * The envelope mirrors PlatformService — { ok: true, data } / { ok: false, error: { code,
 * message } } with the same status map. It is restated rather than imported because that
 * file belongs to the P2-002 package; the route harness asserts both agree so drift is
 * caught by a test.
 *
 * Refusals that a storefront must act on keep their `details`: "only 3 units are still
 * unshipped" is useless unless the number 3 arrives in a field a caller can read. A
 * dependency failure carries no detail at all.
 *
 * Enum inputs are validated against the owning lifecycle flow BEFORE the engine sees them,
 * so "that is not a state" stays 400 and "that is not a legal move from here" stays 409.
 *
 * The actor is always derived server-side; no parameter lets a caller name itself.
 */

type JsonObject = Record<string, unknown>

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status })
}
function success(data: unknown, status = 200): Response {
    return json({ ok: true, data }, status)
}
function failure(error: unknown): Response {
    if (error instanceof PersistenceError) {
        return json(
            {
                ok: false,
                error: {
                    code: error.code,
                    message: error.message,
                    ...(error.details ? { details: error.details } : {}),
                },
            },
            error.status,
        )
    }
    return json(
        { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Commerce is temporarily unavailable" } },
        503,
    )
}

async function body(request: Request): Promise<JsonObject> {
    let value: unknown
    try {
        value = await request.json()
    } catch {
        throw new PersistenceError("BAD_REQUEST", "Request body must contain valid JSON")
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "A JSON object body is required")
    }
    return value as JsonObject
}

function str(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
    }
    return value.trim()
}
function nullableStr(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}
function int(value: unknown, field: string): number {
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}
function optInt(value: unknown, field: string): number | null {
    if (value === null || value === undefined || value === "") return null
    return int(value, field)
}
function strArray(value: unknown, field: string): string[] {
    if (value === null || value === undefined) return []
    if (!Array.isArray(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an array of strings`, { field })
    return value.map((v, i) => str(v, `${field}[${i}]`))
}

/** Validates a state against the owning flow, so an unknown value is 400 not 409. */
function state<T extends string>(value: unknown, guard: (v: unknown) => v is T, label: string, field = "state"): T {
    const raw = str(value, field)
    if (!guard(raw)) {
        throw new PersistenceError("BAD_REQUEST", `${field} is not a recognised ${label} value`, { field })
    }
    return raw
}

function serialise(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
        if (v instanceof Date) out[k] = v.toISOString()
        else if (typeof v === "bigint") out[k] = String(v)
        else if (Array.isArray(v)) out[k] = v.map((e) => (e !== null && typeof e === "object" ? serialise({ ...(e as Record<string, unknown>) }) : e))
        else out[k] = v
    }
    return out
}
function serialiseAll(rows: readonly unknown[]): Array<Record<string, unknown>> {
    return rows.map((r) => serialise({ ...(r as Record<string, unknown>) }))
}
function param(request: Request, name: string): string {
    return str(new URL(request.url).searchParams.get(name), name)
}
function optParam(request: Request, name: string): string | null {
    const v = new URL(request.url).searchParams.get(name)
    return v && v.trim() ? v.trim() : null
}

const SUBJECT_TYPES = ["VARIANT", "FULFILMENT", "RETURN"] as const
function subjectType(value: unknown): "VARIANT" | "FULFILMENT" | "RETURN" {
    const raw = str(value, "subjectType")
    if (!(SUBJECT_TYPES as readonly string[]).includes(raw)) {
        throw new PersistenceError("BAD_REQUEST", "subjectType must be VARIANT, FULFILMENT or RETURN", {
            field: "subjectType",
        })
    }
    return raw as "VARIANT" | "FULFILMENT" | "RETURN"
}

/**
 * The surface tag for the shared sanitizing failure logger. A fixed literal, never derived from a request;
 * `logDependencyFailure` now checks that shape rather than trusting it - see `safeScope` there.
 */
const FAILURE_LOG_SCOPE = "[commerce]"

export class CommerceApiService {
    constructor(
        private readonly variants: VariantService,
        private readonly fulfilments: FulfilmentService,
        private readonly returns: ReturnService,
    ) {}

    /**
     * THE ONE FAILURE FUNNEL FOR THIS SURFACE, AND NOW THE ONE PLACE IT IS TRACED. Was
     * `op().catch(failure)`: a 503 with no server-side trace at all, so an outage on any method of this
     * boundary was invisible. `failure` still receives exactly the one argument a rejected promise handed
     * it, so status, body and headers are byte-identical; the logger is a side channel that swallows its own
     * failures, and it skips `PersistenceError` so routine refusals stay out of the incident log and cannot
     * be used to tell a foreign id from a nonexistent one.
     */
    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch((error: unknown) => {
            logDependencyFailure(FAILURE_LOG_SCOPE, error)
            return failure(error)
        })
    }
    private actor(): CommerceActor {
        return { actorType: "STAFF", actorId: null }
    }

    // ---- options and variants ------------------------------------------

    listProducts(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ products: serialiseAll(await this.variants.listProducts(param(request, "workspaceId"))) }),
        )
    }

    listOrders(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ orders: serialiseAll(await this.fulfilments.listOrders(param(request, "workspaceId"))) }),
        )
    }

    listOptions(productId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ options: serialiseAll(await this.variants.listOptions(param(request, "workspaceId"), productId)) }),
        )
    }

    addOption(productId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.variants.addOption(
                str(input.workspaceId, "workspaceId"),
                productId,
                {
                    name: str(input.name, "name"),
                    ordinal: optInt(input.ordinal, "ordinal"),
                    values: strArray(input.values, "values"),
                },
                this.actor(),
            )
            return success({ option: serialise({ ...row }) }, 201)
        })
    }

    addOptionValue(optionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.variants.addOptionValue(
                str(input.workspaceId, "workspaceId"),
                optionId,
                { value: str(input.value, "value"), ordinal: optInt(input.ordinal, "ordinal") },
                this.actor(),
            )
            return success({ optionValue: serialise({ ...row }) }, 201)
        })
    }

    listVariants(productId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ variants: serialiseAll(await this.variants.list(param(request, "workspaceId"), productId)) }),
        )
    }

    getVariant(variantId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ variant: serialise({ ...(await this.variants.get(param(request, "workspaceId"), variantId)) }) }),
        )
    }

    createVariant(productId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.variants.create(
                str(input.workspaceId, "workspaceId"),
                productId,
                {
                    title: str(input.title, "title"),
                    sku: nullableStr(input.sku, "sku"),
                    priceCents: optInt(input.priceCents, "priceCents"),
                    compareAtCents: optInt(input.compareAtCents, "compareAtCents"),
                    weightGrams: optInt(input.weightGrams, "weightGrams"),
                    ordinal: optInt(input.ordinal, "ordinal"),
                    isActive: input.isActive !== false,
                    optionValueIds: strArray(input.optionValueIds, "optionValueIds"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { variant: serialise({ ...result.record }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    updateVariant(variantId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.variants.update(
                str(input.workspaceId, "workspaceId"),
                variantId,
                {
                    title: nullableStr(input.title, "title"),
                    sku: nullableStr(input.sku, "sku"),
                    priceCents: optInt(input.priceCents, "priceCents"),
                    compareAtCents: optInt(input.compareAtCents, "compareAtCents"),
                    weightGrams: optInt(input.weightGrams, "weightGrams"),
                    ordinal: optInt(input.ordinal, "ordinal"),
                    ...(input.isActive === undefined ? {} : { isActive: input.isActive === true }),
                    clearSku: input.clearSku === true,
                    clearPrice: input.clearPrice === true,
                },
                this.actor(),
            )
            return success({ variant: serialise({ ...row }) })
        })
    }

    // ---- fulfilment ----------------------------------------------------

    listFulfilments(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                fulfilments: serialiseAll(
                    await this.fulfilments.list(param(request, "workspaceId"), optParam(request, "orderId")),
                ),
            }),
        )
    }

    getFulfilment(fulfilmentId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                fulfilment: serialise({ ...(await this.fulfilments.get(param(request, "workspaceId"), fulfilmentId)) }),
            }),
        )
    }

    allocations(orderId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                allocations: serialiseAll(await this.fulfilments.allocations(param(request, "workspaceId"), orderId)),
            }),
        )
    }

    createFulfilment(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.fulfilments.create(
                str(input.workspaceId, "workspaceId"),
                {
                    orderId: str(input.orderId, "orderId"),
                    reference: str(input.reference, "reference"),
                    locationId: nullableStr(input.locationId, "locationId"),
                    carrier: nullableStr(input.carrier, "carrier"),
                    trackingNumber: nullableStr(input.trackingNumber, "trackingNumber"),
                    trackingUrl: nullableStr(input.trackingUrl, "trackingUrl"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { fulfilment: serialise({ ...result.fulfilment }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    addFulfilmentItem(fulfilmentId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.fulfilments.addItem(
                str(input.workspaceId, "workspaceId"),
                fulfilmentId,
                {
                    orderLineId: str(input.orderLineId, "orderLineId"),
                    variantId: nullableStr(input.variantId, "variantId"),
                    qty: optInt(input.qty, "qty"),
                },
                this.actor(),
            )
            return success({ item: serialise({ ...row }) }, 201)
        })
    }

    transitionFulfilment(fulfilmentId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.fulfilments.transition(
                str(input.workspaceId, "workspaceId"),
                fulfilmentId,
                state(input.state, fulfilmentFlow.is, "fulfilment"),
                this.actor(),
                {
                    reason: nullableStr(input.reason, "reason"),
                    ...(input.carrier === undefined ? {} : { carrier: nullableStr(input.carrier, "carrier") }),
                    ...(input.trackingNumber === undefined
                        ? {}
                        : { trackingNumber: nullableStr(input.trackingNumber, "trackingNumber") }),
                    ...(input.trackingUrl === undefined
                        ? {}
                        : { trackingUrl: nullableStr(input.trackingUrl, "trackingUrl") }),
                },
            )
            return success({ fulfilment: serialise({ ...row }) })
        })
    }

    // ---- returns -------------------------------------------------------

    listReturns(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                returns: serialiseAll(await this.returns.list(param(request, "workspaceId"), optParam(request, "orderId"))),
            }),
        )
    }

    getReturn(returnRequestId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                returnRequest: serialise({ ...(await this.returns.get(param(request, "workspaceId"), returnRequestId)) }),
            }),
        )
    }

    eligibility(orderId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ eligibility: serialiseAll(await this.returns.eligibility(param(request, "workspaceId"), orderId)) }),
        )
    }

    createReturn(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.returns.request(
                str(input.workspaceId, "workspaceId"),
                {
                    orderId: str(input.orderId, "orderId"),
                    reference: str(input.reference, "reference"),
                    reason: nullableStr(input.reason, "reason"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { returnRequest: serialise({ ...result.returnRequest }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    addReturnItem(returnRequestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.returns.addItem(
                str(input.workspaceId, "workspaceId"),
                returnRequestId,
                {
                    orderLineId: str(input.orderLineId, "orderLineId"),
                    variantId: nullableStr(input.variantId, "variantId"),
                    qty: optInt(input.qty, "qty"),
                },
                this.actor(),
            )
            return success({ item: serialise({ ...row }) }, 201)
        })
    }

    transitionReturn(returnRequestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.returns.transition(
                str(input.workspaceId, "workspaceId"),
                returnRequestId,
                state(input.state, returnFlow.is, "return"),
                this.actor(),
                {
                    decidedBy: nullableStr(input.decidedBy, "decidedBy"),
                    ...(input.decisionNote === undefined
                        ? {}
                        : { decisionNote: nullableStr(input.decisionNote, "decisionNote") }),
                    refundPaymentId: nullableStr(input.refundPaymentId, "refundPaymentId"),
                },
            )
            return success({ returnRequest: serialise({ ...row }) })
        })
    }

    settleReturnItem(returnRequestId: string, returnItemId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.returns.settleItem(
                str(input.workspaceId, "workspaceId"),
                returnRequestId,
                returnItemId,
                state(input.restockState, restockFlow.is, "restock", "restockState"),
                this.actor(),
                {
                    locationId: nullableStr(input.locationId, "locationId"),
                    reason: nullableStr(input.reason, "reason"),
                },
            )
            return success({
                item: serialise({ ...(result.item as Record<string, unknown>) }),
                replayed: result.replayed,
            })
        })
    }

    // ---- the append-only commerce timeline ------------------------------

    events(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                events: serialiseAll(
                    await this.variants.events(
                        param(request, "workspaceId"),
                        subjectType(param(request, "subjectType")),
                        param(request, "subjectId"),
                    ),
                ),
            }),
        )
    }
}
