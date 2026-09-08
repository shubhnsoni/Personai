/**
 * Foundation module — shared primitive types.
 *
 * These types are intentionally decoupled from `@prisma/client`. Adapters map
 * Prisma rows onto these shapes; nothing here depends on the schema, so the
 * contracts can be exercised in-memory without a database (see
 * `scripts/one-off/check-foundation-contracts.ts`).
 */

/** Where a piece of identity or activity data originated. Maps 1:1 to an existing table this wave reads from. */
export type ContactSourceKind = "PROFILE_USER" | "BOOKING_GUEST" | "ORDER_GUEST" | "CONVERSATION_VISITOR" | "COURSE_ENROLLMENT" | "MEMBER"

/** A raw mention of a contact as seen in one existing source row, before merge. */
export interface ContactSourceRecord {
    /** Stable id of the row this mention came from (e.g. Booking.id, Order.id). */
    sourceId: string
    sourceKind: ContactSourceKind
    /** The tenant/profile this row belongs to, when the source is profile-scoped. Null for global rows (e.g. Member). */
    profileId: string | null
    name: string | null
    email: string | null
    phone: string | null
    /** When this source row was first created — used for merge tie-breaking and activity ordering fallback. */
    observedAt: Date
}

export type IdentityConfidence = "CONFIRMED" | "PROBABLE" | "AMBIGUOUS" | "ANONYMOUS"

/** The resolved, deduplicated identity produced by merging one or more ContactSourceRecords. */
export interface ResolvedContact {
    /** Deterministic id derived from the merge key — stable across re-runs given the same inputs. */
    contactId: string
    profileId: string | null
    displayName: string | null
    email: string | null
    phone: string | null
    confidence: IdentityConfidence
    /** Every source row folded into this contact, in the order they were merged. */
    sources: ContactSourceRecord[]
    /** Present only when confidence is AMBIGUOUS: the reason resolution could not fully collapse the sources. */
    ambiguityReason: string | null
}

export type ActivityEventType =
    | "BOOKING_CREATED"
    | "BOOKING_STATUS_CHANGED"
    | "ORDER_PLACED"
    | "ORDER_STATUS_CHANGED"
    | "CONVERSATION_MESSAGE"
    | "COURSE_ENROLLED"
    | "COURSE_COMPLETED"

/** A single append-only, source-agnostic activity entry, projected read-only from an existing row. */
export interface ActivityEvent {
    /** Stable id: `${sourceKind}:${sourceId}` — see ActivityTimeline ordering rules for why this matters for ties. */
    id: string
    contactId: string
    profileId: string | null
    type: ActivityEventType
    sourceKind: ContactSourceKind
    sourceId: string
    /** May be null when the underlying row has no timestamp; ordering rule below defines the fallback. */
    occurredAt: Date | null
    summary: string
    metadata: Record<string, unknown>
}
