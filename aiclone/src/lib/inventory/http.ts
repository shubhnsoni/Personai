import { PersistenceError } from "@/lib/persistence/errors"

import type { InventoryService } from "./engine"
import { reservationFlow } from "./lifecycle"
import type { InventoryActor } from "./shared"

/**
 * HTTP boundary for the inventory surface.
 *
 * The envelope mirrors PlatformService — { ok: true, data } / { ok: false, error: { code,
 * message } } with the same status map. It is restated rather than imported because that
 * file belongs to the P2-002 package; the route harness asserts both agree so drift is
 * caught by a test.
 *
 * A refusal that an owner can act on keeps its `details`, because "only 4 available" is
 * the whole point of the message. A dependency failure carries no detail at all.
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
        { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Inventory is temporarily unavailable" } },
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
function int(value: unknown, field: string): number {
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}
function optInt(value: unknown, field: string): number | null {
    if (value === null || value === undefined || value === "") return null
    return int(value, field)
}
function nullableStr(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}
function optDate(value: unknown, field: string): Date | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
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
        out[k] = v instanceof Date ? v.toISOString() : typeof v === "bigint" ? String(v) : v
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

export class InventoryApiService {
    constructor(private readonly inventory: InventoryService) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch(failure)
    }
    private actor(): InventoryActor {
        return { actorType: "STAFF", actorId: null }
    }

    // ---- stock records -------------------------------------------------

    list(request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                items: serialiseAll(
                    await this.inventory.list(param(request, "workspaceId"), optParam(request, "locationId")),
                ),
            }),
        )
    }

    create(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.inventory.ensureItem(
                str(input.workspaceId, "workspaceId"),
                {
                    productId: str(input.productId, "productId"),
                    locationId: str(input.locationId, "locationId"),
                    reorderPoint: optInt(input.reorderPoint, "reorderPoint"),
                    safetyStock: optInt(input.safetyStock, "safetyStock"),
                    trackingEnabled: input.trackingEnabled !== false,
                },
                this.actor(),
            )
            return success(
                { item: serialise({ ...result.record }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    get(itemId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ item: serialise({ ...(await this.inventory.get(param(request, "workspaceId"), itemId)) }) }),
        )
    }

    availability(request: Request): Promise<Response> {
        return this.run(async () => {
            const report = await this.inventory.availability(
                param(request, "workspaceId"),
                param(request, "productId"),
            )
            return success({
                availability: {
                    ...report,
                    locations: serialiseAll(report.locations),
                },
            })
        })
    }

    movements(itemId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                movements: serialiseAll(await this.inventory.movements(param(request, "workspaceId"), itemId)),
            }),
        )
    }

    // ---- direct movements ----------------------------------------------

    applyMovement(itemId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.inventory.applyMovement(
                str(input.workspaceId, "workspaceId"),
                itemId,
                {
                    // Validated inside the engine, which owns the movement vocabulary and
                    // is the only place that knows which kinds a caller may write.
                    kind: input.kind,
                    qty: int(input.qty, "qty"),
                    reason: nullableStr(input.reason, "reason"),
                    orderId: nullableStr(input.orderId, "orderId"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success({ item: serialise({ ...record }) })
        })
    }

    // ---- reservations --------------------------------------------------

    listReservations(itemId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                reservations: serialiseAll(
                    await this.inventory.listReservations(param(request, "workspaceId"), itemId),
                ),
            }),
        )
    }

    reserve(itemId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.inventory.reserve(
                str(input.workspaceId, "workspaceId"),
                itemId,
                {
                    orderLineId: str(input.orderLineId, "orderLineId"),
                    qty: optInt(input.qty, "qty"),
                    expiresAt: optDate(input.expiresAt, "expiresAt"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { reservation: serialise({ ...result.reservation }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    settleReservation(itemId: string, reservationId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.inventory.settleReservation(
                str(input.workspaceId, "workspaceId"),
                reservationId,
                state(input.state, reservationFlow.is, "reservation"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ reservation: serialise({ ...row }) })
        })
    }
}
