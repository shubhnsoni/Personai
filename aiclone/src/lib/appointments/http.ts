import { logDependencyFailure } from "@/lib/operations/dependency-failure-log"
import { PersistenceError } from "@/lib/persistence/errors"

import { evaluateAvailability } from "./availability"
import type { PersistedAppointments, AppointmentActor } from "./engine"
import { isAppointmentStatus, isDepositState, isWaitlistStatus, type AppointmentStatus } from "./lifecycle"
import type { AppointmentServices } from "./services"

/**
 * HTTP boundary for the shared appointments surface.
 *
 * The envelope mirrors PlatformService: { ok: true, data } / { ok: false, error: { code,
 * message } } with the same status map. It is restated rather than imported because that
 * file belongs to the P2-002 package; the route harness asserts the two agree, so drift
 * is caught by a test.
 *
 * The actor is always derived server-side. There is deliberately no parameter by which a
 * caller can name itself.
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
        {
            ok: false,
            error: { code: "DEPENDENCY_UNAVAILABLE", message: "Appointment persistence is temporarily unavailable" },
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
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}

function requiredDate(value: unknown, field: string): Date {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
}

function optionalInteger(value: unknown, field: string): number | undefined {
    if (value === undefined) return undefined
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}

function requiredStatus(value: unknown): AppointmentStatus {
    const raw = requiredString(value, "status")
    if (!isAppointmentStatus(raw)) {
        throw new PersistenceError("BAD_REQUEST", "status is not a recognised appointment status", { field: "status" })
    }
    return raw
}

function serialise(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = v instanceof Date ? v.toISOString() : v
    return out
}

function searchParam(request: Request, name: string): string {
    return requiredString(new URL(request.url).searchParams.get(name), name)
}

/**
 * The surface tag for the shared sanitizing failure logger. A fixed literal, never derived from a request;
 * `logDependencyFailure` now checks that shape rather than trusting it - see `safeScope` there.
 */
const FAILURE_LOG_SCOPE = "[appointments]"

export class AppointmentApiService {
    constructor(
        private readonly appointments: PersistedAppointments,
        private readonly services: AppointmentServices,
    ) {}

    /**
     * THE ONE FAILURE FUNNEL FOR THIS SURFACE, AND NOW THE ONE PLACE IT IS TRACED. Was
     * `operation().catch(failure)`: a 503 with no server-side trace at all, so an outage on any method of
     * this boundary was invisible. `failure` still receives exactly the one argument a rejected promise
     * handed it, so status, body and headers are byte-identical; the logger is a side channel that swallows
     * its own failures, and it skips `PersistenceError` so routine refusals stay out of the incident log and
     * cannot be used to tell a foreign id from a nonexistent one.
     */
    private run(operation: () => Promise<Response>): Promise<Response> {
        return operation().catch((error: unknown) => {
            logDependencyFailure(FAILURE_LOG_SCOPE, error)
            return failure(error)
        })
    }

    private actor(): AppointmentActor {
        return { actorType: "STAFF", actorId: null }
    }

    // ---- appointments --------------------------------------------------

    list(request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const appointments = await this.appointments.list(workspaceId)
            return success({ appointments: appointments.map((a) => serialise({ ...a })) })
        })
    }

    create(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const result = await this.appointments.book(
                workspaceId,
                {
                    serviceOfferingId: requiredString(input.serviceOfferingId, "serviceOfferingId"),
                    resourceId: requiredString(input.resourceId, "resourceId"),
                    startTime: requiredDate(input.startTime, "startTime"),
                    endTime: requiredDate(input.endTime, "endTime"),
                    visitorName: requiredString(input.visitorName, "visitorName"),
                    visitorEmail: requiredString(input.visitorEmail, "visitorEmail"),
                    partySize: optionalInteger(input.partySize, "partySize"),
                    locationId: nullableString(input.locationId, "locationId"),
                    idempotencyKey: nullableString(input.idempotencyKey, "idempotencyKey"),
                    hold: input.hold === true,
                },
                this.actor(),
            )
            return success(
                { appointment: serialise({ ...result.appointment }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    get(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const appointment = await this.appointments.get(workspaceId, id)
            return success({ appointment: serialise({ ...appointment }) })
        })
    }

    transition(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const appointment = await this.appointments.transition(
                workspaceId,
                id,
                requiredStatus(input.status),
                this.actor(),
                nullableString(input.reason, "reason"),
            )
            return success({ appointment: serialise({ ...appointment }) })
        })
    }

    history(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const events = await this.appointments.history(workspaceId, id)
            return success({ events: events.map((e) => serialise({ ...e })) })
        })
    }

    resources(request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const resources = await this.appointments.listResources(workspaceId)
            return success({ resources: resources.map((r) => serialise({ ...r })) })
        })
    }

    /**
     * Availability lookup through the SAME shared evaluator the booking path uses, so a
     * slot this reports as available cannot be refused later for an availability reason.
     */
    availability(request: Request): Promise<Response> {
        return this.run(async () => {
            const url = new URL(request.url)
            const workspaceId = searchParam(request, "workspaceId")
            const start = requiredDate(url.searchParams.get("startTime"), "startTime")
            const end = requiredDate(url.searchParams.get("endTime"), "endTime")
            // Tenant-check first; the windows come back scoped to that profile.
            const context = await this.appointments.availabilityContext(workspaceId)
            const verdict = evaluateAvailability({ start, end, windows: context.windows, overrides: context.overrides })
            return success({
                available: verdict.available,
                reason: verdict.available ? null : verdict.reason,
                bufferMinutes: context.bufferMinutes,
            })
        })
    }

    // ---- waitlist ------------------------------------------------------

    listWaitlist(request: Request): Promise<Response> {
        return this.run(async () => {
            const url = new URL(request.url)
            const workspaceId = searchParam(request, "workspaceId")
            const entries = await this.services.listWaitlist(
                workspaceId,
                url.searchParams.get("serviceOfferingId") ?? undefined,
            )
            return success({ entries: entries.map((e) => serialise({ ...e })) })
        })
    }

    joinWaitlist(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const result = await this.services.joinWaitlist(
                workspaceId,
                {
                    serviceOfferingId: requiredString(input.serviceOfferingId, "serviceOfferingId"),
                    resourceId: nullableString(input.resourceId, "resourceId"),
                    requestedStart: requiredDate(input.requestedStart, "requestedStart"),
                    requestedEnd: requiredDate(input.requestedEnd, "requestedEnd"),
                    guestName: requiredString(input.guestName, "guestName"),
                    guestEmail: nullableString(input.guestEmail, "guestEmail"),
                    guestPhone: nullableString(input.guestPhone, "guestPhone"),
                    partySize: optionalInteger(input.partySize, "partySize"),
                    idempotencyKey: nullableString(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { entry: serialise({ ...result.entry }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    promoteWaitlist(entryId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const result = await this.services.promoteWaitlistEntry(workspaceId, entryId, this.actor())
            return success({ entry: serialise({ ...result.entry }), bookingId: result.bookingId })
        })
    }

    cancelWaitlist(entryId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const raw = requiredString(input.status, "status")
            if (!isWaitlistStatus(raw)) {
                throw new PersistenceError("BAD_REQUEST", "status is not a recognised waitlist status", { field: "status" })
            }
            const entry = await this.services.transitionWaitlist(workspaceId, entryId, raw)
            return success({ entry: serialise({ ...entry }) })
        })
    }

    // ---- deposits ------------------------------------------------------

    getDeposit(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const deposit = await this.services.getDeposit(workspaceId, id)
            return success({ deposit: deposit ? serialise({ ...deposit }) : null })
        })
    }

    requireDeposit(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const result = await this.services.requireDeposit(
                workspaceId,
                {
                    bookingId: id,
                    amountCents: optionalInteger(input.amountCents, "amountCents") ?? 0,
                    currency: nullableString(input.currency, "currency") ?? undefined,
                    idempotencyKey: nullableString(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success(
                { deposit: serialise({ ...result.deposit }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionDeposit(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const raw = requiredString(input.state, "state")
            if (!isDepositState(raw)) {
                throw new PersistenceError("BAD_REQUEST", "state is not a recognised deposit state", { field: "state" })
            }
            const deposit = await this.services.transitionDeposit(workspaceId, id, raw, this.actor())
            return success({ deposit: serialise({ ...deposit }) })
        })
    }

    // ---- reminders -----------------------------------------------------

    listReminders(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const workspaceId = searchParam(request, "workspaceId")
            const reminders = await this.services.listReminders(workspaceId, id)
            return success({ reminders: reminders.map((r) => serialise({ ...r })) })
        })
    }

    scheduleReminder(id: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const workspaceId = requiredString(input.workspaceId, "workspaceId")
            const channel = requiredString(input.channel, "channel")
            if (!["EMAIL", "SMS", "WHATSAPP"].includes(channel)) {
                throw new PersistenceError("BAD_REQUEST", "channel must be EMAIL, SMS or WHATSAPP", { field: "channel" })
            }
            const result = await this.services.scheduleReminder(
                workspaceId,
                { bookingId: id, channel: channel as "EMAIL" | "SMS" | "WHATSAPP", sendAt: requiredDate(input.sendAt, "sendAt") },
                this.actor(),
            )
            return success(
                { reminder: serialise({ ...result.reminder }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }
}
