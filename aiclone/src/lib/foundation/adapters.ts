/**
 * Read-only adapters: map existing Prisma rows onto the foundation contracts
 * (`ContactSourceRecord`, `ActivityEvent`). No adapter here performs a write,
 * a schema change, or a duplicate of an existing model — each function is a
 * pure projection over row shapes already produced by `prisma.<model>.findMany`.
 *
 * Row types below are intentionally narrow (only the fields each adapter
 * reads), so callers can `select` just those columns from Prisma without
 * this module importing `@prisma/client` generated types directly. This
 * keeps the module compilable/testable without a live Prisma client.
 */

import type { ActivityEvent, ContactSourceRecord } from "./types"

// ---------------------------------------------------------------------------
// Booking (guest identity + activity)
// ---------------------------------------------------------------------------

export interface BookingRow {
    id: string
    profileId: string
    visitorName: string
    visitorEmail: string
    status: string
    createdAt: Date
    updatedAt: Date
}

export function bookingToContactSource(row: BookingRow): ContactSourceRecord {
    return {
        sourceId: row.id,
        sourceKind: "BOOKING_GUEST",
        profileId: row.profileId,
        name: row.visitorName || null,
        email: row.visitorEmail || null,
        phone: null,
        observedAt: row.createdAt,
    }
}

export function bookingToActivityEvents(row: BookingRow, contactId: string): ActivityEvent[] {
    const created: ActivityEvent = {
        id: `BOOKING_GUEST:${row.id}:created`,
        contactId,
        profileId: row.profileId,
        type: "BOOKING_CREATED",
        sourceKind: "BOOKING_GUEST",
        sourceId: row.id,
        occurredAt: row.createdAt,
        summary: `Booking created (status ${row.status})`,
        metadata: { status: row.status },
    }
    if (row.updatedAt.getTime() === row.createdAt.getTime()) return [created]
    return [
        created,
        {
            id: `BOOKING_GUEST:${row.id}:updated`,
            contactId,
            profileId: row.profileId,
            type: "BOOKING_STATUS_CHANGED",
            sourceKind: "BOOKING_GUEST",
            sourceId: row.id,
            occurredAt: row.updatedAt,
            summary: `Booking status is now ${row.status}`,
            metadata: { status: row.status },
        },
    ]
}

// ---------------------------------------------------------------------------
// Order (restaurant order guest identity + activity)
// ---------------------------------------------------------------------------

export interface OrderRow {
    id: string
    profileId: string
    guestName: string | null
    guestEmail: string | null
    guestPhone: string | null
    status: string
    placedAt: Date
    servedAt: Date | null
    cancelledAt: Date | null
}

export function orderToContactSource(row: OrderRow): ContactSourceRecord | null {
    if (!row.guestEmail && !row.guestPhone) return null
    return {
        sourceId: row.id,
        sourceKind: "ORDER_GUEST",
        profileId: row.profileId,
        name: row.guestName,
        email: row.guestEmail,
        phone: row.guestPhone,
        observedAt: row.placedAt,
    }
}

export function orderToActivityEvents(row: OrderRow, contactId: string): ActivityEvent[] {
    const events: ActivityEvent[] = [
        {
            id: `ORDER_GUEST:${row.id}:placed`,
            contactId,
            profileId: row.profileId,
            type: "ORDER_PLACED",
            sourceKind: "ORDER_GUEST",
            sourceId: row.id,
            occurredAt: row.placedAt,
            summary: `Order placed (status ${row.status})`,
            metadata: { status: row.status },
        },
    ]
    const terminalAt = row.servedAt ?? row.cancelledAt
    if (terminalAt) {
        events.push({
            id: `ORDER_GUEST:${row.id}:${row.status.toLowerCase()}`,
            contactId,
            profileId: row.profileId,
            type: "ORDER_STATUS_CHANGED",
            sourceKind: "ORDER_GUEST",
            sourceId: row.id,
            occurredAt: terminalAt,
            summary: `Order status is now ${row.status}`,
            metadata: { status: row.status },
        })
    }
    return events
}

// ---------------------------------------------------------------------------
// Conversation (visitor identity + message activity)
// ---------------------------------------------------------------------------

export interface ConversationRow {
    id: string
    profileId: string
    visitorName: string | null
    visitorEmail: string | null
    startedAt: Date
    lastMessageAt: Date
}

export function conversationToContactSource(row: ConversationRow): ContactSourceRecord | null {
    if (!row.visitorEmail) return null
    return {
        sourceId: row.id,
        sourceKind: "CONVERSATION_VISITOR",
        profileId: row.profileId,
        name: row.visitorName,
        email: row.visitorEmail,
        phone: null,
        observedAt: row.startedAt,
    }
}

export function conversationToActivityEvent(row: ConversationRow, contactId: string): ActivityEvent {
    return {
        id: `CONVERSATION_VISITOR:${row.id}:last-message`,
        contactId,
        profileId: row.profileId,
        type: "CONVERSATION_MESSAGE",
        sourceKind: "CONVERSATION_VISITOR",
        sourceId: row.id,
        occurredAt: row.lastMessageAt,
        summary: "Conversation activity",
        metadata: {},
    }
}

// ---------------------------------------------------------------------------
// CourseEnrollment (learner identity + progress activity)
// ---------------------------------------------------------------------------

export interface CourseEnrollmentRow {
    id: string
    courseId: string
    profileId: string | null
    visitorName: string | null
    visitorEmail: string
    status: string
    enrolledAt: Date
    completedAt: Date | null
}

export function courseEnrollmentToContactSource(row: CourseEnrollmentRow): ContactSourceRecord {
    return {
        sourceId: row.id,
        sourceKind: "COURSE_ENROLLMENT",
        profileId: row.profileId,
        name: row.visitorName,
        email: row.visitorEmail,
        phone: null,
        observedAt: row.enrolledAt,
    }
}

export function courseEnrollmentToActivityEvents(row: CourseEnrollmentRow, contactId: string): ActivityEvent[] {
    const events: ActivityEvent[] = [
        {
            id: `COURSE_ENROLLMENT:${row.id}:enrolled`,
            contactId,
            profileId: row.profileId,
            type: "COURSE_ENROLLED",
            sourceKind: "COURSE_ENROLLMENT",
            sourceId: row.id,
            occurredAt: row.enrolledAt,
            summary: `Enrolled in course ${row.courseId}`,
            metadata: { courseId: row.courseId, status: row.status },
        },
    ]
    if (row.completedAt) {
        events.push({
            id: `COURSE_ENROLLMENT:${row.id}:completed`,
            contactId,
            profileId: row.profileId,
            type: "COURSE_COMPLETED",
            sourceKind: "COURSE_ENROLLMENT",
            sourceId: row.id,
            occurredAt: row.completedAt,
            summary: `Completed course ${row.courseId}`,
            metadata: { courseId: row.courseId },
        })
    }
    return events
}

// ---------------------------------------------------------------------------
// Profile/User (the owning creator's own identity — not a "contact" in the CRM
// sense, but included so the identity graph can resolve a Profile owner who
// also appears as e.g. a Member elsewhere without double-counting).
// ---------------------------------------------------------------------------

export interface ProfileOwnerRow {
    profileId: string
    userEmail: string | null
    displayName: string
    createdAt: Date
}

export function profileOwnerToContactSource(row: ProfileOwnerRow): ContactSourceRecord | null {
    if (!row.userEmail) return null
    return {
        sourceId: row.profileId,
        sourceKind: "PROFILE_USER",
        profileId: row.profileId,
        name: row.displayName,
        email: row.userEmail,
        phone: null,
        observedAt: row.createdAt,
    }
}
