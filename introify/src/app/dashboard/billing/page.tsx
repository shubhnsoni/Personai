import type { Metadata } from "next"
import { getBillingDashboard } from "@/app/actions/billing"
import { BillingSettings } from "@/components/billing/billing-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Plan & usage | Introify", robots: { index: false, follow: false } }

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ accountId?: string; cadence?: string; checkout?: string }> }) {
    const query = await searchParams
    const data = await getBillingDashboard({ accountId: query.accountId })
    const initialCadence = query.cadence === "yearly" || query.cadence === "monthly" ? query.cadence : undefined
    const checkoutReturn = query.checkout === "success" ? "success" : query.checkout === "cancelled" || query.checkout === "canceled" ? "cancelled" : undefined
    return <BillingSettings key={data.selectedAccountId} data={data} initialCadence={initialCadence} checkoutReturn={checkoutReturn} />
}
