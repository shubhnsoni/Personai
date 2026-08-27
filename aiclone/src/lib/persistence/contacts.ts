import type { PrismaClient } from "@prisma/client"

import { resolveContacts, type ContactSourceRecord, type ResolvedContact } from "@/lib/foundation"

import { PersistenceError } from "./errors"

export type PersistedContact = Readonly<{
    id: string
    workspaceId: string
    profileId: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    confidence: string
    sources: readonly Readonly<{
        sourceKind: string
        sourceId: string
        profileId: string | null
        observedAt: Date
    }>[]
    createdAt: Date
    updatedAt: Date
}>

function storageContactId(workspaceId: string, contactId: string): string {
    return `workspace:${workspaceId}:${contactId}`
}

function toPersistedContact(row: {
    id: string
    workspaceId: string | null
    profileId: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    confidence: string
    createdAt: Date
    updatedAt: Date
    sourceLinks: readonly {
        sourceKind: string
        sourceId: string
        profileId: string | null
        observedAt: Date
    }[]
}): PersistedContact {
    if (!row.workspaceId) throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Persisted contact has no workspace")
    return Object.freeze({
        id: row.id,
        workspaceId: row.workspaceId,
        profileId: row.profileId,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        confidence: row.confidence,
        sources: Object.freeze(row.sourceLinks.map((source) => Object.freeze({ ...source }))),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    })
}

export class PersistedContacts {
    constructor(private readonly db: PrismaClient) {}

    async list(workspaceId: string): Promise<readonly PersistedContact[]> {
        const rows = await this.db.contact.findMany({
            where: { workspaceId },
            include: { sourceLinks: { orderBy: [{ observedAt: "asc" }, { sourceId: "asc" }] } },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        })
        return rows.map(toPersistedContact)
    }

    async ingest(workspaceId: string, source: ContactSourceRecord): Promise<PersistedContact> {
        const workspace = await this.db.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true, profileId: true },
        })
        if (!workspace) throw new PersistenceError("NOT_FOUND", "Workspace not found")
        if (source.profileId && source.profileId !== workspace.profileId) {
            throw new PersistenceError("FORBIDDEN", "Contact source does not belong to this workspace")
        }

        const resolved = resolveContacts([source])[0]
        if (!resolved) throw new PersistenceError("BAD_REQUEST", "A contact source is required")
        const id = storageContactId(workspaceId, resolved.contactId)

        return this.db.$transaction(async (tx) => {
            const linked = await tx.contactSourceLink.findUnique({
                where: { sourceKind_sourceId: { sourceKind: source.sourceKind, sourceId: source.sourceId } },
                include: { contact: { select: { workspaceId: true } } },
            })
            if (linked?.contact.workspaceId && linked.contact.workspaceId !== workspaceId) {
                throw new PersistenceError("FORBIDDEN", "Contact source belongs to another workspace")
            }

            await tx.contact.upsert({
                where: { id },
                create: this.contactWrite(id, workspaceId, resolved),
                update: this.contactWrite(id, workspaceId, resolved),
            })
            await tx.contactSourceLink.upsert({
                where: { sourceKind_sourceId: { sourceKind: source.sourceKind, sourceId: source.sourceId } },
                create: {
                    contactId: id,
                    sourceKind: source.sourceKind,
                    sourceId: source.sourceId,
                    profileId: source.profileId,
                    observedAt: source.observedAt,
                },
                update: {
                    contactId: id,
                    profileId: source.profileId,
                    observedAt: source.observedAt,
                },
            })

            const persisted = await tx.contact.findUnique({
                where: { id },
                include: { sourceLinks: { orderBy: [{ observedAt: "asc" }, { sourceId: "asc" }] } },
            })
            if (!persisted || persisted.workspaceId !== workspaceId) {
                throw new PersistenceError("DEPENDENCY_UNAVAILABLE", "Persisted contact could not be read back")
            }
            return toPersistedContact(persisted)
        })
    }

    private contactWrite(id: string, workspaceId: string, resolved: ResolvedContact) {
        return {
            id,
            workspaceId,
            profileId: resolved.profileId,
            displayName: resolved.displayName,
            email: resolved.email,
            phone: resolved.phone,
            confidence: resolved.confidence,
        }
    }
}
