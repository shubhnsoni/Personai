/**
 * fieldJobs tenancy, refusals and event writing (Wave G4).
 *
 * Mirrors CohortContext exactly, because fieldJobs shares its tenant key: profileId, bridged from
 * Workspace.profileId. That is forced rather than chosen - a technician is an AppointmentResource,
 * which is profile-scoped, so the whole domain has to be.
 *
 * NON-ENUMERATION: `denied()` is the single refusal for both foreign and nonexistent rows, so this
 * surface cannot be used to discover that a job, request or technician exists. 404 is never
 * produced.
 *
 * The tenancy check itself is not reimplemented here. PersistedTenancy.requireAccess does the
 * signed-in, provisioned, member and permission work; this class only bridges its answer to a
 * profileId and holds the domain's resolve-then-authorize helpers.
 */
import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../persistence/errors"
import type { PersistedTenancy } from "../persistence/tenancy"

export const UNIQUE_VIOLATION = "23505"

export function pgCode(error: unknown): string | null {
    const m = error instanceof Error ? error.message : String(error)
    if (/Code: `23505`/.test(m) || /Unique constraint failed/i.test(m)) return UNIQUE_VIOLATION
    return null
}

/**
 * CUSTOMER and TECHNICIAN are both real actors here, unlike in the cases domain. A technician
 * accepting a job card is a different fact from an office staffer accepting it on their behalf,
 * and the job history is where that distinction has to survive.
 */
export type FieldJobActor = Readonly<{
    actorType: "CUSTOMER" | "TECHNICIAN" | "STAFF" | "SYSTEM"
    actorId: string | null
}>

export type FieldJobEventKindValue = "CREATED" | "STATUS" | "ASSIGNMENT" | "SCHEDULE" | "ESTIMATE" | "NOTE"

type EventWriter = Pick<PrismaClient, "fieldJobEvent">

export class FieldJobContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /**
     * Resolves the caller's workspace to the profileId that owns the technicians and offerings.
     * A workspace with no linked profile has no technicians, so it cannot have field jobs.
     */
    async requireProfile(workspaceId: string, permission: "profile.read" | "profile.update"): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a profile that owns field work")
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

    rethrowUnique(error: unknown, message: string): never {
        if (error instanceof PersistenceError) throw error
        if (pgCode(error) === UNIQUE_VIOLATION) throw new PersistenceError("CONFLICT", message)
        throw error
    }

    async ownedRequest(profileId: string, requestId: string) {
        const id = this.required(requestId, "requestId")
        const row = await this.db.fieldJobRequest.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    async ownedJob(profileId: string, jobId: string) {
        const id = this.required(jobId, "jobId")
        const row = await this.db.fieldJob.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    /**
     * A technician may only be used if the caller's profile owns them. The database enforces this
     * independently by trigger, because the engine is not the only possible writer.
     */
    async ownedResource(profileId: string, resourceId: string) {
        const id = this.required(resourceId, "resourceId")
        const row = await this.db.appointmentResource.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.denied()
        return row
    }

    async assertOffering(profileId: string, serviceOfferingId: string | null): Promise<string | null> {
        if (!serviceOfferingId) return null
        const id = serviceOfferingId.trim()
        if (!id) return null
        const row = await this.db.serviceOffering.findUnique({ where: { id }, select: { id: true, profileId: true } })
        if (!row || row.profileId !== profileId) this.denied()
        return row.id
    }

    /** A Location belongs to a workspace, which belongs to a profile - checked through the join. */
    async assertLocation(profileId: string, locationId: string | null): Promise<string | null> {
        if (!locationId) return null
        const id = locationId.trim()
        if (!id) return null
        const row = await this.db.location.findUnique({
            where: { id },
            select: { id: true, workspace: { select: { profileId: true } } },
        })
        if (!row || row.workspace.profileId !== profileId) this.denied()
        return row.id
    }

    async appendEvent(
        tx: EventWriter,
        jobId: string,
        kind: FieldJobEventKindValue,
        subjectType: string,
        subjectId: string,
        from: string | null,
        to: string,
        actor: FieldJobActor,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        await tx.fieldJobEvent.create({
            data: {
                jobId,
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
