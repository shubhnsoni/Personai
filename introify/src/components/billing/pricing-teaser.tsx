import Link from "@/components/navigation/transition-link"
import { ArrowUpRight } from "lucide-react"
import { PlanComparison } from "./plan-comparison"
import { getPublicBillingAvailability } from "@/lib/billing/config"

export function PricingTeaser() {
    return <section className="billing-design billing-teaser" id="plans" aria-labelledby="home-plans-title"><div className="billing-container"><div className="billing-section-heading"><div><p className="billing-eyebrow">START SMALL. MAKE ROOM FOR MORE.</p><h2 id="home-plans-title">A good beginning.<br />A plan for what’s next.</h2></div><Link href="/pricing">Compare every detail <ArrowUpRight size={17} aria-hidden="true" /></Link></div><PlanComparison compact billingAvailable={getPublicBillingAvailability().billing} /><p className="plan-footnote">Start with a Free account. Your billing dashboard shows the current availability of paid checkout, AI and 3D generation.</p></div></section>
}
