/**
 * Activity timeline — append-only, source-agnostic activity events.
 *
 * ORDERING RULE (must be total — every pair of events must have a defined order):
 *   1. Primary: `occurredAt` ascending (oldest first) when both events have a timestamp.
 *   2. Missing timestamps: an event with `occurredAt === null` sorts AFTER every event
 *      that has a timestamp (unknown-time events are treated as "most recent, but
 *      unconfirmed" rather than arbitrarily backdated to epoch — backdating them would
 *      silently misplace them earlier than events we know came first).
 *   3. Ties (equal `occurredAt`, including two nulls): broken by `id` ascending
 *      (lexicographic). `id` is `${sourceKind}:${sourceId}`, which is stable and
 *      deterministic per source row, so tie order never depends on array input order,
 *      insertion order, or any Prisma default `orderBy`.
 *
 * "Append-only" here is a projection guarantee, not a storage guarantee: this module
 * builds an in-memory ordered view from adapter output on every call. It never accepts
 * a mutation of an existing ActivityEvent — the only supported operation on a timeline
 * is appending more source rows and re-deriving the sorted view.
 */

import type { ActivityEvent } from "./types"

export function compareActivityEvents(a: ActivityEvent, b: ActivityEvent): number {
    if (a.occurredAt === null && b.occurredAt !== null) return 1
    if (a.occurredAt !== null && b.occurredAt === null) return -1
    if (a.occurredAt !== null && b.occurredAt !== null) {
        const diff = a.occurredAt.getTime() - b.occurredAt.getTime()
        if (diff !== 0) return diff
    }
    return a.id.localeCompare(b.id)
}

export class ActivityTimeline {
    private readonly events: ActivityEvent[] = []
    private readonly seenIds = new Set<string>()

    /** Appends events. Duplicate ids (same sourceKind+sourceId re-projected) are ignored — idempotent append. */
    append(newEvents: readonly ActivityEvent[]): void {
        for (const event of newEvents) {
            if (this.seenIds.has(event.id)) continue
            this.seenIds.add(event.id)
            this.events.push(event)
        }
    }

    /** Returns all events for one contact in stable sorted order (oldest first). */
    forContact(contactId: string): ActivityEvent[] {
        return this.events.filter((e) => e.contactId === contactId).sort(compareActivityEvents)
    }

    /** Returns every event across all contacts in stable sorted order. */
    all(): ActivityEvent[] {
        return [...this.events].sort(compareActivityEvents)
    }

    size(): number {
        return this.events.length
    }
}
