import { Check, ChevronDown } from "lucide-react"
import { AI_MODES, PLANS, type Plan } from "@/lib/billing/catalog"
import { storageSize } from "./format"

type FeatureRow = {
    label: string
    note?: string
    value: (plan: Plan) => string | boolean
}

const number = (value: number) => value.toLocaleString("en-US")
const groups: { label: string; rows: FeatureRow[] }[] = [
    {
        label: "Your page & day-to-day work",
        rows: [
            { label: "Shareable page, links & QR code", value: () => true },
            { label: "Your business name, photo & logo", value: () => true },
            {
                label: "Published offerings",
                note: "Products, services, courses, events, communities and lead magnets share this total. Drafts do not count.",
                value: plan => number(plan.limits.offerings),
            },
            { label: "Enquiry & lead management", value: () => true },
            {
                label: "Booking forms & availability",
                note: "Set up services and availability where booking tools are enabled. Customer payment methods require separate business setup.",
                value: () => true,
            },
        ],
    },
    {
        label: "Brand & assistant",
        rows: [
            { label: "Custom orb & brand styles", value: plan => plan.features.customBranding },
            { label: "Remove the Introify footer", value: plan => plan.features.customBranding },
            { label: "Custom assistant instructions", value: plan => plan.features.customInstructions },
            {
                label: "Automatic conversation notes",
                note: "Requires the business owner to enable memory and the visitor to consent. Private notes stay within that conversation and count toward knowledge limits.",
                value: plan => plan.features.autoMemory,
            },
            { label: "Knowledge sources", value: plan => number(plan.limits.knowledgeSources) },
            { label: "Knowledge text capacity", note: "Extracted characters across your knowledge sources.", value: plan => `${number(plan.limits.knowledgeCharacters)} characters` },
            { label: "AI modes", value: plan => plan.aiModes.map(mode => AI_MODES[mode].name).join(" · ") },
            { label: "AI credits each month", value: plan => number(plan.aiCredits) },
            {
                label: "Photoreal 3D generations",
                note: "Free includes a lifetime trial per eligible user. Paid plans receive a monthly allowance, including with annual billing.",
                value: plan => plan.id === "free" ? `${number(plan.freeTrialGenerations)} lifetime trial` : `${number(plan.photorealGenerations)} / month`,
            },
        ],
    },
    {
        label: "Insights & teamwork",
        rows: [
            { label: "Basic activity totals", value: () => true },
            {
                label: "30-day trends, traffic sources & funnel",
                note: "Reports for each business, with an aggregate conversion funnel.",
                value: plan => plan.features.advancedAnalytics,
            },
            { label: "Businesses", value: plan => number(plan.limits.businesses) },
            { label: "Team seats", note: "Includes the owner and pending invitations. A person working across your businesses counts once.", value: plan => number(plan.limits.seats) },
            {
                label: "Role-based business access",
                note: "Invite people by a shareable link and assign access to the businesses they work in.",
                value: plan => plan.features.team,
            },
        ],
    },
    {
        label: "Storage",
        rows: [
            { label: "Account storage", note: "Uploaded files and stored 3D models, including their derivatives, count toward this allowance.", value: plan => storageSize(plan.limits.storageBytes) },
        ],
    },
]

function FeatureValue({ value }: { value: string | boolean }) {
    if (typeof value === "string") return <span>{value}</span>
    return <>{value ? <Check size={18} aria-hidden="true" /> : <span aria-hidden="true">—</span>}<span className="sr-only">{value ? "Included" : "Not included"}</span></>
}

export function PlanFeatureMatrix() {
    return <section className="billing-section billing-feature-comparison" aria-label="Detailed plan comparison">
        <div className="billing-section-heading">
            <div><p className="billing-eyebrow">EVERYDAY TOOLS, CLEAR LIMITS</p><h2>The details behind your plan.</h2></div>
            <p>See what stays with you on every plan, what an upgrade unlocks and how much room you have to grow.</p>
        </div>
        <details className="billing-feature-disclosure">
            <summary><span>Compare all features</span><ChevronDown size={19} aria-hidden="true" /></summary>
            <p className="plan-footnote">Limits and usage allowances are shared across the businesses on one billing account. Available tools vary by business type and enabled surfaces. Access also follows each person’s business permissions.</p>
            <p className="plan-comparison-hint">Scroll across to compare plans. Feature names stay in view.</p>
            <div className="billing-comparison-scroll" role="region" aria-label="Scrollable plan feature comparison" tabIndex={0}>
                <table className="plan-feature-table">
                    <caption className="sr-only">Features and limits for the Free, Starter, Pro, Business and Scale plans.</caption>
                    <thead><tr><th scope="col">Feature</th>{PLANS.map(plan => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead>
                    {groups.map(group => <tbody key={group.label}>
                        <tr className="plan-feature-group"><th scope="rowgroup" colSpan={PLANS.length + 1}>{group.label}</th></tr>
                        {group.rows.map(row => <tr key={row.label}>
                            <th scope="row"><span>{row.label}</span>{row.note && <small>{row.note}</small>}</th>
                            {PLANS.map(plan => <td className="plan-feature-value" key={plan.id}><FeatureValue value={row.value(plan)} /></td>)}
                        </tr>)}
                    </tbody>)}
                </table>
            </div>
            <p className="plan-footnote">Standard AI replies use {Object.values(AI_MODES).map(mode => `${number(mode.credits)} ${mode.credits === 1 ? "credit" : "credits"} in ${mode.name}`).join(", ")}. AI and 3D have separate balances. Included monthly units reset without rollover.</p>
            <p className="plan-footnote">These are plan entitlements. Your billing dashboard shows whether AI, 3D generation and paid checkout are currently available. SMS, voice, custom domains and roadmap features are not included in this comparison.</p>
        </details>
    </section>
}
