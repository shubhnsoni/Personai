import { PersistenceError } from "@/lib/persistence/errors"

import type { PersistedReservations, ReservationActor } from "./engine"
import { isReservationStatus, type ReservationStatusValue } from "./lifecycle"

/**
 * HTTP boundary for reservations.
 *
 * The envelope shape deliberately MIRRORS PlatformService in
 * src/lib/persistence/service.ts: { ok: true, data } on success and
 * { ok: false, error: { code, message } } on refusal, with the same status map.
 * It is restated here rather than imported because that file belongs to the P2-002
 * package; the A3 harness asserts the two envelopes agree, so drift is caught by a
 * test rather than left to chance.
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
    // Never leak an internal message or stack to the caller.
    return json(
        {
            ok: false,
            error: {
                code: "DEPENDENCY_UNAVAILABLE",
                message: "Reservation persistence is temporarily unavailable",
            },
        },
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

function requiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
    }
    return value.trim()
}

function nullableString(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") {
        throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    }
    return value.trim() || null
}

function requiredDate(value: unknown, field: string): Date {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
}

function requiredInteger(value: unknown, field: string): number {
    if (!Number.isInteger(value)) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    }
    return value as number
}

function requiredStatus(value: unknown): ReservationStatusValue {
    const raw = requiredString(value, "status")
    if (!isReservationStatus(raw)) {
        throw new PersistenceError("BAD_REQUEST", "status is not a recognised reservation status", {
            field: "status",
        })
    }
    return raw
}

/** Serialises dates to ISO so the envelope is stable across transports. */
function serialise(reservation: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(reservation)) {
        out[k] = v instanceof Date ? v.toISOString() : v
    }
    return out
}

export class ReservationService {
    constructor(private readonly reservations: PersistedReservations) {}

    private run(operation: () => Promise<Response>): Promise<Response> {
        return operation().catch(failure)
    }

    /**
     * The actor is derived server-side. There is deliberately no way for a caller
     * to name itself: the engine already resolved the authenticated user through
     * PersistedTenancy, and staff actions are attributed to STAFF.
     */
    private actor(): ReservationActor {
        return { actorType: "STAFF", actorId: null }
    }

    list(request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = requiredString(
                new URL(request.url).searchParams.get("workspaceId"),
                "workspaceId",
            )
            const reservations = await this.reservations.list(workspaceId)
            return success({ reservations: reservations.map((r) => serialise({ ...r })) })
        })
    }

    create(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const result = await this.reservations.create(
                workspaceId,
                {
                    tableId: requiredString(input.tableId, "tableId"),
                    partySize: requiredInteger(input.partySize, "partySize"),
                    startAt: requiredDate(input.startAt, "startAt"),
                    endAt: requiredDate(input.endAt, "endAt"),
                    guestName: requiredString(input.guestName, "guestName"),
                    guestPhone: nullableString(input.guestPhone, "guestPhone"),
                    guestEmail: nullableString(input.guestEmail, "guestEmail"),
                    note: nullableString(input.note, "note"),
                    idempotencyKey: nullableString(input.idempotencyKey, "idempotencyKey"),
                    hold: input.hold === true,
                },
                this.actor(),
            )
            // A replay is not a fresh creation, so it answers 200 rather than 201.
            return success(
                { reservation: serialise({ ...result.reservation }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    get(reservationId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = requiredString(
                new URL(request.url).searchParams.get("workspaceId"),
                "workspaceId",
            )
            const reservation = await this.reservations.get(workspaceId, reservationId)
            return success({ reservation: serialise({ ...reservation }) })
        })
    }

    transition(reservationId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const reservation = await this.reservations.transition(
                workspaceId,
                reservationId,
                requiredStatus(input.status),
                this.actor(),
                nullableString(input.reason, "reason"),
            )
            return success({ reservation: serialise({ ...reservation }) })
        })
    }

    history(reservationId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = requiredString(
                new URL(request.url).searchParams.get("workspaceId"),
                "workspaceId",
            )
            const events = await this.reservations.history(workspaceId, reservationId)
            return success({ events: events.map((e) => serialise({ ...e })) })
        })
    }
}
