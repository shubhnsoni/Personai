import { MarketingShell } from "@/components/marketing/marketing-shell"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { PlanFeatureMatrix } from "@/components/billing/plan-feature-matrix"
import { AiCreditGuide, PricingFaq, PublicCreditPacks } from "@/components/billing/pricing-details"
import { marketingMetadata } from "@/lib/marketing-seo"
import { getPublicBillingAvailability } from "@/lib/billing/config"

export const metadata = marketingMetadata({
    title: "Plans & pricing — start free, grow your business",
    description: "Compare Introify plans for business pages, bookings, custom branding, AI assistants, analytics and teams. Start free or choose paid plans from $10/month.",
    path: "/pricing",
})

export default function PricingPage() {
    const availability = getPublicBillingAvailability()
    return <MarketingShell><main id="main-content" className="billing-design billing-page"><div className="billing-container">
        <header className="billing-page-heading"><p className="billing-eyebrow">YOUR NEXT CHAPTER, AT YOUR PACE</p><h1>Start with your story.<br /><em>Grow from there.</em></h1><p>Publish your work. Keep enquiries moving. Manage bookings and learn what brings people in. Choose the branding, intelligence and team access your business needs.</p></header>
        <PlanComparison billingAvailable={availability.billing} />
        <p className="plan-footnote">Current service status: AI {availability.ai ? "available where enabled on your page" : "not available yet"} · Photoreal 3D {availability.photoreal ? "available for eligible accounts" : "not available yet"}.</p>
        <PlanFeatureMatrix />
        <AiCreditGuide />
        <PublicCreditPacks />
        <PricingFaq />
    </div></main></MarketingShell>
}
