export function isAdminEmail(email: string | null | undefined) {
    const raw = process.env.ADMIN_EMAILS || ""
    const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (!email || allow.length === 0) return false
    return allow.includes(email.trim().toLowerCase())
}

export function userIsAdmin(user: { role?: string | null; email?: string | null } | null | undefined) {
    if (!user) return false
    return user.role === "ADMIN" || isAdminEmail(user.email)
}

export function demoteBlockReason(input: {
    actorId: string
    target: { id: string; email: string; role: string }
    adminCount: number
}) {
    if (isAdminEmail(input.target.email)) return "This email is in ADMIN_EMAILS"
    if (input.target.id === input.actorId) return "You cannot demote yourself"
    if (input.target.role === "ADMIN" && input.adminCount <= 1) return "Need at least one admin"
    return null
}
