import { platformCheckoutAvailable } from "@/lib/billing/config"

export const PLATFORM_JOB_FEE_BPS = 1500

export function splitJobPrice(priceCents: number) {
    if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error("Price must be a whole number of paise or cents.")
    const feeCents = Math.round((priceCents * PLATFORM_JOB_FEE_BPS) / 10_000)
    return { priceCents, feeCents, creatorCents: priceCents - feeCents }
}

export function jobCheckoutOpen() {
    return platformCheckoutAvailable()
}

export function hireLanguage() {
    return "Hire this AI to run a job. You are purchasing the work, not owning the AI."
}

export function trialAllowsMessage(trialKind: string, used: number) {
    if (trialKind === "NONE") return false
    if (trialKind === "SAMPLE") return used < 1
    return used < 3
}

export function canReviewOrder(order: { status: string; buyerProfileId: string | null }, buyerProfileId: string | null) {
    return Boolean(buyerProfileId && order.buyerProfileId === buyerProfileId && order.status === "completed")
}

export function orderResolution(status: string): "refund" | "keep" | "wait" {
    if (status === "failed" || status === "cancelled") return "refund"
    if (status === "completed") return "keep"
    return "wait"
}

export function maturityLabel(completedJobs: number) {
    if (completedJobs >= 1500) return "Highly proven"
    if (completedJobs >= 250) return "Expert"
    if (completedJobs >= 40) return "Experienced"
    if (completedJobs >= 5) return "Established"
    return "New"
}

export function formatInr(cents: number) {
    return `₹${(cents / 100).toLocaleString("en-IN")}`
}
