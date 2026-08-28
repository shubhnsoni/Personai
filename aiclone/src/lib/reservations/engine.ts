import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

import {
    canTransition,
    isTerminal,
    OCCUPYING_STATUSES,
    TRANSITION_TIMESTAMP_FIELD,
    allowedTransitionsFrom,
    type ReservationStatusValue,
} from "./lifecycle"

/**
 * Persisted reservation engine.
 *
 * Tenancy model, and why it is shaped this way:
 *
 * The restaurant domain (RestaurantTable, Order, OrderCounter) is profileId-scoped,
 * while the /api/platform surface is workspaceId-scoped through PersistedTenancy.
 * Workspace.profileId is already unique, so this engine resolves the caller's
 * workspace to its profileId and then requires that every table and reservation it
 * touches carries the SAME profileId. That is the venue-isolation boundary, and it
 * composes the tenancy that already exists rather than inventing a second key.
 *
 * Non-enumeration: a reservation or table belonging to another venue produces the
 * IDENTICAL error as one that does not exist. Callers cannot distinguish the two,
 * so they cannot probe for existence.
 */

const OCCUPYING_LIST = OCCUPYING_STATUSES.map((s) => `'${s}'`).join(", ")

/** Postgres exclusion-constraint violation. */
const EXCLUSION_VIOLATION = "23P01"
/** Postgres unique-constraint violation. */
const UNIQUE_VIOLATION = "23505"
/** The overlap constraint added by 20260828170000_restaurant_reservations. */
const OVERLAP_CONSTRAINT = "Reservation_no_overlap"
/** The idempotency constraint. */
const IDEMPOTENCY_CONSTRAINT = "Reservation_profileId_idempotencyKey_key"

/**
 * Extracts a Postgres SQLSTATE from the several shapes Prisma uses.
 *
 * Raw queries surface it as "Code: `23P01`" in the message, while Prisma Client
 * methods wrap it in a PrismaClientKnownRequestError whose `meta` may carry the
 * driver code and whose message names the violated constraint. Relying on only one
 * of these is why the first version of this mapping mis-reported a real
 * exclusion-constraint conflict as an unexpected error.
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

    // Fall back to the constraint identity, which is unambiguous even when no
    // SQLSTATE survives the wrapping.
    const constraint =
        (typeof anyErr.meta?.constraint === "string" ? anyErr.meta.constraint : null) ??
        (Array.isArray(anyErr.meta?.target) ? anyErr.meta?.target.join(",") : null) ??
        ""
    if (constraint.includes(OVERLAP_CONSTRAINT) || message.includes(OVERLAP_CONSTRAINT)) {
        return EXCLUSION_VIOLATION
    }
    if (constraint.includes(IDEMPOTENCY_CONSTRAINT) || message.includes(IDEMPOTENCY_CONSTRAINT)) {
        return UNIQUE_VIOLATION
    }
    return null
}

export type ReservationRecord = Readonly<{
    id: string
    profileId: string
    tableId: string
    tableLabel: string | null
    partySize: number
    startAt: Date
    endAt: Date
    status: ReservationStatusValue
    guestName: string
    guestPhone: string | null
    guestEmail: string | null
    note: string | null
    idempotencyKey: string | null
    holdExpiresAt: Date | null
    createdAt: Date
    updatedAt: Date
    allowedTransitions: readonly ReservationStatusValue[]
}>

export type CreateReservationInput = Readonly<{
    tableId: string
    partySize: number
    startAt: Date
    endAt: Date
    guestName: string
    guestPhone?: string | null
    guestEmail?: string | null
    note?: string | null
    idempotencyKey?: string | null
    hold?: boolean
}>

export type ReservationActor = Readonly<{ actorType: "STAFF" | "SYSTEM"; actorId: string | null }>

type RawReservation = {
    id: string
    profileId: string
    tableId: string
    partySize: number
    startAt: Date
    endAt: Date
    status: ReservationStatusValue
    guestName: string
    guestPhone: string | null
    guestEmail: string | null
    note: string | null
    idempotencyKey: string | null
    holdExpiresAt: Date | null
    createdAt: Date
    updatedAt: Date
    tableLabel: string | null
}

export class PersistedReservations {
    constructor(
        private readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /**
     * Resolves the caller's workspace to the venue profileId it owns, after
     * enforcing membership and the required permission. Throws FORBIDDEN when the
     * workspace exists but is not linked to a venue profile, because in that case
     * there is no venue to be isolated to.
     */
    private async requireVenue(workspaceId: string, permission: "profile.read" | "profile.update") {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a venue")
        }
        return { access, profileId: workspace.profileId }
    }

    private toRecord(row: RawReservation): ReservationRecord {
        return Object.freeze({
            id: row.id,
            profileId: row.profileId,
            tableId: row.tableId,
            tableLabel: row.tableLabel,
            partySize: row.partySize,
            startAt: row.startAt,
            endAt: row.endAt,
            status: row.status,
            guestName: row.guestName,
            guestPhone: row.guestPhone,
            guestEmail: row.guestEmail,
            note: row.note,
            idempotencyKey: row.idempotencyKey,
            holdExpiresAt: row.holdExpiresAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            allowedTransitions: allowedTransitionsFrom(row.status),
        })
    }

    async list(workspaceId: string): Promise<readonly ReservationRecord[]> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.read")

        const rows = await this.db.reservation.findMany({
            where: { profileId },
            include: { table: { select: { label: true } } },
            orderBy: [{ startAt: "asc" }, { id: "asc" }],
        })

        // Revalidate the tenant on the way out rather than trusting the query alone.
        // If storage ever returned a foreign row, this refuses instead of leaking it.
        for (const row of rows) {
            if (row.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }
        }

        return Object.freeze(
            rows.map((row) =>
                this.toRecord({
                    ...row,
                    status: row.status as ReservationStatusValue,
                    tableLabel: row.table?.label ?? null,
                }),
            ),
        )
    }

    async get(workspaceId: string, reservationId: string): Promise<ReservationRecord> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.read")
        const id = reservationId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "reservationId is required")

        const row = await this.db.reservation.findUnique({
            where: { id },
            include: { table: { select: { label: true } } },
        })

        // A foreign reservation and a nonexistent one produce the same refusal.
        if (!row || row.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }

        return this.toRecord({
            ...row,
            status: row.status as ReservationStatusValue,
            tableLabel: row.table?.label ?? null,
        })
    }

    async create(
        workspaceId: string,
        input: CreateReservationInput,
        actor: ReservationActor,
    ): Promise<{ reservation: ReservationRecord; replayed: boolean }> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.update")

        const tableId = input.tableId?.trim()
        if (!tableId) throw new PersistenceError("BAD_REQUEST", "tableId is required")
        const guestName = input.guestName?.trim()
        if (!guestName) throw new PersistenceError("BAD_REQUEST", "guestName is required")
        if (!Number.isInteger(input.partySize) || input.partySize < 1) {
            throw new PersistenceError("BAD_REQUEST", "partySize must be a positive integer")
        }
        if (!(input.startAt instanceof Date) || Number.isNaN(input.startAt.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "startAt must be a valid timestamp")
        }
        if (!(input.endAt instanceof Date) || Number.isNaN(input.endAt.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "endAt must be a valid timestamp")
        }
        if (input.endAt.getTime() <= input.startAt.getTime()) {
            throw new PersistenceError("BAD_REQUEST", "endAt must be after startAt")
        }

        const idempotencyKey = input.idempotencyKey?.trim() || null

        // Idempotent replay: return the original row and write NO second event.
        if (idempotencyKey) {
            const existing = await this.db.reservation.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
                include: { table: { select: { label: true } } },
            })
            if (existing) {
                return {
                    reservation: this.toRecord({
                        ...existing,
                        status: existing.status as ReservationStatusValue,
                        tableLabel: existing.table?.label ?? null,
                    }),
                    replayed: true,
                }
            }
        }

        const status: ReservationStatusValue = input.hold ? "HELD" : "CONFIRMED"

        try {
            const created = await this.db.$transaction(async (tx) => {
                // Serialize all reservation writes for this table. Every concurrent
                // writer for the same table queues here, so the overlap test below
                // cannot be raced. This is the PRIMARY overlap mechanism; the
                // exclusion constraint is defense-in-depth beneath it.
                const locked = await tx.$queryRawUnsafe<
                    Array<{ id: string; profileId: string; seats: number | null; isActive: boolean; label: string }>
                >(
                    `select "id","profileId","seats","isActive","label"
                       from "RestaurantTable"
                      where "id" = $1
                      for update`,
                    tableId,
                )

                const table = locked[0]

                // Venue isolation: a table from another venue is refused exactly as
                // a nonexistent table is, so neither can be probed for.
                if (!table || table.profileId !== profileId) {
                    throw new PersistenceError("FORBIDDEN", "Access denied")
                }
                if (!table.isActive) {
                    throw new PersistenceError("CONFLICT", "This table is not accepting reservations")
                }

                // Capacity is fail-closed. RestaurantTable.seats is nullable, so an
                // unconfigured table cannot have its capacity validated, and we
                // refuse rather than silently skipping the check.
                if (table.seats === null) {
                    throw new PersistenceError(
                        "CONFLICT",
                        "This table has no seat count configured, so capacity cannot be verified",
                    )
                }
                if (input.partySize > table.seats) {
                    throw new PersistenceError(
                        "CONFLICT",
                        `Party of ${input.partySize} exceeds the ${table.seats} seats at this table`,
                    )
                }

                // Overlap test, under the row lock. Half-open comparison matches the
                // '[)' range bounds used by the exclusion constraint: a booking that
                // ends exactly when this one starts does not conflict.
                const clash = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(
                    `select count(*) as n
                       from "Reservation"
                      where "tableId" = $1
                        and "status" in (${OCCUPYING_LIST})
                        and "startAt" < $3
                        and "endAt" > $2`,
                    tableId,
                    input.startAt,
                    input.endAt,
                )
                if (Number(clash[0]?.n ?? 0) > 0) {
                    throw new PersistenceError(
                        "CONFLICT",
                        "That table is already booked for an overlapping time",
                    )
                }

                const row = await tx.reservation.create({
                    data: {
                        profileId,
                        tableId,
                        partySize: input.partySize,
                        startAt: input.startAt,
                        endAt: input.endAt,
                        status,
                        guestName,
                        guestPhone: input.guestPhone?.trim() || null,
                        guestEmail: input.guestEmail?.trim() || null,
                        note: input.note?.trim() || null,
                        idempotencyKey,
                        holdExpiresAt: input.hold ? new Date(Date.now() + 15 * 60_000) : null,
                        confirmedAt: status === "CONFIRMED" ? new Date() : null,
                    },
                })

                await tx.reservationEvent.create({
                    data: {
                        reservationId: row.id,
                        kind: "CREATED",
                        from: null,
                        to: status,
                        actor: actor.actorType,
                        actorId: actor.actorId,
                        metadata: { partySize: input.partySize, tableId },
                    },
                })

                return { ...row, tableLabel: table.label }
            })

            return {
                reservation: this.toRecord({
                    ...created,
                    status: created.status as ReservationStatusValue,
                }),
                replayed: false,
            }
        } catch (error) {
            if (error instanceof PersistenceError) throw error
            const code = pgCode(error)
            // The database refused an overlap the application check did not catch,
            // which can only happen if a writer bypassed this engine. Surface it as
            // the same conflict rather than a 500.
            if (code === EXCLUSION_VIOLATION) {
                throw new PersistenceError("CONFLICT", "That table is already booked for an overlapping time")
            }
            if (code === UNIQUE_VIOLATION) {
                throw new PersistenceError("CONFLICT", "A reservation with this idempotency key already exists")
            }
            throw error
        }
    }

    async transition(
        workspaceId: string,
        reservationId: string,
        to: ReservationStatusValue,
        actor: ReservationActor,
        reason?: string | null,
    ): Promise<ReservationRecord> {
        const { profileId } = await this.requireVenue(workspaceId, "profile.update")
        const id = reservationId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "reservationId is required")

        const updated = await this.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: ReservationStatusValue }>>(
                `select "id","profileId","status" from "Reservation" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]

            // Foreign and nonexistent are indistinguishable.
            if (!current || current.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }

            if (isTerminal(current.status)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `This reservation is already ${current.status.toLowerCase()} and cannot change`,
                )
            }
            if (!canTransition(current.status, to)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `Cannot move a ${current.status.toLowerCase()} reservation to ${to.toLowerCase()}`,
                )
            }

            const stamp = TRANSITION_TIMESTAMP_FIELD[to]
            const row = await tx.reservation.update({
                where: { id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason?.trim() || null } : {}),
                    ...(to === "CONFIRMED" ? { holdExpiresAt: null } : {}),
                },
                include: { table: { select: { label: true } } },
            })

            await tx.reservationEvent.create({
                data: {
                    reservationId: id,
                    kind: "STATUS",
                    from: current.status,
                    to,
                    actor: actor.actorType,
                    actorId: actor.actorId,
                    metadata: reason ? { reason } : undefined,
                },
            })

            return row
        })

        return this.toRecord({
            ...updated,
            status: updated.status as ReservationStatusValue,
            tableLabel: updated.table?.label ?? null,
        })
    }

    /** Append-only history for one reservation, tenant-checked first. */
    async history(workspaceId: string, reservationId: string) {
        await this.get(workspaceId, reservationId)
        const events = await this.db.reservationEvent.findMany({
            where: { reservationId: reservationId.trim() },
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
