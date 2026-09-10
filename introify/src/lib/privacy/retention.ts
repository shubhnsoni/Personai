export const OPERATIONAL_RETENTION_DAYS = {
    analyticsEvents: 180,
    accounts: null,
    chats: null,
    files: null,
    backups: null,
    logs: 30,
} as const

export type PrivacyRequestKind = "ACCESS" | "CORRECTION" | "DELETION"

export function expiredRecordIds(rows: readonly { id: string; createdAt: Date }[], days: number, now: Date) {
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
    return rows.filter((row) => row.createdAt.getTime() < cutoff).map((row) => row.id)
}

export function privacyRequestRecord(input: {
    email: string
    kind: PrivacyRequestKind
    note?: string
    at: Date
}) {
    return {
        action: "privacy_request",
        kind: input.kind,
        email: input.email.trim().toLowerCase(),
        note: input.note?.trim() || "",
        status: "OPEN" as const,
        owner: null,
        at: input.at.toISOString(),
    }
}
