import Link from "@/components/navigation/transition-link"
import { ArrowUpRight, BrainCircuit, Plus, Sparkles, Zap } from "lucide-react"
import { AI_MODES, CREDIT_PACKS } from "@/lib/billing/catalog"
import { dollars } from "./format"
import { type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

export function AiCreditGuide({ locale = "en" }: { locale?: UiLocale }) {
    const copy = messagesFor(locale).pricing.ai
    const icons = { fast: Zap, smart: Sparkles, reasoning: BrainCircuit }
    const availability = { fast: copy.fastAvail, smart: copy.smartAvail, reasoning: copy.reasoningAvail }
    const descriptions = { fast: copy.fast, smart: copy.smart, reasoning: copy.reasoning }
    return <section className="billing-section" aria-labelledby="ai-credit-guide"><div className="billing-section-heading"><div><p className="billing-eyebrow">{copy.eyebrow}</p><h2 id="ai-credit-guide">{copy.title}</h2></div><p>{copy.lead}</p></div><div className="billing-model-grid">{Object.values(AI_MODES).map(mode => {
        const Icon = icons[mode.id]
        return <article className="billing-model" key={mode.id}><Icon size={25} aria-hidden="true" /><h3>{mode.name}</h3><p>{descriptions[mode.id]}.</p><p><strong>{mode.credits} {mode.credits === 1 ? copy.credit : copy.credits}</strong> {copy.perReplySuffix}</p><small>{availability[mode.id]}</small></article>
    })}</div><p className="plan-footnote">{copy.foot}</p></section>
}

export function PublicCreditPacks({ locale = "en" }: { locale?: UiLocale }) {
    const copy = messagesFor(locale).pricing.packs
    return <section className="billing-section" id="photoreal-3d" aria-labelledby="generation-packs"><div className="billing-section-heading"><div><p className="billing-eyebrow">{copy.eyebrow}</p><h2 id="generation-packs">{copy.title}</h2></div><p>{copy.lead}</p></div><div className="billing-pack-grid">{CREDIT_PACKS.map(pack => <article className="billing-pack" key={pack.id}><h3>{copy.names[pack.id as keyof typeof copy.names]}</h3><div className="billing-pack-price"><strong>{dollars(pack.priceCents)}</strong><span>{copy.oneTime}</span></div><p>{pack.unit === "AI" ? copy.aiUse : copy.genUse}</p><Link href="/dashboard/billing" className="billing-button billing-button-secondary">{copy.viewBilling} <ArrowUpRight size={15} aria-hidden="true" /></Link></article>)}</div><p className="plan-footnote">{copy.foot}</p></section>
}

export function PricingFaq({ locale = "en" }: { locale?: UiLocale }) {
    const copy = messagesFor(locale).pricing.faq
    return <section className="billing-section" aria-labelledby="pricing-questions"><div className="billing-section-heading"><div><p className="billing-eyebrow">{copy.eyebrow}</p><h2 id="pricing-questions">{copy.title}</h2></div></div><div className="billing-faq">{copy.items.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div><div className="billing-planned"><strong>{copy.roadmap}</strong><p>{copy.roadmapBody}</p></div><nav className="billing-legal" aria-label={copy.legal}><Link href="/terms">{copy.terms}</Link><Link href="/refund-policy">{copy.refunds}</Link><Link href="/privacy">{copy.privacy}</Link><Link href="/contact">{copy.contact}</Link></nav></section>
}
