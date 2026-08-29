/**
 * fieldJobs runtime: intake and dispatch (Wave G4).
 *
 * Composes the existing systems rather than restating them. A technician is an
 * AppointmentResource, the work being sold is a ServiceOffering, the depot is a Location, and
 * tenancy is the profileId bridge PersistedTenancy already resolves.
 *
 * WHAT THIS DOES NOT DO, stated here because the word "dispatch" implies more than it delivers:
 * no route is optimised, no distance or travel time is computed, no map provider is called, and no
 * technician is notified by email, SMS or push. `dispatch` here is assignment plus job-card state.
 * There is no fetch, no provider client and no queue write anywhere in this file.
 *
 * INSPECTION IS NOT BUILT. Asset checks, parts and completion notes are absent on purpose, and
 * fieldJobs:inspection stays declared planned.
 *
 * The interesting design work is in the SIDE CONDITIONS on job transitions. A status table alone
 * would let an owner dispatch a job with nobody assigned, or complete one while a technician is
 * still on site. Each condition is named in lifecycle.ts as an exported list rather than buried in
 * an `if`, so the rule is readable without reading the method.
 */
import type { PrismaClient } from "@prisma/client"

import {
    ACTIVE_ASSIGNMENT_STATES,
    ALL_DONE_REQUIRED_JOB_STATUSES,
    ASSIGNMENT_TIMESTAMP_FIELD,
    CONVERTIBLE_REQUEST_STATUSES,
    JOB_TIMESTAMP_FIELD,
    LEAD_REQUIRED_JOB_STATUSES,
    ON_SITE_ASSIGNMENT_STATES,
    ON_SITE_REQUIRED_JOB_STATUSES,
    QUOTABLE_REQUEST_STATUSES,
    REASON_REQUIRED_ASSIGNMENT_STATES,
    SCHEDULE_REQUIRED_JOB_STATUSES,
    assignmentFlow,
    jobFlow,
    requestFlow,
    type AssignmentRoleValue,
    type AssignmentStateValue,
    type JobPriorityValue,
    type JobStatusValue,
    type RequestStatusValue,
} from "./lifecycle"
import type { FieldJobActor, FieldJobContext } from "./shared"

type RawRequest = {
    id: string
    profileId: string
    serviceOfferingId: string | null
    source: string
    summary: string
    requesterName: string | null
    requesterEmail: string | null
    requesterPhone: string | null
    siteAddress: string | null
    status: RequestStatusValue
    estimateCents: number | null
    currency: string
    declineReason: string | null
    createdAt: Date
    updatedAt: Date
}

export type RequestRecord = Readonly<RawRequest & { allowedTransitions: readonly RequestStatusValue[] }>

export function toRequestRecord(row: RawRequest): RequestRecord {
    return Object.freeze({ ...row, allowedTransitions: requestFlow.allowedFrom(row.status) })
}

type RawJob = {
    id: string
    profileId: string
    requestId: string | null
    serviceOfferingId: string | null
    originLocationId: string | null
    reference: string
    title: string
    status: JobStatusValue
    priority: JobPriorityValue
    siteAddress: string
    siteNotes: string | null
    contactName: string | null
    contactPhone: string | null
    scheduledStartAt: Date | null
    scheduledEndAt: Date | null
    estimateCents: number | null
    currency: string
    dispatchedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    createdAt: Date
    updatedAt: Date
}

export type JobRecord = Readonly<
    RawJob & {
        allowedTransitions: readonly JobStatusValue[]
        /** Derived on read: a job is schedulable-complete when both timestamps are present. */
        isScheduled: boolean
    }
>

export function toJobRecord(row: RawJob): JobRecord {
    return Object.freeze({
        ...row,
        allowedTransitions: jobFlow.allowedFrom(row.status),
        isScheduled: row.scheduledStartAt !== null && row.scheduledEndAt !== null,
    })
}

type RawAssignment = {
    id: string
    jobId: string
    resourceId: string
    role: AssignmentRoleValue
    state: AssignmentStateValue
    assignedAt: Date
    respondedAt: Date | null
    enRouteAt: Date | null
    onSiteAt: Date | null
    completedAt: Date | null
    releasedAt: Date | null
    declineReason: string | null
    releaseReason: string | null
    createdAt: Date
    updatedAt: Date
}

export type AssignmentRecord = Readonly<
    RawAssignment & {
        allowedTransitions: readonly AssignmentStateValue[]
        resourceName: string
        isActive: boolean
    }
>

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

export class FieldJobIntakeService {
    constructor(private readonly ctx: FieldJobContext) {}

    /**
     * Records an inbound request. Idempotent on (profileId, idempotencyKey), checked before any
     * work and backed by a unique index so a lost race becomes a conflict rather than two
     * requests for the same call.
     */
    async create(
        workspaceId: string,
        input: Readonly<{
            source: string
            summary: string
            serviceOfferingId?: string | null
            requesterName?: string | null
            requesterEmail?: string | null
            requesterPhone?: string | null
            siteAddress?: string | null
            idempotencyKey?: string | null
        }>,
    ): Promise<{ request: RequestRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const source = this.ctx.required(input.source, "source")
        const summary = this.ctx.required(input.summary, "summary")
        const key = input.idempotencyKey?.trim() || null
        const offeringId = await this.ctx.assertOffering(profileId, input.serviceOfferingId ?? null)

        if (key) {
            const existing = await this.ctx.db.fieldJobRequest.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey: key } },
            })
            if (existing) return { request: toRequestRecord(existing as RawRequest), replayed: true }
        }

        try {
            const row = await this.ctx.db.fieldJobRequest.create({
                data: {
                    profileId,
                    source,
                    summary,
                    serviceOfferingId: offeringId,
                    requesterName: input.requesterName?.trim() || null,
                    requesterEmail: input.requesterEmail?.trim() || null,
                    requesterPhone: input.requesterPhone?.trim() || null,
                    siteAddress: input.siteAddress?.trim() || null,
                    ...(key ? { idempotencyKey: key } : {}),
                },
            })
            return { request: toRequestRecord(row as RawRequest), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "A request with that idempotency key already exists")
        }
    }

    async list(workspaceId: string): Promise<readonly RequestRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const rows = await this.ctx.db.fieldJobRequest.findMany({
            where: { profileId },
            orderBy: { createdAt: "desc" },
        })
        for (const row of rows) if (row.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toRequestRecord(r as RawRequest)))
    }

    async transition(
        workspaceId: string,
        requestId: string,
        to: RequestStatusValue,
        reason?: string | null,
    ): Promise<RequestRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(requestId, "requestId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockRequest(tx, id, profileId)
            if (requestFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This request is already ${current.status.toLowerCase()} and cannot change`)
            }
            if (!requestFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} request to ${to.toLowerCase()}`)
            }
            if (to === "DECLINED" && !reason?.trim()) {
                this.ctx.conflict("Declining a request needs a reason, so the record explains itself later")
            }
            // CONVERTED is set by convert(), which also creates the job. Allowing it here would
            // produce a converted request with nothing to show for it.
            if (to === "CONVERTED") {
                this.ctx.conflict("A request becomes converted by creating its job, not by a status change")
            }
            return tx.fieldJobRequest.update({
                where: { id },
                data: { status: to, ...(to === "DECLINED" ? { declineReason: reason!.trim() } : {}) },
            })
        })
        return toRequestRecord(row as RawRequest)
    }

    /** Attaches a quote. Only while the request is still being worked out. */
    async quote(
        workspaceId: string,
        requestId: string,
        input: Readonly<{ estimateCents: number; currency?: string | null }>,
    ): Promise<RequestRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(requestId, "requestId")
        if (!Number.isInteger(input.estimateCents) || input.estimateCents < 0) {
            this.ctx.conflict("estimateCents must be a non-negative whole number of cents")
        }

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockRequest(tx, id, profileId)
            if (!QUOTABLE_REQUEST_STATUSES.includes(current.status)) {
                this.ctx.conflict(`A ${current.status.toLowerCase()} request cannot be quoted`)
            }
            return tx.fieldJobRequest.update({
                where: { id },
                data: {
                    estimateCents: input.estimateCents,
                    currency: input.currency?.trim() || undefined,
                    status: "QUOTED",
                },
            })
        })
        return toRequestRecord(row as RawRequest)
    }

    /**
     * Turns an ACCEPTED request into a job, taking a row lock on the request first so two
     * concurrent conversions cannot both produce one. The request becomes CONVERTED in the same
     * transaction, so there is never a job whose request still looks open.
     */
    async convert(
        workspaceId: string,
        requestId: string,
        input: Readonly<{
            reference: string
            title: string
            siteAddress?: string | null
            priority?: JobPriorityValue | null
            originLocationId?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<JobRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(requestId, "requestId")
        const reference = this.ctx.required(input.reference, "reference")
        const title = this.ctx.required(input.title, "title")
        const originLocationId = await this.ctx.assertLocation(profileId, input.originLocationId ?? null)

        try {
            const row = await this.ctx.db.$transaction(async (tx) => {
                const current = await this.lockRequest(tx, id, profileId)
                if (!CONVERTIBLE_REQUEST_STATUSES.includes(current.status)) {
                    this.ctx.conflict(`Only an accepted request can be converted; this one is ${current.status.toLowerCase()}`)
                }
                const full = await tx.fieldJobRequest.findUniqueOrThrow({ where: { id } })
                // The site has to come from somewhere. The request usually carries it; if it does
                // not, the caller must supply one, because a job with no address cannot be visited.
                const siteAddress = input.siteAddress?.trim() || full.siteAddress?.trim() || null
                if (!siteAddress) {
                    this.ctx.conflict("This request has no site address, so one must be supplied to convert it")
                }
                const job = await tx.fieldJob.create({
                    data: {
                        profileId,
                        requestId: id,
                        serviceOfferingId: full.serviceOfferingId,
                        originLocationId,
                        reference,
                        title,
                        priority: input.priority ?? "NORMAL",
                        siteAddress,
                        contactName: full.requesterName,
                        contactPhone: full.requesterPhone,
                        estimateCents: full.estimateCents,
                        currency: full.currency,
                    },
                })
                await tx.fieldJobRequest.update({ where: { id }, data: { status: "CONVERTED" } })
                await this.ctx.appendEvent(tx, job.id, "CREATED", "job", job.id, null, "DRAFT", actor, {
                    convertedFromRequest: id,
                })
                return job
            })
            return toJobRecord(row as RawJob)
        } catch (error) {
            this.ctx.rethrowUnique(error, "A job with that reference already exists, or this request already has one")
        }
    }

    private async lockRequest(tx: Tx, requestId: string, profileId: string) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: RequestStatusValue }>>(
            `select "id","profileId","status" from "FieldJobRequest" where "id" = $1 for update`,
            requestId,
        )
        const current = rows[0]
        if (!current || current.profileId !== profileId) this.ctx.denied()
        return current
    }
}

export class FieldJobService {
    constructor(private readonly ctx: FieldJobContext) {}

    async create(
        workspaceId: string,
        input: Readonly<{
            reference: string
            title: string
            siteAddress: string
            siteNotes?: string | null
            contactName?: string | null
            contactPhone?: string | null
            priority?: JobPriorityValue | null
            serviceOfferingId?: string | null
            originLocationId?: string | null
            estimateCents?: number | null
            idempotencyKey?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<{ job: JobRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const reference = this.ctx.required(input.reference, "reference")
        const title = this.ctx.required(input.title, "title")
        const siteAddress = this.ctx.required(input.siteAddress, "siteAddress")
        const key = input.idempotencyKey?.trim() || null
        const offeringId = await this.ctx.assertOffering(profileId, input.serviceOfferingId ?? null)
        const originLocationId = await this.ctx.assertLocation(profileId, input.originLocationId ?? null)
        if (input.estimateCents != null && (!Number.isInteger(input.estimateCents) || input.estimateCents < 0)) {
            this.ctx.conflict("estimateCents must be a non-negative whole number of cents")
        }

        if (key) {
            const existing = await this.ctx.db.fieldJob.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey: key } },
            })
            if (existing) return { job: toJobRecord(existing as RawJob), replayed: true }
        }

        try {
            const row = await this.ctx.db.$transaction(async (tx) => {
                const job = await tx.fieldJob.create({
                    data: {
                        profileId,
                        reference,
                        title,
                        siteAddress,
                        siteNotes: input.siteNotes?.trim() || null,
                        contactName: input.contactName?.trim() || null,
                        contactPhone: input.contactPhone?.trim() || null,
                        priority: input.priority ?? "NORMAL",
                        serviceOfferingId: offeringId,
                        originLocationId,
                        estimateCents: input.estimateCents ?? null,
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                })
                await this.ctx.appendEvent(tx, job.id, "CREATED", "job", job.id, null, "DRAFT", actor)
                return job
            })
            return { job: toJobRecord(row as RawJob), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "A job with that reference or idempotency key already exists")
        }
    }

    async list(workspaceId: string, status?: JobStatusValue | null): Promise<readonly JobRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const rows = await this.ctx.db.fieldJob.findMany({
            where: { profileId, ...(status ? { status } : {}) },
            orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }],
        })
        for (const row of rows) if (row.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toJobRecord(r as RawJob)))
    }

    async get(workspaceId: string, jobId: string): Promise<JobRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const row = await this.ctx.ownedJob(profileId, jobId)
        return toJobRecord(row as RawJob)
    }

    /**
     * Sets or clears the visit window. Both timestamps or neither - the database agrees, but a
     * named conflict is more use to a caller than a constraint violation. Clearing is refused once
     * the job has been dispatched, because a technician has already been told when to turn up.
     */
    async schedule(
        workspaceId: string,
        jobId: string,
        input: Readonly<{ startAt: Date | null; endAt: Date | null }>,
        actor: FieldJobActor,
    ): Promise<JobRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(jobId, "jobId")
        const both = input.startAt !== null && input.endAt !== null
        const neither = input.startAt === null && input.endAt === null
        if (!both && !neither) {
            this.ctx.conflict("A visit window needs both a start and an end, or neither")
        }
        if (both && input.endAt!.getTime() <= input.startAt!.getTime()) {
            this.ctx.conflict("A visit window must end after it starts")
        }

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockJob(tx, id, profileId)
            if (jobFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This job is already ${current.status.toLowerCase()} and cannot be rescheduled`)
            }
            if (neither && SCHEDULE_REQUIRED_JOB_STATUSES.includes(current.status)) {
                this.ctx.conflict(`A ${current.status.toLowerCase()} job cannot have its visit window removed`)
            }
            const updated = await tx.fieldJob.update({
                where: { id },
                data: { scheduledStartAt: input.startAt, scheduledEndAt: input.endAt },
            })
            await this.ctx.appendEvent(
                tx,
                id,
                "SCHEDULE",
                "job",
                id,
                null,
                both ? input.startAt!.toISOString() : "CLEARED",
                actor,
                both ? { endAt: input.endAt!.toISOString() } : undefined,
            )
            return updated
        })
        return toJobRecord(row as RawJob)
    }

    /**
     * Moves the job. The side conditions are the point: a status table alone would let an owner
     * dispatch a job with nobody assigned, start one before anybody arrived, or complete one while
     * a technician is still on site.
     */
    async transition(
        workspaceId: string,
        jobId: string,
        to: JobStatusValue,
        actor: FieldJobActor,
        reason?: string | null,
    ): Promise<JobRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(jobId, "jobId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockJob(tx, id, profileId)
            if (jobFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This job is already ${current.status.toLowerCase()} and cannot change`)
            }
            if (!jobFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} job to ${to.toLowerCase()}`)
            }
            if (to === "CANCELLED" && !reason?.trim()) {
                this.ctx.conflict("Cancelling a job needs a reason")
            }

            const full = await tx.fieldJob.findUniqueOrThrow({ where: { id } })
            if (SCHEDULE_REQUIRED_JOB_STATUSES.includes(to) && (full.scheduledStartAt === null || full.scheduledEndAt === null)) {
                this.ctx.conflict(`A job cannot be ${to.toLowerCase()} without a visit window`)
            }
            if (LEAD_REQUIRED_JOB_STATUSES.includes(to)) {
                const lead = await tx.fieldJobAssignment.count({
                    where: { jobId: id, role: "LEAD", state: { in: [...ACTIVE_ASSIGNMENT_STATES] } },
                })
                if (lead === 0) {
                    this.ctx.conflict("A job cannot be dispatched without an accountable lead technician")
                }
            }
            if (ON_SITE_REQUIRED_JOB_STATUSES.includes(to)) {
                const onSite = await tx.fieldJobAssignment.count({
                    where: { jobId: id, state: { in: [...ON_SITE_ASSIGNMENT_STATES] } },
                })
                if (onSite === 0) {
                    this.ctx.conflict("Work cannot start until a technician is on site")
                }
            }
            if (ALL_DONE_REQUIRED_JOB_STATUSES.includes(to)) {
                const outstanding = await tx.fieldJobAssignment.count({
                    where: { jobId: id, state: { in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ON_SITE"] } },
                })
                if (outstanding > 0) {
                    this.ctx.conflict(
                        `${outstanding} technician${outstanding === 1 ? " is" : "s are"} still mid-visit, so the job is not complete`,
                    )
                }
            }

            const stamp = JOB_TIMESTAMP_FIELD[to]
            const updated = await tx.fieldJob.update({
                where: { id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason!.trim() } : {}),
                },
            })
            await this.ctx.appendEvent(tx, id, "STATUS", "job", id, current.status, to, actor, reason ? { reason } : undefined)
            return updated
        })
        return toJobRecord(row as RawJob)
    }

    /**
     * Assigns a technician. Idempotent on (jobId, idempotencyKey). The one-active-lead and
     * one-active-assignment-per-technician rules are enforced here with a named conflict AND by
     * partial unique indexes, because the engine is not the only possible writer.
     */
    async assign(
        workspaceId: string,
        jobId: string,
        input: Readonly<{ resourceId: string; role?: AssignmentRoleValue | null; idempotencyKey?: string | null }>,
        actor: FieldJobActor,
    ): Promise<{ assignment: AssignmentRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(jobId, "jobId")
        const key = input.idempotencyKey?.trim() || null
        const role: AssignmentRoleValue = input.role ?? "HELPER"
        const resource = await this.ctx.ownedResource(profileId, input.resourceId)
        if (!resource.isActive) {
            this.ctx.conflict("That technician is not active, so they cannot be assigned")
        }

        try {
            const out = await this.ctx.db.$transaction(async (tx) => {
                const current = await this.lockJob(tx, id, profileId)
                if (jobFlow.isTerminal(current.status)) {
                    this.ctx.conflict(`This job is already ${current.status.toLowerCase()}, so nobody can be assigned to it`)
                }
                if (key) {
                    const replay = await tx.fieldJobAssignment.findUnique({
                        where: { jobId_idempotencyKey: { jobId: id, idempotencyKey: key } },
                        include: { resource: { select: { name: true } } },
                    })
                    if (replay) return { row: replay, replayed: true }
                }
                const alreadyOn = await tx.fieldJobAssignment.findFirst({
                    where: { jobId: id, resourceId: resource.id, state: { in: [...ACTIVE_ASSIGNMENT_STATES] } },
                    select: { id: true, state: true },
                })
                if (alreadyOn) {
                    this.ctx.conflict(`That technician is already ${alreadyOn.state.toLowerCase()} on this job`)
                }
                if (role === "LEAD") {
                    const lead = await tx.fieldJobAssignment.findFirst({
                        where: { jobId: id, role: "LEAD", state: { in: [...ACTIVE_ASSIGNMENT_STATES] } },
                        select: { id: true },
                    })
                    if (lead) {
                        this.ctx.conflict("This job already has a lead technician; release the current one first")
                    }
                }
                const created = await tx.fieldJobAssignment.create({
                    data: {
                        jobId: id,
                        resourceId: resource.id,
                        role,
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                    include: { resource: { select: { name: true } } },
                })
                await this.ctx.appendEvent(tx, id, "ASSIGNMENT", "assignment", created.id, null, "ASSIGNED", actor, {
                    resourceId: resource.id,
                    role,
                    notified: false,
                })
                return { row: created, replayed: false }
            })
            return { assignment: this.toAssignment(out.row as never), replayed: out.replayed }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That technician is already assigned to this job")
        }
    }

    async listAssignments(workspaceId: string, jobId: string): Promise<readonly AssignmentRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const job = await this.ctx.ownedJob(profileId, jobId)
        const rows = await this.ctx.db.fieldJobAssignment.findMany({
            where: { jobId: job.id },
            orderBy: [{ role: "asc" }, { assignedAt: "asc" }],
            include: { resource: { select: { name: true } } },
        })
        return Object.freeze(rows.map((r) => this.toAssignment(r as never)))
    }

    /**
     * Moves a job card. DECLINED and RELEASED must carry a reason - the database agrees, and it
     * rejects whitespace too. An unexplained refusal reads as a mistake when somebody opens the
     * job card a week later.
     */
    async transitionAssignment(
        workspaceId: string,
        jobId: string,
        assignmentId: string,
        to: AssignmentStateValue,
        actor: FieldJobActor,
        reason?: string | null,
    ): Promise<AssignmentRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(jobId, "jobId")
        const aid = this.ctx.required(assignmentId, "assignmentId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            await this.lockJob(tx, id, profileId)
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; jobId: string; state: AssignmentStateValue }>>(
                `select "id","jobId","state" from "FieldJobAssignment" where "id" = $1 for update`,
                aid,
            )
            const current = rows[0]
            if (!current || current.jobId !== id) this.ctx.denied()
            if (assignmentFlow.isTerminal(current.state)) {
                this.ctx.conflict(`This job card is already ${current.state.toLowerCase()} and cannot change`)
            }
            if (!assignmentFlow.can(current.state, to)) {
                this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} job card to ${to.toLowerCase()}`)
            }
            if (REASON_REQUIRED_ASSIGNMENT_STATES.includes(to) && !reason?.trim()) {
                this.ctx.conflict(`Marking a job card ${to.toLowerCase()} needs a reason`)
            }

            const stamp = ASSIGNMENT_TIMESTAMP_FIELD[to]
            const updated = await tx.fieldJobAssignment.update({
                where: { id: aid },
                data: {
                    state: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "DECLINED" ? { declineReason: reason!.trim() } : {}),
                    ...(to === "RELEASED" ? { releaseReason: reason!.trim() } : {}),
                },
                include: { resource: { select: { name: true } } },
            })
            await this.ctx.appendEvent(tx, id, "ASSIGNMENT", "assignment", aid, current.state, to, actor, reason ? { reason } : undefined)
            return updated
        })
        return this.toAssignment(row as never)
    }

    async timeline(
        workspaceId: string,
        jobId: string,
    ): Promise<readonly Readonly<{ id: string; seq: string; kind: string; subjectType: string; subjectId: string; from: string | null; to: string; actor: string; actorId: string | null; at: Date; metadata: unknown }>[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const job = await this.ctx.ownedJob(profileId, jobId)
        const rows = await this.ctx.db.fieldJobEvent.findMany({ where: { jobId: job.id }, orderBy: { seq: "asc" } })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    seq: String(r.seq),
                    kind: r.kind as string,
                    subjectType: r.subjectType,
                    subjectId: r.subjectId,
                    from: r.from,
                    to: r.to,
                    actor: r.actor as string,
                    actorId: r.actorId,
                    at: r.at,
                    metadata: r.metadata,
                }),
            ),
        )
    }

    private toAssignment(row: RawAssignment & { resource: { name: string } }): AssignmentRecord {
        return Object.freeze({
            ...row,
            resourceName: row.resource.name,
            allowedTransitions: assignmentFlow.allowedFrom(row.state),
            isActive: ACTIVE_ASSIGNMENT_STATES.includes(row.state),
        })
    }

    private async lockJob(tx: Tx, jobId: string, profileId: string) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: JobStatusValue }>>(
            `select "id","profileId","status" from "FieldJob" where "id" = $1 for update`,
            jobId,
        )
        const current = rows[0]
        if (!current || current.profileId !== profileId) this.ctx.denied()
        return current
    }
}

export { PersistenceError } from "../persistence/errors"
