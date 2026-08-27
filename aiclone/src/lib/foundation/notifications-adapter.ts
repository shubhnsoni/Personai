/**
 * Notification contract + adapter over the existing `Notification` model
 * (see `prisma/schema.prisma`, and the existing helpers in
 * `src/lib/notifications.ts`, which this module does not replace or duplicate
 * — it only adds a read projection shaped for the foundation layer).
 *
 * READ-ONLY: this file performs no writes. Creating/marking-read notifications
 * continues to go through the existing `src/lib/notifications.ts` helpers.
 */

export type NotificationDeliveryState = "UNREAD" | "READ"

export interface NotificationRecord {
    id: string
    userId: string
    type: string
    title: string
    body: string | null
    href: string | null
    state: NotificationDeliveryState
    createdAt: Date
    readAt: Date | null
}

/** Prisma's `Notification` row shape, scoped to the fields this adapter reads. */
export interface NotificationRow {
    id: string
    userId: string
    type: string
    title: string
    body: string | null
    href: string | null
    readAt: Date | null
    createdAt: Date
}

export function projectNotification(row: NotificationRow): NotificationRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type,
        title: row.title,
        body: row.body,
        href: row.href,
        state: row.readAt ? "READ" : "UNREAD",
        createdAt: row.createdAt,
        readAt: row.readAt,
    }
}

export function projectNotifications(rows: readonly NotificationRow[]): NotificationRecord[] {
    return rows.map(projectNotification)
}
