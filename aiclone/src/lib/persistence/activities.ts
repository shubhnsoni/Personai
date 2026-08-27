import type { PrismaClient } from "@prisma/client"

import { compareActivityEvents, type ActivityEvent } from "@/lib/foundation"

import { PersistenceError } from "./errors"

function storageEventId(workspaceId: string, eventId: string): string {
    return `workspace:${workspaceId}:${eventId}`
}

function metadataFromStorage(value: string | null): Record<string, unknown> {
    if (!value) return {}
    try {
        const parsed: unknown = JSON.parse(value)
        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : {}
    } catch {
        return {}
    }
}

function toActivity(row: {
    id: string
    contactId: string
    profileId: string | null
    type: string
    sourceKind: string
    sourceId: string
    occurredAt: Date | null
    summary: string
    metadata: string | null
}): ActivityEvent {
    return {
        id: row.id,
        contactId: row.contactId,
        profileId: row.profileId,
        type: row.type as ActivityEvent["type"],
        sourceKind: row.sourceKind as ActivityEvent["sourceKind"],
        sourceId: row.sourceId,
        occurredAt: row.occurredAt,
        summary: row.summary,
        metadata: metadataFromStorage(row.metadata),
    }
}

export class PersistedActivities {
    constructor(private readonly db: PrismaClient) {}

    async list(workspaceId: string, contactId?: string | null): Promise<readonly ActivityEvent[]> {
        const rows = await this.db.activityEvent.findMany({
            where: {
                contact: { workspaceId },
                ...(contactId ? { contactId } : {}),
            },
            orderBy: [{ occurredAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        })
        return rows.map(toActivity).sort(compareActivityEvents)
    }

    async append(workspaceId: string, events: readonly ActivityEvent[]): Promise<readonly ActivityEvent[]> {
        if (events.length === 0) return Object.freeze([])
        return this.db.$transaction(async (tx) => {
            const persisted: ActivityEvent[] = []
            for (const event of events) {
                const contact = await tx.contact.findFirst({
                    where: { id: event.contactId, workspaceId },
                    select: { id: true, profileId: true },
                })
                if (!contact) throw new PersistenceError("NOT_FOUND", "Contact not found in this workspace")
                if (event.profileId && contact.profileId && event.profileId !== contact.profileId) {
                    throw new PersistenceError("FORBIDDEN", "Activity profile does not match its contact")
                }

                const id = storageEventId(workspaceId, event.id)
                const existing = await tx.activityEvent.findUnique({
                    where: { id },
                    include: { contact: { select: { workspaceId: true } } },
                })
                if (existing) {
                    if (existing.contact.workspaceId !== workspaceId) {
                        throw new PersistenceError("FORBIDDEN", "Activity belongs to another workspace")
                    }
                    persisted.push(toActivity(existing))
                    continue
                }

                const created = await tx.activityEvent.create({
                    data: {
                        id,
                        contactId: event.contactId,
                        profileId: event.profileId,
                        type: event.type,
                        sourceKind: event.sourceKind,
                        sourceId: event.sourceId,
                        occurredAt: event.occurredAt,
                        summary: event.summary,
                        metadata: JSON.stringify(event.metadata),
                    },
                })
                persisted.push(toActivity(created))
            }
            return Object.freeze(persisted.sort(compareActivityEvents))
        })
    }
}
