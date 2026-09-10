import Link from "@/components/navigation/transition-link"
import { ArrowUpRight } from "lucide-react"
import { PlanComparison } from "./plan-comparison"
import { getPublicBillingAvailability } from "@/lib/billing/config"
import type { UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

export function PricingTeaser({ locale = "en" }: { locale?: UiLocale }) {
    const copy = messagesFor(locale).pricing
    return <section className="billing-design billing-teaser" id="plans" aria-labelledby="home-plans-title"><div className="billing-container"><div className="billing-section-heading"><div><p className="billing-eyebrow">{copy.teaserEyebrow}</p><h2 id="home-plans-title">{copy.teaserTitle}<br />{copy.teaserTitle2}</h2></div><Link href="/pricing">{copy.compare} <ArrowUpRight size={17} aria-hidden="true" /></Link></div><PlanComparison compact billingAvailable={getPublicBillingAvailability().billing} locale={locale} /><p className="plan-footnote">{copy.teaserFoot}</p></div></section>
}
