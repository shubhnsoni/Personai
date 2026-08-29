/**
 * Course access-level runtime (Wave G3).
 *
 * Two services, deliberately separate, because they answer to two different principals.
 *
 * CourseAccessService is the OWNER surface: it composes CohortContext, so tenancy, refusals and
 * authorization are the same profileId bridge every other cohort service uses. It defines tiers,
 * attaches visibility rules to lessons, grants and moves entitlements.
 *
 * LearnerAccessService is the LEARNER surface, and it takes no workspaceId at all. A learner is a
 * Member with a cookie session, not a Clerk user with a workspace membership; letting a learner
 * name a workspace would be handing them a probe. It resolves Member -> CourseEnrollment ->
 * CourseAccessGrant itself and answers exactly one question: which lessons may this learner see.
 *
 * NON-ENUMERATION IS THE POINT OF THE LEARNER PATH. A course that does not exist, a course
 * belonging to someone else, an enrolment that is not the caller's, and an enrolment that is
 * cancelled all produce the identical refusal. A learner cannot use the visibility endpoint to
 * discover that a course exists.
 *
 * NOTHING HERE EXECUTES A PAYMENT. A tier may carry a price so an owner can describe it. An
 * upgrade is requested, decided and applied; `invoiceRef` and `paymentId` are strings an owner may
 * record after settling up elsewhere. No Payment row is created, updated or read anywhere in this
 * file.
 *
 * VISIBILITY IS COMPUTED, NEVER CACHED. There is no entitlement snapshot column and no derived
 * progress table - the cohort schema harness forbids both by name. `visibleLessons` resolves the
 * rules on every call, because a cached answer is a second source of truth about what a learner
 * paid for.
 */
import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../persistence/errors"

import {
    ACCESS_CHANGE_TIMESTAMP_FIELD,
    ACCESS_GRANT_TIMESTAMP_FIELD,
    APPLIABLE_CHANGE_STATES,
    ENTITLABLE_ENROLLMENT_STATUSES,
    ENTITLING_GRANT_STATES,
    IN_FLIGHT_CHANGE_STATES,
    accessChangeFlow,
    accessGrantFlow,
    type AccessChangeDirectionValue,
    type AccessChangeStateValue,
    type AccessGrantSourceValue,
    type AccessGrantStateValue,
} from "./lifecycle"
import type { CohortActor, CohortContext } from "./shared"

export type AccessLevelRecord = Readonly<{
    id: string
    profileId: string
    courseId: string
    key: string
    label: string
    rank: number
    description: string | null
    priceCents: number | null
    currency: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}>

export type LessonRuleRecord = Readonly<{
    lessonId: string
    lessonTitle: string
    moduleId: string
    accessLevelId: string
    accessLevelKey: string
    requiredRank: number
}>

export type AccessGrantRecord = Readonly<{
    id: string
    enrollmentId: string
    accessLevelId: string
    accessLevelKey: string
    accessLevelRank: number
    courseId: string
    state: AccessGrantStateValue
    source: AccessGrantSourceValue
    grantedAt: Date | null
    suspendedAt: Date | null
    expiresAt: Date | null
    revokedAt: Date | null
    revokeReason: string | null
    paymentId: string | null
    allowedTransitions: readonly AccessGrantStateValue[]
    /** True only when the state entitles AND the expiry has not passed. Computed, never stored. */
    entitles: boolean
    createdAt: Date
    updatedAt: Date
}>

export type AccessChangeRecord = Readonly<{
    id: string
    grantId: string
    fromAccessLevelId: string
    toAccessLevelId: string
    direction: AccessChangeDirectionValue
    state: AccessChangeStateValue
    reason: string | null
    decisionNote: string | null
    decidedBy: string | null
    decidedAt: Date | null
    appliedAt: Date | null
    cancelledAt: Date | null
    invoiceRef: string | null
    paymentId: string | null
    allowedTransitions: readonly AccessChangeStateValue[]
    createdAt: Date
    updatedAt: Date
}>

export type VisibleLesson = Readonly<{
    lessonId: string
    title: string
    moduleId: string
    orderIndex: number
    /** Null when the lesson carries no rule at all, which is the default for every lesson. */
    requiredLevelKey: string | null
    requiredRank: number | null
    visible: boolean
    /** Stated plainly so a learner surface never has to guess why something is locked. */
    reason: string
}>

export type VisibilityReport = Readonly<{
    courseId: string
    enrollmentId: string
    heldLevelKey: string | null
    heldRank: number | null
    grantState: AccessGrantStateValue | null
    lessons: readonly VisibleLesson[]
    visibleCount: number
    lockedCount: number
}>

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

const GRANT_INCLUDE = {
    accessLevel: { select: { id: true, key: true, rank: true, courseId: true } },
    enrollment: { select: { id: true, courseId: true, status: true } },
} as const

function entitles(state: AccessGrantStateValue, expiresAt: Date | null, now: Date): boolean {
    if (!ENTITLING_GRANT_STATES.includes(state)) return false
    return expiresAt === null || expiresAt.getTime() > now.getTime()
}

export class CourseAccessService {
    constructor(private readonly ctx: CohortContext) {}

    // -----------------------------------------------------------------------
    // Tiers
    // -----------------------------------------------------------------------

    /**
     * Defines a tier. rank is what makes upgrade and downgrade derivable from data, so it is
     * required and must be a positive integer; the database agrees, but a named conflict is more
     * use to a caller than a constraint violation.
     */
    async defineLevel(
        workspaceId: string,
        input: Readonly<{
            courseId: string
            key: string
            label: string
            rank: number
            description?: string | null
            priceCents?: number | null
        }>,
        actor: CohortActor,
    ): Promise<AccessLevelRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, input.courseId)
        const key = this.ctx.required(input.key, "key")
        const label = this.ctx.required(input.label, "label")
        if (!Number.isInteger(input.rank) || input.rank < 1) {
            this.ctx.conflict("rank must be a positive integer, because it is what orders the tiers")
        }
        if (input.priceCents != null && (!Number.isInteger(input.priceCents) || input.priceCents < 0)) {
            this.ctx.conflict("priceCents must be a non-negative whole number of cents")
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.courseAccessLevel.create({
                    data: {
                        profileId,
                        courseId: course.id,
                        key,
                        label,
                        rank: input.rank,
                        description: input.description?.trim() || null,
                        priceCents: input.priceCents ?? null,
                    },
                })
                await this.event(tx, course.id, "LEVEL", "level", row.id, null, key, actor, { rank: input.rank })
                return Object.freeze(row) as AccessLevelRecord
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "A tier with that key or rank already exists on this course")
        }
    }

    async listLevels(workspaceId: string, courseId: string): Promise<readonly AccessLevelRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const rows = await this.ctx.db.courseAccessLevel.findMany({
            where: { courseId: course.id },
            orderBy: { rank: "asc" },
        })
        for (const row of rows) if (row.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => Object.freeze(r) as AccessLevelRecord))
    }

    /**
     * Retires a tier. Refused while any entitlement or in-flight change still points at it, because
     * deleting it would either orphan a learner or silently change what they can see.
     */
    async deactivateLevel(workspaceId: string, courseId: string, accessLevelId: string, actor: CohortActor): Promise<AccessLevelRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const level = await this.ownedLevel(profileId, course.id, accessLevelId)
        const held = await this.ctx.db.courseAccessGrant.count({
            where: { accessLevelId: level.id, state: { in: ["PENDING", "ACTIVE", "SUSPENDED"] } },
        })
        if (held > 0) {
            this.ctx.conflict(`${held} learner${held === 1 ? "" : "s"} still hold this tier, so it cannot be retired`)
        }
        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.courseAccessLevel.update({ where: { id: level.id }, data: { isActive: false } })
            await this.event(tx, course.id, "LEVEL", "level", level.id, "active", "retired", actor)
            return Object.freeze(row) as AccessLevelRecord
        })
    }

    // -----------------------------------------------------------------------
    // Visibility rules
    // -----------------------------------------------------------------------

    /**
     * Attaches or removes the minimum tier a lesson requires. Passing null removes the rule, which
     * returns the lesson to being visible to everybody - the state every lesson starts in.
     */
    async setLessonRule(
        workspaceId: string,
        input: Readonly<{ courseId: string; lessonId: string; accessLevelId: string | null }>,
        actor: CohortActor,
    ): Promise<{ lessonId: string; accessLevelId: string | null }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, input.courseId)
        const lessonId = this.ctx.required(input.lessonId, "lessonId")

        const lesson = await this.ctx.db.courseLesson.findUnique({
            where: { id: lessonId },
            select: { id: true, module: { select: { courseId: true } } },
        })
        if (!lesson || lesson.module.courseId !== course.id) this.ctx.denied()

        const levelId = input.accessLevelId?.trim() || null
        if (levelId) await this.ownedLevel(profileId, course.id, levelId)

        return this.ctx.db.$transaction(async (tx) => {
            if (levelId === null) {
                const existing = await tx.courseLessonAccess.findUnique({ where: { lessonId: lesson.id } })
                if (existing) {
                    await tx.courseLessonAccess.delete({ where: { lessonId: lesson.id } })
                    await this.event(tx, course.id, "VISIBILITY", "lesson", lesson.id, existing.accessLevelId, "unrestricted", actor)
                }
                return { lessonId: lesson.id, accessLevelId: null }
            }
            const existing = await tx.courseLessonAccess.findUnique({ where: { lessonId: lesson.id } })
            const row = await tx.courseLessonAccess.upsert({
                where: { lessonId: lesson.id },
                create: { lessonId: lesson.id, accessLevelId: levelId },
                update: { accessLevelId: levelId },
            })
            await this.event(
                tx,
                course.id,
                "VISIBILITY",
                "lesson",
                lesson.id,
                existing?.accessLevelId ?? null,
                levelId,
                actor,
            )
            return { lessonId: row.lessonId, accessLevelId: row.accessLevelId }
        })
    }

    async listLessonRules(workspaceId: string, courseId: string): Promise<readonly LessonRuleRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const rows = await this.ctx.db.courseLessonAccess.findMany({
            where: { accessLevel: { courseId: course.id } },
            select: {
                lessonId: true,
                accessLevelId: true,
                lesson: { select: { title: true, moduleId: true } },
                accessLevel: { select: { key: true, rank: true, courseId: true } },
            },
            orderBy: { lessonId: "asc" },
        })
        for (const row of rows) if (row.accessLevel.courseId !== course.id) this.ctx.denied()
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    lessonId: r.lessonId,
                    lessonTitle: r.lesson.title,
                    moduleId: r.lesson.moduleId,
                    accessLevelId: r.accessLevelId,
                    accessLevelKey: r.accessLevel.key,
                    requiredRank: r.accessLevel.rank,
                }),
            ),
        )
    }

    // -----------------------------------------------------------------------
    // Entitlements
    // -----------------------------------------------------------------------

    /**
     * Grants a tier to an enrolment. One grant per enrolment, so the grant IS idempotent by
     * identity: asking twice finds the same row and reports it as a replay rather than refusing or
     * duplicating.
     */
    async grant(
        workspaceId: string,
        input: Readonly<{
            courseId: string
            enrollmentId: string
            accessLevelId: string
            source?: AccessGrantSourceValue | null
            expiresAt?: Date | null
            paymentId?: string | null
        }>,
        actor: CohortActor,
    ): Promise<{ grant: AccessGrantRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, input.courseId)
        const enrolment = await this.ctx.ownedEnrollment(profileId, course.id, input.enrollmentId)
        const level = await this.ownedLevel(profileId, course.id, input.accessLevelId)
        if (!level.isActive) this.ctx.conflict("That tier has been retired, so it cannot be granted")
        if (!ENTITLABLE_ENROLLMENT_STATUSES.includes(enrolment.status)) {
            this.ctx.conflict(`A ${enrolment.status.toLowerCase()} enrolment cannot hold an entitlement`)
        }

        const existing = await this.ctx.db.courseAccessGrant.findUnique({
            where: { enrollmentId: enrolment.id },
            include: GRANT_INCLUDE,
        })
        if (existing) return { grant: this.toGrant(existing), replayed: true }

        try {
            const row = await this.ctx.db.$transaction(async (tx) => {
                const created = await tx.courseAccessGrant.create({
                    data: {
                        enrollmentId: enrolment.id,
                        accessLevelId: level.id,
                        source: input.source ?? "MANUAL",
                        expiresAt: input.expiresAt ?? null,
                        paymentId: input.paymentId?.trim() || null,
                    },
                    include: GRANT_INCLUDE,
                })
                await this.event(tx, course.id, "GRANT", "grant", created.id, null, "PENDING", actor, {
                    accessLevelKey: level.key,
                    source: input.source ?? "MANUAL",
                    paymentExecuted: false,
                })
                return created
            })
            return { grant: this.toGrant(row), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "That enrolment already holds an entitlement")
        }
    }

    async getGrant(workspaceId: string, courseId: string, enrollmentId: string): Promise<AccessGrantRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const enrolment = await this.ctx.ownedEnrollment(profileId, course.id, enrollmentId)
        const row = await this.ctx.db.courseAccessGrant.findUnique({
            where: { enrollmentId: enrolment.id },
            include: GRANT_INCLUDE,
        })
        if (!row) this.ctx.denied()
        return this.toGrant(row)
    }

    async transitionGrant(
        workspaceId: string,
        courseId: string,
        grantId: string,
        to: AccessGrantStateValue,
        actor: CohortActor,
        reason?: string | null,
    ): Promise<AccessGrantRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const id = this.ctx.required(grantId, "grantId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockGrant(tx, id, course.id)
            if (accessGrantFlow.isTerminal(current.state)) {
                this.ctx.conflict(`This entitlement is already ${current.state.toLowerCase()} and cannot change`)
            }
            if (!accessGrantFlow.can(current.state, to)) {
                this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} entitlement to ${to.toLowerCase()}`)
            }
            const stamp = ACCESS_GRANT_TIMESTAMP_FIELD[to]
            const updated = await tx.courseAccessGrant.update({
                where: { id },
                data: {
                    state: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "REVOKED" ? { revokeReason: reason?.trim() || null } : {}),
                    // Re-activating after expiry has to clear the stale expiry, or the grant would
                    // be ACTIVE and simultaneously past its own end date.
                    ...(to === "ACTIVE" && current.state === "EXPIRED" ? { expiresAt: null } : {}),
                },
                include: GRANT_INCLUDE,
            })
            await this.event(tx, course.id, "GRANT", "grant", id, current.state, to, actor, reason ? { reason } : undefined)
            return updated
        })
        return this.toGrant(row)
    }

    // -----------------------------------------------------------------------
    // Upgrades and downgrades
    // -----------------------------------------------------------------------

    /**
     * Requests a move to another tier. The DIRECTION is derived by comparing ranks rather than
     * taken from the caller, so a downgrade cannot be presented as an upgrade. One in-flight change
     * per grant, enforced here and by a partial unique index.
     */
    async requestChange(
        workspaceId: string,
        courseId: string,
        grantId: string,
        input: Readonly<{ toAccessLevelId: string; reason?: string | null; idempotencyKey?: string | null }>,
        actor: CohortActor,
    ): Promise<{ change: AccessChangeRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const id = this.ctx.required(grantId, "grantId")
        const key = input.idempotencyKey?.trim() || null

        const grant = await this.ctx.db.courseAccessGrant.findUnique({ where: { id }, include: GRANT_INCLUDE })
        if (!grant || grant.accessLevel.courseId !== course.id) this.ctx.denied()
        const target = await this.ownedLevel(profileId, course.id, input.toAccessLevelId)
        if (target.id === grant.accessLevelId) this.ctx.conflict("That is the tier the learner already holds")
        if (!target.isActive) this.ctx.conflict("That tier has been retired, so it cannot be moved to")
        if (accessGrantFlow.isTerminal(grant.state)) {
            this.ctx.conflict(`A ${grant.state.toLowerCase()} entitlement cannot be changed`)
        }

        if (key) {
            const replay = await this.ctx.db.courseAccessChange.findUnique({
                where: { grantId_idempotencyKey: { grantId: id, idempotencyKey: key } },
            })
            if (replay) return { change: this.toChange(replay), replayed: true }
        }

        const inFlight = await this.ctx.db.courseAccessChange.findFirst({
            where: { grantId: id, state: { in: [...IN_FLIGHT_CHANGE_STATES] as AccessChangeStateValue[] } },
            select: { id: true, state: true },
        })
        if (inFlight) {
            this.ctx.conflict(`A ${inFlight.state.toLowerCase()} tier change is already in flight for this learner`)
        }

        const direction: AccessChangeDirectionValue = target.rank > grant.accessLevel.rank ? "UPGRADE" : "DOWNGRADE"
        try {
            const row = await this.ctx.db.$transaction(async (tx) => {
                const created = await tx.courseAccessChange.create({
                    data: {
                        grantId: id,
                        fromAccessLevelId: grant.accessLevelId,
                        toAccessLevelId: target.id,
                        direction,
                        reason: input.reason?.trim() || null,
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                })
                await this.event(tx, course.id, "CHANGE", "change", created.id, grant.accessLevel.key, target.key, actor, {
                    direction,
                    paymentExecuted: false,
                })
                return created
            })
            return { change: this.toChange(row), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "A tier change is already in flight for this learner")
        }
    }

    async decideChange(
        workspaceId: string,
        courseId: string,
        changeId: string,
        decision: "APPROVED" | "REJECTED",
        decidedBy: string,
        actor: CohortActor,
        note?: string | null,
    ): Promise<AccessChangeRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const id = this.ctx.required(changeId, "changeId")
        const by = this.ctx.required(decidedBy, "decidedBy")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockChange(tx, id, course.id)
            if (!accessChangeFlow.can(current.state, decision)) {
                this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} change to ${decision.toLowerCase()}`)
            }
            const stamp = ACCESS_CHANGE_TIMESTAMP_FIELD[decision]
            const updated = await tx.courseAccessChange.update({
                where: { id },
                data: {
                    state: decision,
                    decidedBy: by,
                    decisionNote: note?.trim() || null,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                },
            })
            await this.event(tx, course.id, "CHANGE", "change", id, current.state, decision, actor, {
                decidedBy: by,
                paymentExecuted: false,
            })
            return updated
        })
        return this.toChange(row)
    }

    /**
     * Applies an APPROVED change: the entitlement moves to the new tier and the change becomes
     * APPLIED, in one transaction. This is the step where a payment would sit if the system ever
     * took one; it does not, and the event records `paymentExecuted: false` so nobody reading the
     * history can conclude otherwise.
     */
    async applyChange(
        workspaceId: string,
        courseId: string,
        changeId: string,
        actor: CohortActor,
        options?: Readonly<{ invoiceRef?: string | null; paymentId?: string | null }>,
    ): Promise<{ change: AccessChangeRecord; grant: AccessGrantRecord }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const id = this.ctx.required(changeId, "changeId")

        const out = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockChange(tx, id, course.id)
            if (!APPLIABLE_CHANGE_STATES.includes(current.state)) {
                this.ctx.conflict(`Only an approved change can be applied; this one is ${current.state.toLowerCase()}`)
            }
            const grantRows = await tx.$queryRawUnsafe<Array<{ id: string; accessLevelId: string; state: AccessGrantStateValue }>>(
                `select "id","accessLevelId","state" from "CourseAccessGrant" where "id" = $1 for update`,
                current.grantId,
            )
            const grant = grantRows[0]
            if (!grant) this.ctx.denied()
            if (grant.accessLevelId !== current.fromAccessLevelId) {
                // The entitlement moved under us, so applying would overwrite a tier the change was
                // never agreed against.
                this.ctx.conflict("The entitlement has changed since this move was approved, so it can no longer be applied")
            }
            if (accessGrantFlow.isTerminal(grant.state)) {
                this.ctx.conflict(`A ${grant.state.toLowerCase()} entitlement cannot be moved`)
            }

            const change = await tx.courseAccessChange.update({
                where: { id },
                data: {
                    state: "APPLIED",
                    appliedAt: new Date(),
                    invoiceRef: options?.invoiceRef?.trim() || null,
                    paymentId: options?.paymentId?.trim() || null,
                },
            })
            const updatedGrant = await tx.courseAccessGrant.update({
                where: { id: current.grantId },
                data: { accessLevelId: current.toAccessLevelId },
                include: GRANT_INCLUDE,
            })
            await this.event(tx, course.id, "CHANGE", "change", id, "APPROVED", "APPLIED", actor, {
                direction: current.direction,
                paymentExecuted: false,
            })
            await this.event(
                tx,
                course.id,
                "GRANT",
                "grant",
                current.grantId,
                current.fromAccessLevelId,
                current.toAccessLevelId,
                actor,
                { via: id },
            )
            return { change, grant: updatedGrant }
        })
        return { change: this.toChange(out.change), grant: this.toGrant(out.grant) }
    }

    async listChanges(workspaceId: string, courseId: string, grantId: string): Promise<readonly AccessChangeRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const id = this.ctx.required(grantId, "grantId")
        const grant = await this.ctx.db.courseAccessGrant.findUnique({ where: { id }, include: GRANT_INCLUDE })
        if (!grant || grant.accessLevel.courseId !== course.id) this.ctx.denied()
        const rows = await this.ctx.db.courseAccessChange.findMany({ where: { grantId: id }, orderBy: { createdAt: "asc" } })
        return Object.freeze(rows.map((r) => this.toChange(r)))
    }

    /** Owner view of the same computation the learner gets, for the console. */
    async visibilityFor(workspaceId: string, courseId: string, enrollmentId: string): Promise<VisibilityReport> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const enrolment = await this.ctx.ownedEnrollment(profileId, course.id, enrollmentId)
        return computeVisibility(this.ctx.db, course.id, enrolment.id)
    }

    async timeline(
        workspaceId: string,
        courseId: string,
    ): Promise<readonly Readonly<{ id: string; seq: string; kind: string; subjectType: string; subjectId: string; from: string | null; to: string; actor: string; at: Date; metadata: unknown }>[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const course = await this.ctx.ownedCourse(profileId, courseId)
        const rows = await this.ctx.db.courseAccessEvent.findMany({
            where: { courseId: course.id },
            orderBy: { seq: "asc" },
        })
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
                    at: r.at,
                    metadata: r.metadata,
                }),
            ),
        )
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private async ownedLevel(profileId: string, courseId: string, accessLevelId: string) {
        const id = this.ctx.required(accessLevelId, "accessLevelId")
        const row = await this.ctx.db.courseAccessLevel.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId || row.courseId !== courseId) this.ctx.denied()
        return row
    }

    private async lockGrant(tx: Tx, grantId: string, courseId: string) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; state: AccessGrantStateValue; accessLevelId: string }>>(
            `select g."id", g."state", g."accessLevelId" from "CourseAccessGrant" g where g."id" = $1 for update`,
            grantId,
        )
        const current = rows[0]
        if (!current) this.ctx.denied()
        const level = await tx.courseAccessLevel.findUnique({
            where: { id: current.accessLevelId },
            select: { courseId: true },
        })
        if (!level || level.courseId !== courseId) this.ctx.denied()
        return current
    }

    private async lockChange(tx: Tx, changeId: string, courseId: string) {
        const rows = await tx.$queryRawUnsafe<
            Array<{
                id: string
                grantId: string
                state: AccessChangeStateValue
                fromAccessLevelId: string
                toAccessLevelId: string
                direction: AccessChangeDirectionValue
            }>
        >(
            `select "id","grantId","state","fromAccessLevelId","toAccessLevelId","direction"
               from "CourseAccessChange" where "id" = $1 for update`,
            changeId,
        )
        const current = rows[0]
        if (!current) this.ctx.denied()
        const level = await tx.courseAccessLevel.findUnique({
            where: { id: current.fromAccessLevelId },
            select: { courseId: true },
        })
        if (!level || level.courseId !== courseId) this.ctx.denied()
        return current
    }

    private toGrant(row: {
        id: string
        enrollmentId: string
        accessLevelId: string
        state: string
        source: string
        grantedAt: Date | null
        suspendedAt: Date | null
        expiresAt: Date | null
        revokedAt: Date | null
        revokeReason: string | null
        paymentId: string | null
        createdAt: Date
        updatedAt: Date
        accessLevel: { id: string; key: string; rank: number; courseId: string }
    }): AccessGrantRecord {
        const state = row.state as AccessGrantStateValue
        return Object.freeze({
            id: row.id,
            enrollmentId: row.enrollmentId,
            accessLevelId: row.accessLevelId,
            accessLevelKey: row.accessLevel.key,
            accessLevelRank: row.accessLevel.rank,
            courseId: row.accessLevel.courseId,
            state,
            source: row.source as AccessGrantSourceValue,
            grantedAt: row.grantedAt,
            suspendedAt: row.suspendedAt,
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
            revokeReason: row.revokeReason,
            paymentId: row.paymentId,
            allowedTransitions: accessGrantFlow.allowedFrom(state),
            entitles: entitles(state, row.expiresAt, new Date()),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    private toChange(row: {
        id: string
        grantId: string
        fromAccessLevelId: string
        toAccessLevelId: string
        direction: string
        state: string
        reason: string | null
        decisionNote: string | null
        decidedBy: string | null
        decidedAt: Date | null
        appliedAt: Date | null
        cancelledAt: Date | null
        invoiceRef: string | null
        paymentId: string | null
        createdAt: Date
        updatedAt: Date
    }): AccessChangeRecord {
        const state = row.state as AccessChangeStateValue
        return Object.freeze({
            id: row.id,
            grantId: row.grantId,
            fromAccessLevelId: row.fromAccessLevelId,
            toAccessLevelId: row.toAccessLevelId,
            direction: row.direction as AccessChangeDirectionValue,
            state,
            reason: row.reason,
            decisionNote: row.decisionNote,
            decidedBy: row.decidedBy,
            decidedAt: row.decidedAt,
            appliedAt: row.appliedAt,
            cancelledAt: row.cancelledAt,
            invoiceRef: row.invoiceRef,
            paymentId: row.paymentId,
            allowedTransitions: accessChangeFlow.allowedFrom(state),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    private async event(
        tx: Tx,
        courseId: string,
        kind: "LEVEL" | "VISIBILITY" | "GRANT" | "CHANGE" | "NOTE",
        subjectType: string,
        subjectId: string,
        from: string | null,
        to: string,
        actor: CohortActor,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        await tx.courseAccessEvent.create({
            data: {
                courseId,
                kind,
                subjectType,
                subjectId,
                from,
                to,
                actor: actor.actorType,
                actorId: actor.actorId,
                ...(metadata ? { metadata: metadata as never } : {}),
            },
        })
    }
}

/**
 * The single visibility computation, shared by the owner console and the learner surface so the
 * two can never disagree about what a learner can see.
 *
 * The rule, in one sentence: a lesson is visible when it carries no rule, or when the learner
 * holds an ENTITLING grant whose rank is at least the rule's rank.
 */
async function computeVisibility(db: PrismaClient, courseId: string, enrollmentId: string): Promise<VisibilityReport> {
    const grant = await db.courseAccessGrant.findUnique({
        where: { enrollmentId },
        include: { accessLevel: { select: { key: true, rank: true } } },
    })
    const now = new Date()
    const state = (grant?.state ?? null) as AccessGrantStateValue | null
    const held = grant && state && entitles(state, grant.expiresAt, now) ? grant.accessLevel : null

    const lessons = await db.courseLesson.findMany({
        where: { module: { courseId } },
        orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
        select: {
            id: true,
            title: true,
            moduleId: true,
            orderIndex: true,
            CourseLessonAccess: { select: { accessLevel: { select: { key: true, rank: true } } } },
        },
    })

    const rows: VisibleLesson[] = lessons.map((lesson) => {
        const rule = lesson.CourseLessonAccess?.accessLevel ?? null
        if (!rule) {
            return Object.freeze({
                lessonId: lesson.id,
                title: lesson.title,
                moduleId: lesson.moduleId,
                orderIndex: lesson.orderIndex,
                requiredLevelKey: null,
                requiredRank: null,
                visible: true,
                reason: "This lesson carries no access rule, so every enrolled learner can see it.",
            })
        }
        if (!held) {
            return Object.freeze({
                lessonId: lesson.id,
                title: lesson.title,
                moduleId: lesson.moduleId,
                orderIndex: lesson.orderIndex,
                requiredLevelKey: rule.key,
                requiredRank: rule.rank,
                visible: false,
                reason:
                    state === null
                        ? `This lesson needs the ${rule.key} tier, and this enrolment holds no tier.`
                        : `This lesson needs the ${rule.key} tier, and this enrolment's tier is ${state.toLowerCase()}.`,
            })
        }
        const visible = held.rank >= rule.rank
        return Object.freeze({
            lessonId: lesson.id,
            title: lesson.title,
            moduleId: lesson.moduleId,
            orderIndex: lesson.orderIndex,
            requiredLevelKey: rule.key,
            requiredRank: rule.rank,
            visible,
            reason: visible
                ? `The ${held.key} tier meets this lesson's ${rule.key} requirement.`
                : `This lesson needs the ${rule.key} tier; this enrolment holds ${held.key}.`,
        })
    })

    return Object.freeze({
        courseId,
        enrollmentId,
        heldLevelKey: held?.key ?? null,
        heldRank: held?.rank ?? null,
        grantState: state,
        lessons: Object.freeze(rows),
        visibleCount: rows.filter((r) => r.visible).length,
        lockedCount: rows.filter((r) => !r.visible).length,
    })
}

/**
 * The single per-lesson visibility decision, exported so the content reader and the completion
 * route call the SAME rule the owner console and the learner surface call.
 *
 * Deliberately typed against the narrowest client that can answer the question, so it works
 * inside a Prisma transaction as well as against the full client. Duplicating the rule at the
 * three call sites was the alternative, and three copies of an access rule is three chances to
 * disagree about what somebody paid for.
 */
export async function lessonVisibleToEnrollment(
    db: Pick<PrismaClient, "courseLessonAccess" | "courseAccessGrant">,
    lessonId: string,
    enrollmentId: string,
): Promise<boolean> {
    const rule = await db.courseLessonAccess.findUnique({
        where: { lessonId },
        select: { accessLevel: { select: { rank: true } } },
    })
    // No rule means unrestricted. That is the pre-existing behaviour of every lesson in the
    // database, and it is why adding tiers changed nothing for anybody.
    if (!rule) return true

    const grant = await db.courseAccessGrant.findUnique({
        where: { enrollmentId },
        select: { state: true, expiresAt: true, accessLevel: { select: { rank: true } } },
    })
    if (!grant) return false
    if (!entitles(grant.state as AccessGrantStateValue, grant.expiresAt, new Date())) return false
    return grant.accessLevel.rank >= rule.accessLevel.rank
}

/**
 * The learner surface. Takes NO workspaceId: a learner has no workspace membership, and accepting
 * one would hand them a probe for other people's tenancy.
 *
 * Every failure - unknown course, someone else's course, an enrolment that is not the caller's, an
 * enrolment that is cancelled - produces the identical refusal, so this cannot be used to discover
 * that anything exists.
 */
export class LearnerAccessService {
    constructor(private readonly db: PrismaClient) {}

    private denied(): never {
        throw new PersistenceError("FORBIDDEN", "Access denied")
    }

    /**
     * Resolves the caller's own enrolment on a course and returns what they may see. Identity is a
     * Member id or the email that Member is known by, matching how the existing library reader
     * resolves an enrolment.
     */
    async visibleLessons(
        input: Readonly<{ courseId: string; memberId?: string | null; memberEmail?: string | null }>,
    ): Promise<VisibilityReport> {
        const courseId = input.courseId?.trim()
        const memberId = input.memberId?.trim() || null
        const memberEmail = input.memberEmail?.trim().toLowerCase() || null
        if (!courseId || (!memberId && !memberEmail)) this.denied()

        const enrolment = await this.db.courseEnrollment.findFirst({
            where: {
                courseId,
                status: { in: [...ENTITLABLE_ENROLLMENT_STATUSES] },
                ...(memberId && memberEmail
                    ? { OR: [{ memberId }, { visitorEmail: memberEmail }] }
                    : memberId
                      ? { memberId }
                      : { visitorEmail: memberEmail! }),
            },
            select: { id: true, courseId: true },
        })
        // Absent course, foreign course, foreign enrolment and cancelled enrolment all land here.
        if (!enrolment) this.denied()

        return computeVisibility(this.db, enrolment.courseId, enrolment.id)
    }

    /**
     * The single question a content reader actually needs to ask before serving a lesson. Kept
     * separate from visibleLessons so a caller cannot accidentally authorise on a list it fetched
     * earlier and then reused.
     */
    async canViewLesson(
        input: Readonly<{ lessonId: string; memberId?: string | null; memberEmail?: string | null }>,
    ): Promise<{ allowed: boolean; reason: string }> {
        const lessonId = input.lessonId?.trim()
        if (!lessonId) this.denied()
        const lesson = await this.db.courseLesson.findUnique({
            where: { id: lessonId },
            select: { id: true, module: { select: { courseId: true } } },
        })
        if (!lesson) this.denied()

        const report = await this.visibleLessons({
            courseId: lesson.module.courseId,
            memberId: input.memberId,
            memberEmail: input.memberEmail,
        })
        const row = report.lessons.find((l) => l.lessonId === lesson.id)
        if (!row) this.denied()
        return { allowed: row.visible, reason: row.reason }
    }
}
