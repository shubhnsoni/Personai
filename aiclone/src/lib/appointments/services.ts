import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

import type { PersistedAppointments, AppointmentActor } from "./engine"
import {
    canTransitionDeposit,
    canTransitionWaitlist,
    allowedDepositTransitionsFrom,
    type DepositState,
    type WaitlistStatus,
} from "./lifecycle"
import type { AppointmentProviders } from "./providers"

/**
 * Wave B / B3 runtime services: waitlist, deposits and reminders.
 *
 * All three share the tenancy bridge the engine already established and proved:
 * workspace membership resolves to Workspace.profileId, and every row touched must carry
 * the same profileId. Foreign and nonexistent produce IDENTICAL refusals.
 *
 * No external provider is contacted. Deposits and reminders go through injected adapters
 * whose default implementations perform no network I/O and report `unavailable`, so an
 * accepted operation produces only a queued internal record. A refusal must not reach an
 * adapter at all, which the harness asserts by invocation count.
 */

const UNIQUE_VIOLATION = "23505"

function pgCode(error: unknown): string | null {
    const anyErr = error as { code?: unknown; meta?: { code?: unknown; target?: unknown } } | null
    if (!anyErr) return null
    if (typeof anyErr.code === "string" && /^\d{5}$/.test(anyErr.code)) return anyErr.code
    if (typeof anyErr.meta?.code === "string" && /^\d{5}$/.test(anyErr.meta.code)) return anyErr.meta.code
    const message = error instanceof Error ? error.message : String(error)
    const match = /Code: `(\d{5})`/.exec(message)
    if (match) return match[1]
    if (/Unique constraint failed/i.test(message)) return UNIQUE_VIOLATION
    return null
}

export type WaitlistEntryRecord = Readonly<{
    id: string
    profileId: string
    serviceOfferingId: string
    resourceId: string | null
    requestedStart: Date
    requestedEnd: Date
    partySize: number
    guestName: string
    guestEmail: string | null
    status: WaitlistStatus
    offeredBookingId: string | null
    offerExpiresAt: Date | null
    createdAt: Date
}>

export type DepositRecord = Readonly<{
    id: string
    bookingId: string
    profileId: string
    amountCents: number
    currency: string
    state: DepositState
    providerRef: string | null
    failureCode: string | null
    allowedTransitions: readonly DepositState[]
    createdAt: Date
    updatedAt: Date
}>

export type ReminderRecord = Readonly<{
    id: string
    bookingId: string
    profileId: string
    channel: "EMAIL" | "SMS" | "WHATSAPP"
    sendAt: Date
    state: "SCHEDULED" | "SENT" | "FAILED" | "CANCELLED" | "SUPPRESSED"
    attempts: number
    lastError: string | null
    dispatchedAt: Date | null
}>

export class AppointmentServices {
    constructor(
        private readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
        private readonly appointments: PersistedAppointments,
        private readonly providers: AppointmentProviders,
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
        return workspace.profileId
    }

    // -----------------------------------------------------------------------
    // Waitlist
    // -----------------------------------------------------------------------

    async joinWaitlist(
        workspaceId: string,
        input: Readonly<{
            serviceOfferingId: string
            resourceId?: string | null
            requestedStart: Date
            requestedEnd: Date
            guestName: string
            guestEmail?: string | null
            guestPhone?: string | null
            partySize?: number
            idempotencyKey?: string | null
        }>,
        actor: AppointmentActor,
    ): Promise<{ entry: WaitlistEntryRecord; replayed: boolean }> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")

        const serviceOfferingId = input.serviceOfferingId?.trim()
        if (!serviceOfferingId) throw new PersistenceError("BAD_REQUEST", "serviceOfferingId is required")
        const guestName = input.guestName?.trim()
        if (!guestName) throw new PersistenceError("BAD_REQUEST", "guestName is required")
        if (!(input.requestedStart instanceof Date) || Number.isNaN(input.requestedStart.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "requestedStart must be a valid timestamp")
        }
        if (!(input.requestedEnd instanceof Date) || Number.isNaN(input.requestedEnd.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "requestedEnd must be a valid timestamp")
        }
        if (input.requestedEnd.getTime() <= input.requestedStart.getTime()) {
            throw new PersistenceError("BAD_REQUEST", "requestedEnd must be after requestedStart")
        }
        const partySize = input.partySize ?? 1
        if (!Number.isInteger(partySize) || partySize < 1) {
            throw new PersistenceError("BAD_REQUEST", "partySize must be a positive integer")
        }

        const idempotencyKey = input.idempotencyKey?.trim() || null
        if (idempotencyKey) {
            const existing = await this.db.appointmentWaitlistEntry.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
            })
            if (existing) return { entry: this.toWaitlist(existing), replayed: true }
        }

        // The service must belong to this tenant, and a named resource must too.
        const service = await this.db.serviceOffering.findUnique({
            where: { id: serviceOfferingId },
            select: { profileId: true },
        })
        if (!service || service.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        const resourceId = input.resourceId?.trim() || null
        if (resourceId) {
            const resource = await this.db.appointmentResource.findUnique({
                where: { id: resourceId },
                select: { profileId: true },
            })
            if (!resource || resource.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }
        }

        try {
            const row = await this.db.appointmentWaitlistEntry.create({
                data: {
                    profileId,
                    serviceOfferingId,
                    resourceId,
                    requestedStart: input.requestedStart,
                    requestedEnd: input.requestedEnd,
                    partySize,
                    guestName,
                    guestEmail: input.guestEmail?.trim() || null,
                    guestPhone: input.guestPhone?.trim() || null,
                    idempotencyKey,
                    status: "WAITING",
                },
            })
            void actor
            return { entry: this.toWaitlist(row), replayed: false }
        } catch (error) {
            if (pgCode(error) === UNIQUE_VIOLATION) {
                throw new PersistenceError("CONFLICT", "A waitlist entry with this idempotency key already exists")
            }
            throw error
        }
    }

    /** Waiting entries in FIFO order, which is what makes promotion fair and testable. */
    async listWaitlist(workspaceId: string, serviceOfferingId?: string): Promise<readonly WaitlistEntryRecord[]> {
        const profileId = await this.requireVenue(workspaceId, "profile.read")
        const rows = await this.db.appointmentWaitlistEntry.findMany({
            where: {
                profileId,
                ...(serviceOfferingId?.trim() ? { serviceOfferingId: serviceOfferingId.trim() } : {}),
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        for (const row of rows) {
            if (row.profileId !== profileId) throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        return Object.freeze(rows.map((r) => this.toWaitlist(r)))
    }

    async transitionWaitlist(
        workspaceId: string,
        entryId: string,
        to: WaitlistStatus,
    ): Promise<WaitlistEntryRecord> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const id = entryId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "entryId is required")

        return this.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: WaitlistStatus }>>(
                `select "id","profileId","status" from "AppointmentWaitlistEntry" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }
            if (!canTransitionWaitlist(current.status, to)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `Cannot move a ${current.status.toLowerCase()} waitlist entry to ${to.toLowerCase()}`,
                )
            }
            const row = await tx.appointmentWaitlistEntry.update({ where: { id }, data: { status: to } })
            return this.toWaitlist(row)
        })
    }

    /**
     * Promotes the OLDEST waiting entry into a real booking.
     *
     * The whole promotion runs inside one transaction and takes a row lock on the entry,
     * so two concurrent promotions cannot both convert the same entry. The booking itself
     * goes through the engine, which means it inherits capacity, availability and overlap
     * refusal rather than bypassing them.
     */
    async promoteWaitlistEntry(
        workspaceId: string,
        entryId: string,
        actor: AppointmentActor,
    ): Promise<{ entry: WaitlistEntryRecord; bookingId: string }> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const id = entryId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "entryId is required")

        // Claim the entry first, so a second promoter cannot also claim it.
        const claimed = await this.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<
                Array<{
                    id: string
                    profileId: string
                    status: WaitlistStatus
                    serviceOfferingId: string
                    resourceId: string | null
                    requestedStart: Date
                    requestedEnd: Date
                    partySize: number
                    guestName: string
                    guestEmail: string | null
                }>
            >(
                `select "id","profileId","status","serviceOfferingId","resourceId","requestedStart","requestedEnd","partySize","guestName","guestEmail"
                   from "AppointmentWaitlistEntry" where "id" = $1 for update`,
                id,
            )
            const entry = rows[0]
            if (!entry || entry.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }
            if (entry.status !== "WAITING") {
                throw new PersistenceError(
                    "CONFLICT",
                    `Only a waiting entry can be promoted; this one is ${entry.status.toLowerCase()}`,
                )
            }
            if (!entry.resourceId) {
                throw new PersistenceError(
                    "CONFLICT",
                    "This waitlist entry has no resource, so it cannot be promoted automatically",
                )
            }
            await tx.appointmentWaitlistEntry.update({
                where: { id },
                data: { status: "OFFERED", offerExpiresAt: new Date(Date.now() + 30 * 60_000) },
            })
            return entry
        })

        // Book through the engine so every guard applies. If it refuses, put the entry
        // back to WAITING so the customer does not silently lose their place.
        let bookingId: string
        try {
            const booked = await this.appointments.book(
                workspaceId,
                {
                    serviceOfferingId: claimed.serviceOfferingId,
                    resourceId: claimed.resourceId as string,
                    startTime: claimed.requestedStart,
                    endTime: claimed.requestedEnd,
                    visitorName: claimed.guestName,
                    visitorEmail: claimed.guestEmail ?? `waitlist+${claimed.id}@example.invalid`,
                    partySize: claimed.partySize,
                    idempotencyKey: `waitlist-${claimed.id}`,
                },
                actor,
            )
            bookingId = booked.appointment.id
        } catch (error) {
            await this.db.appointmentWaitlistEntry.update({
                where: { id },
                data: { status: "WAITING", offerExpiresAt: null },
            })
            throw error
        }

        const finalEntry = await this.db.appointmentWaitlistEntry.update({
            where: { id },
            data: { status: "CONVERTED", offeredBookingId: bookingId },
        })
        await this.db.appointmentEvent.create({
            data: {
                bookingId,
                kind: "WAITLIST",
                from: "OFFERED",
                to: "CONVERTED",
                actor: actor.actorType,
                actorId: actor.actorId,
                metadata: { waitlistEntryId: id },
            },
        })

        return { entry: this.toWaitlist(finalEntry), bookingId }
    }

    // -----------------------------------------------------------------------
    // Deposits
    // -----------------------------------------------------------------------

    /**
     * Records a deposit REQUIREMENT. It never contacts a provider: the row is created in
     * state REQUIRED and stays there until an explicitly injected provider authorizes it.
     */
    async requireDeposit(
        workspaceId: string,
        input: Readonly<{ bookingId: string; amountCents: number; currency?: string; idempotencyKey?: string | null }>,
        actor: AppointmentActor,
    ): Promise<{ deposit: DepositRecord; replayed: boolean }> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const bookingId = input.bookingId?.trim()
        if (!bookingId) throw new PersistenceError("BAD_REQUEST", "bookingId is required")
        if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
            throw new PersistenceError("BAD_REQUEST", "amountCents must be a positive integer")
        }

        // Tenant check before anything else; foreign and missing are identical.
        const booking = await this.db.booking.findUnique({
            where: { id: bookingId },
            select: { id: true, profileId: true },
        })
        if (!booking || booking.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }

        const existing = await this.db.appointmentDeposit.findUnique({ where: { bookingId } })
        if (existing) return { deposit: this.toDeposit(existing), replayed: true }

        const row = await this.db.appointmentDeposit.create({
            data: {
                bookingId,
                profileId,
                amountCents: input.amountCents,
                currency: input.currency?.trim() || "USD",
                state: "REQUIRED",
                idempotencyKey: input.idempotencyKey?.trim() || null,
            },
        })
        await this.db.appointmentEvent.create({
            data: {
                bookingId,
                kind: "DEPOSIT",
                from: "NONE",
                to: "REQUIRED",
                actor: actor.actorType,
                actorId: actor.actorId,
                metadata: { amountCents: input.amountCents },
            },
        })
        return { deposit: this.toDeposit(row), replayed: false }
    }

    /**
     * Attempts to authorize through the injected payment provider.
     *
     * With the default unconfigured provider this is a no-op that leaves the deposit in
     * REQUIRED and reports the provider as unavailable. It never invents an authorization.
     */
    async authorizeDeposit(workspaceId: string, bookingId: string, actor: AppointmentActor): Promise<DepositRecord> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const id = bookingId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "bookingId is required")

        const deposit = await this.db.appointmentDeposit.findUnique({ where: { bookingId: id } })
        if (!deposit || deposit.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        const from = deposit.state as DepositState
        if (!canTransitionDeposit(from, "AUTHORIZED")) {
            throw new PersistenceError(
                "CONFLICT",
                `A ${from.toLowerCase()} deposit cannot be authorized`,
            )
        }

        const result = await this.providers.payments.authorizeDeposit({
            bookingId: id,
            profileId,
            amountCents: deposit.amountCents,
            currency: deposit.currency,
            idempotencyKey: deposit.idempotencyKey,
        })

        if (result.outcome === "unavailable") {
            // Deliberately does NOT change state. Claiming AUTHORIZED here would record a
            // payment that never happened.
            throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Deposit collection is not available", {
                failureCode: result.failureCode ?? "PROVIDER_NOT_CONFIGURED",
            })
        }

        const to: DepositState = result.outcome === "authorized" ? "AUTHORIZED" : "FAILED"
        const row = await this.db.appointmentDeposit.update({
            where: { bookingId: id },
            data: { state: to, providerRef: result.providerRef, failureCode: result.failureCode },
        })
        await this.db.appointmentEvent.create({
            data: {
                bookingId: id,
                kind: "DEPOSIT",
                from,
                to,
                actor: actor.actorType,
                actorId: actor.actorId,
            },
        })
        return this.toDeposit(row)
    }

    /** Guarded manual deposit transition, used for refunds and forfeits. */
    async transitionDeposit(
        workspaceId: string,
        bookingId: string,
        to: DepositState,
        actor: AppointmentActor,
    ): Promise<DepositRecord> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const id = bookingId.trim()
        if (!id) throw new PersistenceError("BAD_REQUEST", "bookingId is required")

        return this.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; state: DepositState }>>(
                `select "id","profileId","state" from "AppointmentDeposit" where "bookingId" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.profileId !== profileId) {
                throw new PersistenceError("FORBIDDEN", "Access denied")
            }
            if (!canTransitionDeposit(current.state, to)) {
                throw new PersistenceError(
                    "CONFLICT",
                    `Cannot move a ${current.state.toLowerCase()} deposit to ${to.toLowerCase()}`,
                )
            }
            const row = await tx.appointmentDeposit.update({ where: { bookingId: id }, data: { state: to } })
            await tx.appointmentEvent.create({
                data: {
                    bookingId: id,
                    kind: "DEPOSIT",
                    from: current.state,
                    to,
                    actor: actor.actorType,
                    actorId: actor.actorId,
                },
            })
            return this.toDeposit(row)
        })
    }

    // -----------------------------------------------------------------------
    // Reminders
    // -----------------------------------------------------------------------

    /**
     * Schedules a reminder. Idempotent by construction: the unique key on
     * (bookingId, channel, sendAt) means a replay returns the existing row instead of
     * queueing a duplicate message.
     */
    async scheduleReminder(
        workspaceId: string,
        input: Readonly<{ bookingId: string; channel: "EMAIL" | "SMS" | "WHATSAPP"; sendAt: Date }>,
        actor: AppointmentActor,
    ): Promise<{ reminder: ReminderRecord; replayed: boolean }> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")
        const bookingId = input.bookingId?.trim()
        if (!bookingId) throw new PersistenceError("BAD_REQUEST", "bookingId is required")
        if (!(input.sendAt instanceof Date) || Number.isNaN(input.sendAt.getTime())) {
            throw new PersistenceError("BAD_REQUEST", "sendAt must be a valid timestamp")
        }

        const booking = await this.db.booking.findUnique({
            where: { id: bookingId },
            select: { profileId: true },
        })
        if (!booking || booking.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }

        const existing = await this.db.appointmentReminder.findUnique({
            where: { bookingId_channel_sendAt: { bookingId, channel: input.channel, sendAt: input.sendAt } },
        })
        if (existing) return { reminder: this.toReminder(existing), replayed: true }

        try {
            const row = await this.db.appointmentReminder.create({
                data: { bookingId, profileId, channel: input.channel, sendAt: input.sendAt, state: "SCHEDULED" },
            })
            await this.db.appointmentEvent.create({
                data: {
                    bookingId,
                    kind: "REMINDER",
                    from: null,
                    to: "SCHEDULED",
                    actor: actor.actorType,
                    actorId: actor.actorId,
                    metadata: { channel: input.channel },
                },
            })
            return { reminder: this.toReminder(row), replayed: false }
        } catch (error) {
            if (pgCode(error) === UNIQUE_VIOLATION) {
                const row = await this.db.appointmentReminder.findUnique({
                    where: { bookingId_channel_sendAt: { bookingId, channel: input.channel, sendAt: input.sendAt } },
                })
                if (row) return { reminder: this.toReminder(row), replayed: true }
            }
            throw error
        }
    }

    async listReminders(workspaceId: string, bookingId: string): Promise<readonly ReminderRecord[]> {
        const profileId = await this.requireVenue(workspaceId, "profile.read")
        const id = bookingId.trim()
        const booking = await this.db.booking.findUnique({ where: { id }, select: { profileId: true } })
        if (!booking || booking.profileId !== profileId) {
            throw new PersistenceError("FORBIDDEN", "Access denied")
        }
        const rows = await this.db.appointmentReminder.findMany({
            where: { bookingId: id },
            orderBy: [{ sendAt: "asc" }, { id: "asc" }],
        })
        return Object.freeze(rows.map((r) => this.toReminder(r)))
    }

    /**
     * Attempts dispatch for reminders that are due.
     *
     * With the default unconfigured provider nothing is sent and every due reminder is
     * left SCHEDULED, because marking it SENT would be a lie. Reminders attached to a
     * terminal appointment are SUPPRESSED instead, which is the one state change this can
     * make without a provider.
     */
    async dispatchDueReminders(
        workspaceId: string,
        now: Date,
        actor: AppointmentActor,
    ): Promise<{ examined: number; suppressed: number; sent: number; failed: number; left: number }> {
        const profileId = await this.requireVenue(workspaceId, "profile.update")

        const due = await this.db.appointmentReminder.findMany({
            where: { profileId, state: "SCHEDULED", sendAt: { lte: now } },
            include: { booking: { select: { status: true } } },
            orderBy: [{ sendAt: "asc" }, { id: "asc" }],
        })

        let suppressed = 0
        let sent = 0
        let failed = 0

        for (const reminder of due) {
            const bookingStatus = reminder.booking?.status ?? ""
            if (["CANCELLED", "NO_SHOW", "COMPLETED", "EXPIRED"].includes(bookingStatus)) {
                await this.db.appointmentReminder.update({
                    where: { id: reminder.id },
                    data: { state: "SUPPRESSED" },
                })
                await this.db.appointmentEvent.create({
                    data: {
                        bookingId: reminder.bookingId,
                        kind: "REMINDER",
                        from: "SCHEDULED",
                        to: "SUPPRESSED",
                        actor: actor.actorType,
                        actorId: actor.actorId,
                        metadata: { reason: `appointment is ${bookingStatus}` },
                    },
                })
                suppressed += 1
                continue
            }

            const result = await this.providers.notifications.dispatch({
                reminderId: reminder.id,
                bookingId: reminder.bookingId,
                profileId,
                channel: reminder.channel,
                sendAt: reminder.sendAt,
            })

            if (result.outcome === "unavailable") {
                // Left SCHEDULED on purpose. No delivery happened, so none is recorded.
                continue
            }
            const to = result.outcome === "sent" ? "SENT" : "FAILED"
            await this.db.appointmentReminder.update({
                where: { id: reminder.id },
                data: {
                    state: to,
                    attempts: { increment: 1 },
                    lastError: result.failureCode,
                    dispatchedAt: result.outcome === "sent" ? new Date() : null,
                },
            })
            await this.db.appointmentEvent.create({
                data: {
                    bookingId: reminder.bookingId,
                    kind: "REMINDER",
                    from: "SCHEDULED",
                    to,
                    actor: actor.actorType,
                    actorId: actor.actorId,
                },
            })
            if (to === "SENT") sent += 1
            else failed += 1
        }

        return {
            examined: due.length,
            suppressed,
            sent,
            failed,
            left: due.length - suppressed - sent - failed,
        }
    }

    // -----------------------------------------------------------------------

    private toWaitlist(row: {
        id: string
        profileId: string
        serviceOfferingId: string
        resourceId: string | null
        requestedStart: Date
        requestedEnd: Date
        partySize: number
        guestName: string
        guestEmail: string | null
        status: string
        offeredBookingId: string | null
        offerExpiresAt: Date | null
        createdAt: Date
    }): WaitlistEntryRecord {
        return Object.freeze({
            id: row.id,
            profileId: row.profileId,
            serviceOfferingId: row.serviceOfferingId,
            resourceId: row.resourceId,
            requestedStart: row.requestedStart,
            requestedEnd: row.requestedEnd,
            partySize: row.partySize,
            guestName: row.guestName,
            guestEmail: row.guestEmail,
            status: row.status as WaitlistStatus,
            offeredBookingId: row.offeredBookingId,
            offerExpiresAt: row.offerExpiresAt,
            createdAt: row.createdAt,
        })
    }

    private toDeposit(row: {
        id: string
        bookingId: string
        profileId: string
        amountCents: number
        currency: string
        state: string
        providerRef: string | null
        failureCode: string | null
        createdAt: Date
        updatedAt: Date
    }): DepositRecord {
        const state = row.state as DepositState
        return Object.freeze({
            id: row.id,
            bookingId: row.bookingId,
            profileId: row.profileId,
            amountCents: row.amountCents,
            currency: row.currency,
            state,
            providerRef: row.providerRef,
            failureCode: row.failureCode,
            allowedTransitions: allowedDepositTransitionsFrom(state),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    private toReminder(row: {
        id: string
        bookingId: string
        profileId: string
        channel: string
        sendAt: Date
        state: string
        attempts: number
        lastError: string | null
        dispatchedAt: Date | null
    }): ReminderRecord {
        return Object.freeze({
            id: row.id,
            bookingId: row.bookingId,
            profileId: row.profileId,
            channel: row.channel as "EMAIL" | "SMS" | "WHATSAPP",
            sendAt: row.sendAt,
            state: row.state as ReminderRecord["state"],
            attempts: row.attempts,
            lastError: row.lastError,
            dispatchedAt: row.dispatchedAt,
        })
    }
}
