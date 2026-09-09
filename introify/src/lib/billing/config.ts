import { getAiAvailability } from "@/lib/ai-runtime"
import { marketingBusiness } from "@/lib/marketing-business"

function usable(value: string | undefined) {
    return Boolean(value && value.trim().length > 12 && !/placeholder|your[_-]|dummy|replace[_-]/i.test(value))
}

export function billingMode(): "live" | "test" {
    return process.env.INTROIFY_BILLING_MODE === "live" ? "live" : "test"
}

export function platformCheckoutAvailable() {
    const mode = billingMode()
    if (process.env.INTROIFY_BILLING_ENABLED !== "true") return false
    if (process.env.INTROIFY_WORKER_ENABLED !== "true") return false
    if (process.env.NODE_ENV === "production" && mode !== "live") return false
    if (!process.env.STRIPE_SECRET_KEY?.startsWith(`sk_${mode}_`) || !usable(process.env.STRIPE_SECRET_KEY)) return false
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith(`pk_${mode}_`)) return false
    if (!usable(process.env.INTROIFY_STRIPE_WEBHOOK_SECRET)) return false
    return Boolean(marketingBusiness.policiesApproved && marketingBusiness.operatorName && marketingBusiness.businessAddress && marketingBusiness.supportEmail && marketingBusiness.refundWindow)
}

export function photorealAvailable() {
    return process.env.INTROIFY_PHOTOREAL_ENABLED === "true" && usable(process.env.MESHY_API_KEY) && process.env.INTROIFY_WORKER_ENABLED === "true"
}

export function getPublicBillingAvailability() {
    const ai = getAiAvailability().fast
    return { billing: platformCheckoutAvailable(), ai, photoreal: photorealAvailable() }
}

export function requirePlatformCheckout() {
    if (!platformCheckoutAvailable()) throw new Error("Paid checkout is not available yet. Your current plan remains available.")
}
