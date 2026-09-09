/** Preserve the original UTC anniversary, including Jan 31 and leap-day anchors. */
export function anniversary(anchor: Date, months: number): Date {
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()))
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    first.setUTCDate(Math.min(anchor.getUTCDate(), lastDay))
    return first
}

export function allowanceWindow(anchor: Date, now: Date, paidThrough?: Date | null) {
    let months = Math.max(0, (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth())
    if (anniversary(anchor, months) > now) months = Math.max(0, months - 1)
    const start = anniversary(anchor, months)
    const next = anniversary(anchor, months + 1)
    return { start, end: paidThrough && paidThrough < next ? paidThrough : next }
}

export function effectivePaidPlan(subscription: { planId: string; status: string; paidThrough: Date | null } | null, now: Date) {
    return Boolean(subscription && subscription.planId !== "free" && subscription.paidThrough && subscription.paidThrough > now && ["ACTIVE", "CANCELED", "PAST_DUE"].includes(subscription.status))
}
