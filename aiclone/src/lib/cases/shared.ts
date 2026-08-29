import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "@/lib/persistence/errors"
import type { PersistedTenancy } from "@/lib/persistence/tenancy"

/**
 * Shared tenancy and composition helpers for the cases engine.
 *
 * TENANCY is workspaceId directly. Unlike the restaurant and appointment domains there is
 * no legacy profileId-scoped table to bridge to, so no second tenant key is invented.
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

export type CaseActor = Readonly<{ actorType: "CLIENT" | "STAFF" | "SYSTEM"; actorId: string | null }>

export type CaseEventKindValue =
    | "CREATED" | "STATUS" | "MILESTONE" | "DELIVERABLE"
    | "DOCUMENT" | "INVOICE" | "TASK" | "APPROVAL" | "NOTE"

type EventWriter = Pick<PrismaClient, "caseEvent">

export class CaseContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    async requireWorkspace(workspaceId: string, permission: "profile.read" | "profile.update"): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        return access.workspaceId
    }

    denied(): never {
        throw new PersistenceError("FORBIDDEN", "Access denied")
    }

    required(value: string | undefined | null, field: string): string {
        const v = value?.trim()
        if (!v) throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
        return v
    }

    /** Loads a case and proves workspace ownership. Refuses identically when absent. */
    async ownedCase(workspaceId: string, caseId: string) {
        const id = this.required(caseId, "caseId")
        const row = await this.db.caseProject.findUnique({ where: { id } })
        if (!row || row.workspaceId !== workspaceId) this.denied()
        return row
    }

    /** A contact may only be associated if it belongs to the same workspace. */
    async assertContact(workspaceId: string, contactId: string | null): Promise<string | null> {
        if (!contactId) return null
        const c = await this.db.contact.findUnique({ where: { id: contactId }, select: { id: true, workspaceId: true } })
        if (!c || c.workspaceId !== workspaceId) this.denied()
        return c.id
    }

    /** The location boundary: a location must belong to the same workspace. */
    async assertLocation(workspaceId: string, locationId: string | null): Promise<string | null> {
        if (!locationId) return null
        const l = await this.db.location.findUnique({ where: { id: locationId }, select: { id: true, workspaceId: true } })
        if (!l || l.workspaceId !== workspaceId) this.denied()
        return l.id
    }

    /** A ProfileDocument reference, reusing the existing upload store. */
    async assertDocument(documentId: string | null): Promise<string | null> {
        if (!documentId) return null
        const d = await this.db.profileDocument.findUnique({ where: { id: documentId }, select: { id: true } })
        if (!d) this.denied()
        return d.id
    }

    async appendEvent(
        tx: EventWriter,
        caseId: string,
        kind: CaseEventKindValue,
        from: string | null,
        to: string,
        actor: CaseActor,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        await tx.caseEvent.create({
            data: {
                caseId,
                kind,
                from,
                to,
                actor: actor.actorType,
                actorId: actor.actorId,
                ...(metadata ? { metadata: metadata as never } : {}),
            },
        })
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
}
