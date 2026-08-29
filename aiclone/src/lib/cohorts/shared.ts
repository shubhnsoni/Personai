import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

/**
 * Shared tenancy and composition helpers for the cohort engine.
 *
 * TENANCY is profileId, bridged from the caller's workspace. `Course` is already
 * profileId-scoped and `Workspace.profileId` is unique, so the bridge is exact — this is
 * the same bridge the appointment domain uses. Inventing a workspaceId column on Cohort
 * would have created a second tenant key over the same content tree.
 *
 * NON-ENUMERATION: `denied()` is the single refusal used for both foreign and nonexistent
 * resources, so the two are indistinguishable by construction rather than by convention.
 *
 * TIME COMPARISONS must use Prisma's typed API. Raw SQL `Date` parameters bind as local
 * wall-clock against `timestamp without time zone` while Prisma writes UTC components,
 * which silently disabled an overlap check in an earlier wave.
 */

export const UNIQUE_VIOLATION = "23505"

export function pgCode(error: unknown): string | null {
    const e = error as { code?: unknown; meta?: { code?: unknown } } | null
    if (!e) return null
    if (typeof e.code === "string" && /^\d{5}$/.test(e.code)) return e.code
    if (typeof e.meta?.code === "string" && /^\d{5}$/.test(e.meta.code)) return e.meta.code
    const m = error instanceof Error ? error.message : String(error)
    if (/Code: `23505`/.test(m) || /Unique constraint failed/i.test(m)) return UNIQUE_VIOLATION
    return null
}

export type CohortActor = Readonly<{ actorType: "LEARNER" | "STAFF" | "SYSTEM"; actorId: string | null }>

export type CohortEventKindValue =
    | "CREATED" | "STATUS" | "MEMBERSHIP" | "SESSION" | "ATTENDANCE"
    | "ASSIGNMENT" | "SUBMISSION" | "CERTIFICATE" | "RENEWAL" | "NOTE"

type EventWriter = Pick<PrismaClient, "cohortEvent">

export class CohortContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /**
     * Resolves the caller's workspace to the profileId that owns the content tree.
     * A workspace with no linked profile has no courses, so it cannot have cohorts.
     */
    async requireProfile(workspaceId: string, permission: "profile.read" | "profile.update"): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a profile that owns programs")
        }
        return workspace.profileId
    }

    denied(): never {
        throw new PersistenceError("FORBIDDEN", "Access denied")
    }

    required(value: string | undefined | null, field: string): string {
        const v = value?.trim()
        if (!v) throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
        return v
    }

    conflict(message: string): never {
        throw new PersistenceError("CONFLICT", message)
    }

    /** Maps a unique-constraint collision to a caller-meaningful conflict. */
    rethrowUnique(error: unknown, message: string): never {
        if (error instanceof PersistenceError) throw error
        if (pgCode(error) === UNIQUE_VIOLATION) throw new PersistenceError("CONFLICT", message)
        throw error
    }

    /** A course may only be used if the caller's profile owns it. */
    async ownedCourse(profileId: string, courseId: string) {
        const id = this.required(courseId, "courseId")
        const row = await this.db.course.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** Loads a cohort and proves ownership. Refuses identically when absent. */
    async ownedCohort(profileId: string, cohortId: string) {
        const id = this.required(cohortId, "cohortId")
        const row = await this.db.cohort.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /** Loads a membership through its cohort, so tenancy is proved on the way in. */
    async ownedMembership(profileId: string, cohortId: string, membershipId: string) {
        const cohort = await this.ownedCohort(profileId, cohortId)
        const id = this.required(membershipId, "membershipId")
        const row = await this.db.cohortMembership.findUnique({ where: { id } })
        if (!row || row.cohortId !== cohort.id) this.denied()
        return { cohort, membership: row }
    }

    async ownedSession(profileId: string, cohortId: string, sessionId: string) {
        const cohort = await this.ownedCohort(profileId, cohortId)
        const id = this.required(sessionId, "sessionId")
        const row = await this.db.cohortSession.findUnique({ where: { id } })
        if (!row || row.cohortId !== cohort.id) this.denied()
        return { cohort, session: row }
    }

    async ownedAssignment(profileId: string, cohortId: string, assignmentId: string) {
        const cohort = await this.ownedCohort(profileId, cohortId)
        const id = this.required(assignmentId, "assignmentId")
        const row = await this.db.cohortAssignment.findUnique({ where: { id } })
        if (!row || row.cohortId !== cohort.id) this.denied()
        return { cohort, assignment: row }
    }

    /** An enrolment may only be attached to a cohort of the course it belongs to. */
    async ownedEnrollment(profileId: string, courseId: string, enrollmentId: string) {
        const id = this.required(enrollmentId, "enrollmentId")
        const row = await this.db.courseEnrollment.findUnique({
            where: { id },
            select: { id: true, courseId: true, memberId: true, visitorEmail: true, status: true },
        })
        if (!row || row.courseId !== courseId) this.denied()
        // Prove the course itself is owned, so a valid enrolment id from another tenant
        // cannot be used by naming its own course.
        await this.ownedCourse(profileId, courseId)
        return row
    }

    /** A location boundary: a venue must belong to the caller's own workspace. */
    async assertLocation(profileId: string, locationId: string | null): Promise<string | null> {
        if (!locationId) return null
        const l = await this.db.location.findUnique({
            where: { id: locationId },
            select: { id: true, workspace: { select: { profileId: true } } },
        })
        if (!l || l.workspace?.profileId !== profileId) this.denied()
        return l.id
    }

    /** A ProfileDocument reference, reusing the existing upload store. */
    async assertDocument(profileId: string, documentId: string | null): Promise<string | null> {
        if (!documentId) return null
        const d = await this.db.profileDocument.findUnique({
            where: { id: documentId },
            select: { id: true, profileId: true },
        })
        if (!d || d.profileId !== profileId) this.denied()
        return d.id
    }

    async appendEvent(
        tx: EventWriter,
        cohortId: string,
        kind: CohortEventKindValue,
        from: string | null,
        to: string,
        actor: CohortActor,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        await tx.cohortEvent.create({
            data: {
                cohortId,
                kind,
                from,
                to,
                actor: actor.actorType,
                actorId: actor.actorId,
                ...(metadata ? { metadata: metadata as never } : {}),
            },
        })
    }
}
