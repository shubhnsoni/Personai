import { PersistenceError } from "@/lib/persistence/errors"

import {
    ENROLLABLE_COHORT_STATUSES,
    MEMBERSHIP_TIMESTAMP_FIELD,
    POLICY_GATED_MEMBERSHIP_STATUSES,
    cohortFlow,
    membershipFlow,
    type CohortStatusValue,
    type MembershipStatusValue,
} from "./lifecycle"
import type { CohortProgressService } from "./progress"
import type { CohortActor, CohortContext } from "./shared"

/**
 * Cohort and membership engine.
 *
 * A cohort is a dated run of an EXISTING Course. Enrolment is an EXISTING
 * CourseEnrollment. This service creates neither a parallel course nor a parallel
 * learner: it creates the batch, and the membership that ties an enrolment to it.
 *
 * Every mutation appends to CohortEvent inside the same transaction, so an accepted
 * change and its history cannot come apart.
 */

export type CohortRecord = Readonly<{
    id: string
    profileId: string
    courseId: string
    code: string
    title: string
    status: CohortStatusValue
    timezone: string
    startsOn: Date | null
    endsOn: Date | null
    capacity: number | null
    attendanceThresholdPct: number
    requireAllAssignments: boolean
    requireAllLessons: boolean
    createdAt: Date
    updatedAt: Date
    allowedTransitions: readonly CohortStatusValue[]
}>

type RawCohort = {
    id: string
    profileId: string
    courseId: string
    code: string
    title: string
    status: string
    timezone: string
    startsOn: Date | null
    endsOn: Date | null
    capacity: number | null
    attendanceThresholdPct: number
    requireAllAssignments: boolean
    requireAllLessons: boolean
    createdAt: Date
    updatedAt: Date
}

export function toCohortRecord(row: RawCohort): CohortRecord {
    const status = row.status as CohortStatusValue
    return Object.freeze({
        id: row.id,
        profileId: row.profileId,
        courseId: row.courseId,
        code: row.code,
        title: row.title,
        status,
        timezone: row.timezone,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        capacity: row.capacity,
        attendanceThresholdPct: row.attendanceThresholdPct,
        requireAllAssignments: row.requireAllAssignments,
        requireAllLessons: row.requireAllLessons,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        allowedTransitions: cohortFlow.allowedFrom(status),
    })
}

export class CohortService {
    constructor(
        private readonly ctx: CohortContext,
        private readonly progress: CohortProgressService,
    ) {}

    // ---- cohorts -------------------------------------------------------

    async list(workspaceId: string, courseId?: string | null): Promise<readonly CohortRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const scopedCourse = courseId?.trim() || null
        if (scopedCourse) await this.ctx.ownedCourse(profileId, scopedCourse)
        const rows = await this.ctx.db.cohort.findMany({
            where: { profileId, ...(scopedCourse ? { courseId: scopedCourse } : {}) },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        // Revalidate on the way out rather than trusting the query alone.
        for (const r of rows) if (r.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toCohortRecord(r as RawCohort)))
    }

    async get(workspaceId: string, cohortId: string): Promise<CohortRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        return toCohortRecord((await this.ctx.ownedCohort(profileId, cohortId)) as RawCohort)
    }

    async create(
        workspaceId: string,
        input: Readonly<{
            courseId: string
            code: string
            title: string
            timezone?: string | null
            startsOn?: Date | null
            endsOn?: Date | null
            capacity?: number | null
            attendanceThresholdPct?: number | null
            requireAllAssignments?: boolean
            requireAllLessons?: boolean
            idempotencyKey?: string | null
        }>,
        actor: CohortActor,
    ): Promise<{ record: CohortRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, input.courseId)
        const code = this.ctx.required(input.code, "code")
        const title = this.ctx.required(input.title, "title")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.cohort.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey } },
            })
            if (existing) return { record: toCohortRecord(existing as RawCohort), replayed: true }
        }

        const capacity = input.capacity ?? null
        if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
            this.ctx.conflict("capacity must be a positive integer when set")
        }
        const threshold = input.attendanceThresholdPct ?? 0
        if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
            this.ctx.conflict("attendanceThresholdPct must be an integer between 0 and 100")
        }
        if (input.startsOn && input.endsOn && input.endsOn.getTime() < input.startsOn.getTime()) {
            this.ctx.conflict("a cohort cannot end before it starts")
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.cohort.create({
                    data: {
                        profileId,
                        courseId: course.id,
                        code,
                        title,
                        timezone: input.timezone?.trim() || "UTC",
                        startsOn: input.startsOn ?? null,
                        endsOn: input.endsOn ?? null,
                        capacity,
                        attendanceThresholdPct: threshold,
                        requireAllAssignments: input.requireAllAssignments === true,
                        requireAllLessons: input.requireAllLessons === true,
                        idempotencyKey,
                    },
                })
                await this.ctx.appendEvent(tx, row.id, "CREATED", null, "PLANNED", actor, { courseId: course.id })
                return row
            })
            return { record: toCohortRecord(created as RawCohort), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, `A cohort with code ${code} already exists on this program`)
        }
    }

    async transition(
        workspaceId: string,
        cohortId: string,
        to: CohortStatusValue,
        actor: CohortActor,
        reason?: string | null,
    ): Promise<CohortRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = this.ctx.required(cohortId, "cohortId")

        const updated = await this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: CohortStatusValue }>>(
                `select "id","profileId","status" from "Cohort" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.profileId !== profileId) this.ctx.denied()
            if (cohortFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This cohort is already ${current.status.toLowerCase()} and cannot change`)
            }
            if (!cohortFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} cohort to ${to.toLowerCase()}`)
            }
            const row = await tx.cohort.update({ where: { id }, data: { status: to } })
            await this.ctx.appendEvent(tx, id, "STATUS", current.status, to, actor, reason ? { reason } : undefined)
            return row
        })
        return toCohortRecord(updated as RawCohort)
    }

    // ---- enrolment (the EXISTING CourseEnrollment) ---------------------

    /**
     * Creates or replays a CourseEnrollment on an owned course. This is the pre-existing
     * learner-to-program record; nothing here duplicates it. `Member` is optional because
     * the platform already supports a visitor enrolment identified by email.
     */
    async enrol(
        workspaceId: string,
        input: Readonly<{
            courseId: string
            visitorEmail: string
            visitorName?: string | null
            memberId?: string | null
            idempotencyKey?: string | null
        }>,
    ): Promise<{ enrollmentId: string; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, input.courseId)
        const visitorEmail = this.ctx.required(input.visitorEmail, "visitorEmail")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.courseEnrollment.findUnique({
                where: { courseId_idempotencyKey: { courseId: course.id, idempotencyKey } },
                select: { id: true },
            })
            if (existing) return { enrollmentId: existing.id, replayed: true }
        }

        const memberId = input.memberId?.trim() || null
        if (memberId) {
            const member = await this.ctx.db.member.findUnique({ where: { id: memberId }, select: { id: true } })
            if (!member) this.ctx.denied()
        }

        try {
            const row = await this.ctx.db.courseEnrollment.create({
                data: {
                    courseId: course.id,
                    visitorEmail,
                    visitorName: input.visitorName?.trim() || null,
                    memberId,
                    idempotencyKey,
                },
                select: { id: true },
            })
            return { enrollmentId: row.id, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That enrolment was already recorded")
        }
    }

    // ---- memberships ---------------------------------------------------

    async listMemberships(workspaceId: string, cohortId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        const rows = await this.ctx.db.cohortMembership.findMany({
            where: { cohortId: cohort.id },
            include: {
                enrollment: { select: { id: true, visitorEmail: true, visitorName: true, memberId: true, status: true } },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    ...r,
                    allowedTransitions: membershipFlow.allowedFrom(r.status as MembershipStatusValue),
                }),
            ),
        )
    }

    /**
     * Joins an existing enrolment to a cohort. Capacity is enforced inside the
     * transaction against a locked cohort row, so two concurrent joins cannot both
     * consume the last seat.
     */
    async join(
        workspaceId: string,
        cohortId: string,
        input: Readonly<{ enrollmentId: string; idempotencyKey?: string | null }>,
        actor: CohortActor,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        const enrollment = await this.ctx.ownedEnrollment(profileId, cohort.courseId, input.enrollmentId)
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.cohortMembership.findUnique({
                where: { cohortId_idempotencyKey: { cohortId: cohort.id, idempotencyKey } },
            })
            if (existing) return { membership: existing, replayed: true }
        }

        if (!ENROLLABLE_COHORT_STATUSES.includes(cohort.status as CohortStatusValue)) {
            this.ctx.conflict(`A ${cohort.status.toLowerCase()} cohort cannot accept new members`)
        }

        try {
            const created = await this.ctx.db.$transaction(async (tx) => {
                const locked = await tx.$queryRawUnsafe<Array<{ id: string; capacity: number | null; status: string }>>(
                    `select "id","capacity","status" from "Cohort" where "id" = $1 for update`,
                    cohort.id,
                )
                const row0 = locked[0]
                if (!row0) this.ctx.denied()
                if (!ENROLLABLE_COHORT_STATUSES.includes(row0.status as CohortStatusValue)) {
                    this.ctx.conflict(`A ${row0.status.toLowerCase()} cohort cannot accept new members`)
                }
                if (row0.capacity !== null) {
                    const taken = await tx.cohortMembership.count({
                        where: { cohortId: cohort.id, status: { notIn: ["WITHDRAWN"] } },
                    })
                    if (taken >= row0.capacity) {
                        this.ctx.conflict(`This cohort is full at ${row0.capacity} places`)
                    }
                }
                const membership = await tx.cohortMembership.create({
                    data: { cohortId: cohort.id, enrollmentId: enrollment.id, idempotencyKey },
                })
                await this.ctx.appendEvent(tx, cohort.id, "MEMBERSHIP", null, "INVITED", actor, {
                    membershipId: membership.id,
                    enrollmentId: enrollment.id,
                })
                return membership
            })
            return { membership: created, replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That enrolment has already joined this cohort")
        }
    }

    /**
     * Moves a membership through its lifecycle. COMPLETED is gated on the cohort's own
     * published policy evaluated against persisted records, and the refusal explains
     * exactly which requirement is unmet.
     */
    async transitionMembership(
        workspaceId: string,
        cohortId: string,
        membershipId: string,
        to: MembershipStatusValue,
        actor: CohortActor,
        reason?: string | null,
    ) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const { cohort, membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)

        if (membershipFlow.isTerminal(membership.status as MembershipStatusValue)) {
            this.ctx.conflict(`This membership is already ${membership.status.toLowerCase()} and cannot change`)
        }
        if (!membershipFlow.can(membership.status as MembershipStatusValue, to)) {
            this.ctx.conflict(`Cannot move a ${membership.status.toLowerCase()} membership to ${to.toLowerCase()}`)
        }

        if (POLICY_GATED_MEMBERSHIP_STATUSES.includes(to)) {
            const report = await this.progress.evaluate(cohort, membership)
            if (!report.eligible) {
                throw new PersistenceError(
                    "CONFLICT",
                    `This learner does not meet the completion policy: ${report.reasons.join("; ")}`,
                    { reasons: report.reasons },
                )
            }
        }

        const stamp = MEMBERSHIP_TIMESTAMP_FIELD[to]
        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.cohortMembership.update({
                where: { id: membership.id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "WITHDRAWN" ? { leaveReason: reason?.trim() || null } : {}),
                },
            })
            await this.ctx.appendEvent(tx, cohort.id, "MEMBERSHIP", membership.status, to, actor, {
                membershipId: membership.id,
                ...(reason ? { reason } : {}),
            })
            return row
        })
    }

    // ---- derived views -------------------------------------------------

    async progressFor(workspaceId: string, cohortId: string, membershipId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const { cohort, membership } = await this.ctx.ownedMembership(profileId, cohortId, membershipId)
        return this.progress.evaluate(cohort, membership)
    }

    async timeline(workspaceId: string, cohortId: string) {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const cohort = await this.ctx.ownedCohort(profileId, cohortId)
        return Object.freeze(
            await this.ctx.db.cohortEvent.findMany({
                where: { cohortId: cohort.id },
                orderBy: { seq: "asc" },
            }),
        )
    }
}
