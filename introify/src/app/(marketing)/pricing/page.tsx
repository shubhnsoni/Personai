import { MarketingShell } from "@/components/marketing/marketing-shell"
import { PlanComparison } from "@/components/billing/plan-comparison"
import { PlanFeatureMatrix } from "@/components/billing/plan-feature-matrix"
import { AiCreditGuide, PricingFaq, PublicCreditPacks } from "@/components/billing/pricing-details"
import { marketingMetadata } from "@/lib/marketing-seo"
import { getPublicBillingAvailability } from "@/lib/billing/config"
import { fill } from "@/lib/ui-locale"
import { getRequestLocale } from "@/lib/ui-locale-request"
import { messagesFor } from "@/lib/ui-messages"

export const metadata = marketingMetadata({
    title: "Plans & pricing — start free, grow your business",
    description: "Compare Introify plans for business pages, bookings, custom branding, AI assistants, analytics and teams. Start free or choose paid plans from $10/month.",
    path: "/pricing",
})

export default async function PricingPage() {
    const locale = await getRequestLocale()
    const copy = messagesFor(locale).pricing
    const availability = getPublicBillingAvailability()
    return <MarketingShell locale={locale}><main id="main-content" className="billing-design billing-page"><div className="billing-container">
        <header className="billing-page-heading"><p className="billing-eyebrow">{copy.pageEyebrow}</p><h1>{copy.pageTitle}<br /><em>{copy.pageTitleEm}</em></h1><p>{copy.pageLead}</p></header>
        <PlanComparison billingAvailable={availability.billing} locale={locale} />
        <p className="plan-footnote">{fill(copy.status, { ai: availability.ai ? copy.available : copy.notAvailable, photoreal: availability.photoreal ? copy.availableEligible : copy.notAvailable })}</p>
        <PlanFeatureMatrix locale={locale} />
        <AiCreditGuide locale={locale} />
        <PublicCreditPacks locale={locale} />
        <PricingFaq locale={locale} />
    </div></main></MarketingShell>
}
