import { MarketingShell } from "@/components/marketing/marketing-shell"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { AiCreditGuide, PricingFaq, PublicCreditPacks } from "@/components/billing/pricing-details"
import { marketingMetadata } from "@/lib/marketing-seo"
import { getPublicBillingAvailability } from "@/lib/billing/config"

export const metadata = marketingMetadata({
    title: "Plans & pricing — start free, grow your business",
    description: "Compare Introify Free, Starter, Pro, Business and Scale. Clear AI credits, 3D allowances and team limits. Paid plans from $10/month; save 10% annually.",
    path: "/pricing",
})

export default function PricingPage() {
    const availability = getPublicBillingAvailability()
    return <MarketingShell><main id="main-content" className="billing-design billing-page"><div className="billing-container">
        <header className="billing-page-heading"><p className="billing-eyebrow">YOUR NEXT CHAPTER, AT YOUR PACE</p><h1>Start with your story.<br /><em>Grow from there.</em></h1><p>A home for your business, help with the conversation and a new dimension for your products. Start free. Choose more room when you need it.</p></header>
        <PlanComparison billingAvailable={availability.billing} />
        <p className="plan-footnote">Current service status: AI {availability.ai ? "available where enabled on your page" : "not available yet"} · Photoreal 3D {availability.photoreal ? "available for eligible accounts" : "not available yet"}.</p>
        <AiCreditGuide />
        <PublicCreditPacks />
        <PricingFaq />
    </div></main></MarketingShell>
}
