import type { BillingCadence, PlanId } from "./catalog"

export type BillingDashboard = {
    accounts: { id: string; name: string; planId: PlanId }[]
    selectedAccountId: string
    accountName: string
    role: string
    canManageBilling: boolean
    planId: PlanId
    cadence: BillingCadence
    status: string
    paidThrough: string | null
    cancelAtPeriodEnd: boolean
    pendingPlanId?: PlanId | null
    balances: {
        ai: { monthly: number; purchased: number; reserved: number }
        photoreal: { monthly: number; purchased: number; reserved: number; trial: number }
    }
    usage: { businesses: number; seats: number; offerings: number; knowledgeSources: number; knowledgeCharacters: number; storageBytes: number }
    availability: { billing: boolean; ai: boolean; photoreal: boolean }
    portalAvailable: boolean
    invoices?: { id: string; amountCents: number; currency: string; status: string; createdAt: string; url: string | null }[]
}

export type BillingActionResult = { url?: string; error?: string; success?: boolean; message?: string }
