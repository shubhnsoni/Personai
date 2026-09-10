import { Check, ChevronDown } from "lucide-react"
import { AI_MODES, PUBLIC_PLANS, type Plan } from "@/lib/billing/catalog"
import { storageSize } from "./format"
import { fill, type UiLocale } from "@/lib/ui-locale"
import { messagesFor } from "@/lib/ui-messages"

type FeatureRow = {
    label: string
    note?: string
    value: (plan: Plan) => string | boolean
}

function FeatureValue({ value, included, notIncluded }: { value: string | boolean; included: string; notIncluded: string }) {
    if (typeof value === "string") return <span>{value}</span>
    return <>{value ? <Check size={18} aria-hidden="true" /> : <span aria-hidden="true">—</span>}<span className="sr-only">{value ? included : notIncluded}</span></>
}

export function PlanFeatureMatrix({ locale = "en" }: { locale?: UiLocale }) {
    const copy = messagesFor(locale).pricing.matrix
    const number = (value: number) => value.toLocaleString(locale === "hi" ? "hi-IN" : "en-US")
    const groups: { label: string; rows: FeatureRow[] }[] = [
        {
            label: copy.groups.page,
            rows: [
                { label: copy.rows.shareable, value: () => true },
                { label: copy.rows.identity, value: () => true },
                {
                    label: copy.rows.offerings,
                    note: copy.rows.offeringsNote,
                    value: plan => number(plan.limits.offerings),
                },
                { label: copy.rows.enquiry, value: () => true },
                {
                    label: copy.rows.booking,
                    note: copy.rows.bookingNote,
                    value: () => true,
                },
            ],
        },
        {
            label: copy.groups.brand,
            rows: [
                { label: copy.rows.customOrb, value: plan => plan.features.customBranding },
                { label: copy.rows.removeFooter, value: plan => plan.features.customBranding },
                { label: copy.rows.instructions, value: plan => plan.features.customInstructions },
                {
                    label: copy.rows.autoNotes,
                    note: copy.rows.autoNotesNote,
                    value: plan => plan.features.autoMemory,
                },
                { label: copy.rows.knowledge, value: plan => number(plan.limits.knowledgeSources) },
                { label: copy.rows.knowledgeText, note: copy.rows.knowledgeTextNote, value: plan => fill(copy.rows.characters, { n: number(plan.limits.knowledgeCharacters) }) },
                { label: copy.rows.aiModes, value: plan => plan.aiModes.map(mode => AI_MODES[mode].name).join(" · ") },
                { label: copy.rows.aiCredits, value: plan => number(plan.aiCredits) },
                {
                    label: copy.rows.photoreal,
                    note: copy.rows.photorealNote,
                    value: plan => plan.id === "free" ? fill(copy.rows.lifetimeTrial, { n: number(plan.freeTrialGenerations) }) : fill(copy.rows.perMonth, { n: number(plan.photorealGenerations) }),
                },
            ],
        },
        {
            label: copy.groups.insights,
            rows: [
                { label: copy.rows.activity, value: () => true },
                {
                    label: copy.rows.trends,
                    note: copy.rows.trendsNote,
                    value: plan => plan.features.advancedAnalytics,
                },
                { label: copy.rows.businesses, value: plan => number(plan.limits.businesses) },
                { label: copy.rows.seats, note: copy.rows.seatsNote, value: plan => number(plan.limits.seats) },
                {
                    label: copy.rows.roles,
                    note: copy.rows.rolesNote,
                    value: plan => plan.features.team,
                },
            ],
        },
        {
            label: copy.groups.storage,
            rows: [
                { label: copy.rows.storage, note: copy.rows.storageNote, value: plan => storageSize(plan.limits.storageBytes) },
            ],
        },
    ]
    const creditLine = Object.values(AI_MODES).map(mode => fill(copy.creditUnit, {
        n: number(mode.credits),
        unit: mode.credits === 1 ? copy.credit : copy.credits,
        name: mode.name,
    })).join(", ")
    return <section className="billing-section billing-feature-comparison" aria-label="Detailed plan comparison">
        <div className="billing-section-heading">
            <div><p className="billing-eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2></div>
            <p>{copy.lead}</p>
        </div>
        <details className="billing-feature-disclosure">
            <summary><span>{copy.compare}</span><ChevronDown size={19} aria-hidden="true" /></summary>
            <p className="plan-footnote">{copy.shared}</p>
            <p className="plan-comparison-hint">{copy.hint}</p>
            <div className="billing-comparison-scroll" role="region" aria-label={copy.region} tabIndex={0}>
                <table className="plan-feature-table">
                    <caption className="sr-only">{copy.caption}</caption>
                    <thead><tr><th scope="col">{copy.feature}</th>{PUBLIC_PLANS.map(plan => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead>
                    {groups.map(group => <tbody key={group.label}>
                        <tr className="plan-feature-group"><th scope="rowgroup" colSpan={PUBLIC_PLANS.length + 1}>{group.label}</th></tr>
                        {group.rows.map(row => <tr key={row.label}>
                            <th scope="row"><span>{row.label}</span>{row.note && <small>{row.note}</small>}</th>
                            {PUBLIC_PLANS.map(plan => <td className="plan-feature-value" key={plan.id}><FeatureValue value={row.value(plan)} included={copy.included} notIncluded={copy.notIncluded} /></td>)}
                        </tr>)}
                    </tbody>)}
                </table>
            </div>
            <p className="plan-footnote">{fill(copy.creditsLine, { line: creditLine })}</p>
            <p className="plan-footnote">{copy.entitlements}</p>
        </details>
    </section>
}
