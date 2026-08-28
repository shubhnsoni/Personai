import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

import { applyBuffer, evaluateAvailability } from "./availability"
import {
    OCCUPYING_STATUSES,
    TRANSITION_TIMESTAMP_FIELD,
    allowedTransitionsFrom,
    canTransition,
    isTerminal,
    type AppointmentStatus,
} from "./lifecycle"

/**
 * Persisted appointments engine — one engine for coaching, consulting, CA practice,
 * salon, events, real estate and pet care. There is deliberately no per-industry
 * variant.
 *
 * Tenancy follows the bridge Wave A established and proved: the restaurant and booking
 * domains are profileId-scoped while /api/platform is workspaceId-scoped, and
 * Workspace.profileId is already unique. Every read and write resolves the caller's
 * workspace to that profileId and requires the resource, service and booking to carry
 * the same one.
 *
 * Non-enumeration: a foreign booking and a nonexistent booking produce the IDENTICAL
 * refusal, so callers cannot probe for existence.
 *
 * Conflict prevention is the same two-layer design Wave A verified:
 *   1. transactional SELECT ... FOR UPDATE on the parent AppointmentResource, then an
 *      overlap test — the PRIMARY mechanism, proven under interleaved transactions;
 *   2. the partial Booking_resource_no_overlap exclusion constraint — defense in depth
 *      against a direct SQL writer that bypasses this engine.
 */

const EXCLUSION_VIOLATION = "23P01"
const UNIQUE_VIOLATION = "23505"
const OVERLAP_CONSTRAINT = "Booking_resource_no_overlap"
const IDEMPOTENCY_CONSTRAINT = "Booking_profileId_idempotencyKey_key"

/**
 * Reads a Postgres SQLSTATE out of the several shapes Prisma uses. Wave A shipped a
 * version that only parsed raw-query messages and consequently mis-reported a real
 * exclusion-constraint conflict as an unexpected error; this covers Prisma Client
 * errors too, and falls back to constraint identity.
 */
function pgCode(error: unknown): string | null {
    const anyErr = error as
        | { code?: unknown; meta?: { code?: unknown; constraint?: unknown; target?: unknown } }
        | null
    if (!anyErr) return null
    if (typeof anyErr.code === "string" && /^\d{5}$/.test(anyErr.code)) return anyErr.code
    if (typeof anyErr.meta?.code === "string" && /^\d{5}$/.test(anyErr.meta.code)) return anyErr.meta.code

    const message = error instanceof Error ? error.message : String(error)
    const match = /Code: `(\d{5})`/.exec(message)
    if (match) return match[1]

    const constraint =
        (typeof anyErr.meta?.constraint === "string" ? anyErr.meta.constraint : null) ??
        (Array.isArray(anyErr.meta?.target) ? anyErr.meta?.target.join(",") : null) ??
        ""
    if (constraint.includes(OVERLAP_CONSTRAINT) || message.includes(OVERLAP_CONSTRAINT)) return EXCLUSION_VIOLATION
    if (constraint.includes(IDEMPOTENCY_CONSTRAINT) || message.includes(IDEMPOTENCY_CONSTRAINT)) return UNIQUE_VIOLATION
    return null
}

export type AppointmentRecord = Readonly<{
    id: string
    profileId: string
    serviceOfferingId: string
    serviceName: string | null
    resourceId: string | null
    resourceName: string | null
    locationId: string | null
    visitorName: string
    visitorEmail: string
    partySize: number
    startTime: Date
    endTime: Date
    status: AppointmentStatus
    idempotencyKey: string | null
    holdExpiresAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
    allowedTransitions: readonly AppointmentStatus[]
}>

export type BookAppointmentInput = Readonly<{
    serviceOfferingId: string
    resourceId: string
    startTime: Date
    endTime: Date
    visitorName: string
    visitorEmail: string
    partySize?: number
    locationId?: string | null
    idempotencyKey?: string | null
    hold?: boolean
}>

export type AppointmentActor = Readonly<{ actorType: "GUEST" | "STAFF" | "SYSTEM"; actorId: string | null }>

type RawBooking = {
    id: string
    profileId: string
    serviceOfferingId: string
    resourceId: string | null
    locationId: string | null
    visitorName: string
    visitorEmail: string
    partySize: number
    startTime: Date
    endTime: Date
    status: string
    idempotencyKey: string | null
    holdExpiresAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
    serviceOffering?: { name: string } | null
    resource?: { name: string } | null
}

export class PersistedAppointments {
    constructor(
        private readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    private async requireVenue(workspaceId: string, permission: "profile.read" | "profile.update") {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a bookable profile")
        }
        return { access, profileId: workspace.profileId }
    }

    private toRecord(row: RawBooking): AppointmentRecord {
        const status = row.status as AppointmentStatus
        return Object.freeze({
            id: row.id,
            profileId: row.profileId,
            serviceOfferingId: row.serviceOfferingId,
            serviceName: row.serviceOffering?.name ?? null,
            resourceId: row.resourceId,
            resourceName: row.resource?.name ?? null,
            locationId: row.locationId,
            visitorName: row.visitorName,
            visitorEmail: row.visitorEmail,
            partySize: row.partySize,
            startTime: row.startTime,
            endTime: row.endTime,
            status,
            idempotencyKey: row.idempotencyKey,
            holdExpiresAt: row.holdExpiresAt,
            cancelReason: row.cancelReason,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            allowedTransitions: allowedTransitionsFrom(status),
        })
    }

    async listResources(workspaceId: string) {
        const { profileId } = await this.requireVenue(workspaceId, "profile.read")
        const rows = await this.db.appointmentResource.findMany({
            where: { profileId },
            orderBy: [{ name: "asc" }],
        })
        for (const row of rows) {
            if (row.profileId !== profileId) throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    name: r.name,
                    kind: r.kind,
                    capacity: r.capacity,
                    isActive: r.isActive,
                    locationId: r.locationId,
                }),
            ),
        )
    }

    async list(workspaceId: string): Promise<readonly AppointmentRecord[]> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.read")
        const rows = await this.db.booking.findMany({
            where: { profileId },
            include: { serviceOffering: { select: { name: true } }, resource: { select: { name: true } } },
            orderBy: [{ startTime: "asc" }, { id: "asc" }],
        })
        // Revalidate the tenant on the way out rather than trusting the query alone.
        for (const row of rows) {
            if (row.profileId !== profileId) throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        return Object.freeze(rows.map((row) => this.toRecord(row as RawBooking)))
    }

    async get(workspaceId: string, bookingId: string): Promise<AppointmentRecord> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.read")
        const id = bookingId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "bookingId is required")
        const row = await this.db.booking.findUnique({
            where: { id },
            include: { serviceOffering: { select: { name: true } }, resource: { select: { name: true } } },
        })
        // Foreign and nonexistent are indistinguishable.
        if (!row || row.profileId !== profileId) throw new PersistenceError("FORBIDDEN", "Access denied")
        return this.toRecord(row as RawBooking)
    }

    async book(
        workspaceId: string,
        input: BookAppointmentInput,
        actor: AppointmentActor,
    ): Promise<{ appointment: AppointmentRecord; replayed: boolean }> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.update")

        const serviceOfferingId = input.serviceOfferingId?.trim()
        if (!serviceOfferingId) throw new PersistenceError("BAD_REQUEST", "serviceOfferingId is required")
        const resourceId = input.resourceId?.trim()
        if (!resourceId) throw new PersistenceError("BAD_REQUEST", "resourceId is required")
        const visitorName = input.visitorName?.trim()
        if (!visitorName) throw new PersistenceError("BAD_REQUEST", "visitorName is required")
        const visitorEmail = input.visitorEmail?.trim()
        if (!visitorEmail) throw new PersistenceError("BAD_REQUEST", "visitorEmail is required")
        if (!(input.startTime instanceof Date) || Number.isNaN(input.startTime.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "startTime must be a valid timestamp")
        }
        if (!(input.endTime instanceof Date) || Number.isNaN(input.endTime.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "endTime must be a valid timestamp")
        }
        if (input.endTime.getTime() <= input.startTime.getTime()) {
            throw new PersistenceError("BAD_REQUEST", "endTime must be after startTime")
        }
        const partySize = input.partySize ?? 1
        if (!Number.isInteger(partySize) || partySize < 1) {
            throw new PersistenceError("BAD_REQUEST", "partySize must be a positive integer")
        }

        const idempotencyKey = input.idempotencyKey?.trim() || null

        // Idempotent replay returns the ORIGINAL row and writes no second event.
        if (idempotencyKey) {
            const existing = await this.db.booking.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
                include: { serviceOffering: { select: { name: true } }, resource: { select: { name: true } } },
            })
            if (existing) {
                return { appointment: this.toRecord(existing as RawBooking), replayed: true }
            }
        }

        const status: AppointmentStatus = input.hold ? "HELD" : "CONFIRMED"

        try {
            const created = await this.db.$transaction(async (tx) => {
                // Serialize every writer for this resource. The overlap test below cannot
                // be raced once this lock is held.
                const locked = await tx.$queryRawUnsafe<
                    Array<{ id: string; profileId: string; capacity: number | null; isActive: boolean; name: string }>
                >(
                    `select "id","profileId","capacity","isActive","name"
                       from "AppointmentResource"
                      where "id" = $1
                      for update`,
                    resourceId,
                )
                const resource = locked[0]

                // A resource from another tenant is refused exactly as a nonexistent one.
                if (!resource || resource.profileId !== profileId) {
                    throw new PersistenceError("FORBIDDEN", "Access denied")
                }
                if (!resource.isActive) {
                    throw new PersistenceError("CONFLICT", "That resource is not accepting bookings")
                }

                // Service must belong to the same tenant, and must be eligible for this
                // resource when an eligibility list exists.
                const service = await tx.serviceOffering.findUnique({
                    where: { id: serviceOfferingId },
                    select: { id: true, profileId: true, isActive: true, name: true },
                })
                if (!service || service.profileId !== profileId) {
                    throw new PersistenceError("FORBIDDEN", "Access denied")
                }
                if (!service.isActive) {
                    throw new PersistenceError("CONFLICT", "That service is not currently offered")
                }

                const eligibility = await tx.serviceResource.findMany({
                    where: { serviceOfferingId },
                    select: { resourceId: true },
                })
                if (eligibility.length > 0 && !eligibility.some((e) => e.resourceId === resourceId)) {
                    throw new PersistenceError("CONFLICT", "That resource does not provide this service")
                }

                // Capacity is FAIL-CLOSED. capacity is nullable, so an unconfigured
                // resource cannot be validated and is refused rather than assumed
                // unlimited.
                if (resource.capacity === null) {
                    throw new PersistenceError(
                        "CONFLICT",
                        "That resource has no capacity configured, so availability cannot be verified",
                    )
                }
                if (partySize > resource.capacity) {
                    throw new PersistenceError(
                        "CONFLICT",
                        `A party of ${partySize} exceeds the capacity of ${resource.capacity} for this resource`,
                    )
                }

                // Published availability, from the pre-existing schedule and overrides.
                const profile = await tx.profile.findUnique({
                    where: { id: profileId },
                    select: { bufferMinutes: true },
                })
                const windows = await tx.availabilitySchedule.findMany({ where: { profileId } })
                const overrides = await tx.calendarOverride.findMany({ where: { profileId } })
                const verdict = evaluateAvailability({
                    start: input.startTime,
                    end: input.endTime,
                    windows,
                    overrides,
                })
                if (!verdict.available) {
                    throw new PersistenceError("CONFLICT", verdict.reason)
                }

                // Conflict test under the lock, widened by the owner's buffer so
                // back-to-back bookings keep a gap.
                //
                // This deliberately uses Prisma's TYPED count rather than a raw query
                // with Date parameters. Against a `timestamp without time zone` column,
                // Prisma writes a Date by its UTC components but binds a Date PARAMETER
                // in raw SQL as local wall-clock. On a UTC+05:30 host that asymmetry made
                // the predicate silently false: a stored 12:30 was compared against a
                // bound 17:30. The typed API is symmetric with how the rows were written.
                // Verified empirically: raw+Date returned 0 conflicts where typed and
                // naive-UTC-string forms both returned 1, with adjacency still 0.
                const { from, to } = applyBuffer(input.startTime, input.endTime, profile?.bufferMinutes ?? 0)
                const clash = await tx.booking.count({
                    where: {
                        resourceId,
                        status: { in: [...OCCUPYING_STATUSES] },
                        startTime: { lt: to },
                        endTime: { gt: from },
                    },
                })
                if (clash > 0) {
                    throw new PersistenceError(
                        "CONFLICT",
                        "That resource is already booked for an overlapping time",
                        // Records WHICH layer refused. The exclusion constraint cannot see
                        // the buffer, so an application-detected conflict is the only
                        // proof that this check works rather than being masked by the
                        // database constraint.
                        { detectedBy: "application" },
                    )
                }

                const row = await tx.booking.create({
                    data: {
                        profileId,
                        serviceOfferingId,
                        resourceId,
                        locationId: input.locationId?.trim() || null,
                        visitorName,
                        visitorEmail,
                        partySize,
                        startTime: input.startTime,
                        endTime: input.endTime,
                        status,
                        idempotencyKey,
                        holdExpiresAt: input.hold ? new Date(Date.now() + 15 * 60_000) : null,
                        confirmedAt: status === "CONFIRMED" ? new Date() : null,
                    },
                    include: { serviceOffering: { select: { name: true } }, resource: { select: { name: true } } },
                })

                await tx.appointmentEvent.create({
                    data: {
                        bookingId: row.id,
                        kind: "CREATED",
                        from: null,
                        to: status,
                        actor: actor.actorType,
                        actorId: actor.actorId,
                        metadata: { resourceId, serviceOfferingId, partySize },
                    },
                })

                return row
            })

            return { appointment: this.toRecord(created as RawBooking), replayed: false }
        } catch (error) {
            if (error instanceof PersistenceError) throw error
            const code = pgCode(error)
            if (code === EXCLUSION_VIOLATION) {
                throw new PersistenceError(
                    "CONFLICT",
                    "That resource is already booked for an overlapping time",
                    { detectedBy: "database" },
                )
            }
            if (code === UNIQUE_VIOLATION) {
                throw new PersistenceError("CONFLICT", "A booking with this idempotency key already exists")
            }
            throw error
        }
    }

    async transition(
        workspaceId: string,
        bookingId: string,
        to: AppointmentStatus,
        actor: AppointmentActor,
        reason?: string | null,
    ): Promise<AppointmentRecord> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.update")
        const id = bookingId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "bookingId is required")

        const updated = await this.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: string }>>(
                `select "id","profileId","status" from "Booking" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }

            const from = current.status as AppointmentStatus
            if (isTerminal(from)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `This appointment is already ${from.toLowerCase().replace(/_/g, " ")} and cannot change`,
                )
            }
            if (!canTransition(from, to)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `Cannot move a ${from.toLowerCase().replace(/_/g, " ")} appointment to ${to.toLowerCase().replace(/_/g, " ")}`,
                )
            }

            const stamp = TRANSITION_TIMESTAMP_FIELD[to]
            const row = await tx.booking.update({
                where: { id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason?.trim() || null } : {}),
                    ...(to === "CONFIRMED" ? { holdExpiresAt: null } : {}),
                },
                include: { serviceOffering: { select: { name: true } }, resource: { select: { name: true } } },
            })

            await tx.appointmentEvent.create({
                data: {
                    bookingId: id,
                    kind: "STATUS",
                    from,
                    to,
                    actor: actor.actorType,
                    actorId: actor.actorId,
                    metadata: reason ? { reason } : undefined,
                },
            })

            return row
        })

        return this.toRecord(updated as RawBooking)
    }

    /** Append-only history for one appointment, tenant-checked first. */
    async history(workspaceId: string, bookingId: string) {
        await this.get(workspaceId, bookingId)
        const events = await this.db.appointmentEvent.findMany({
            where: { bookingId: bookingId.trim() },
            orderBy: { seq: "asc" },
        })
        return Object.freeze(
            events.map((e) =>
                Object.freeze({
                    id: e.id,
                    seq: String(e.seq),
                    kind: e.kind,
                    from: e.from,
                    to: e.to,
                    actor: e.actor,
                    actorId: e.actorId,
                    at: e.at,
                }),
            ),
        )
    }
}
