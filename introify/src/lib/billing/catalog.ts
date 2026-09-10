export const PLAN_VERSION = "2026-09-10"
export type PlanId = "free" | "starter" | "pro" | "business" | "scale"
export type BillingCadence = "monthly" | "yearly"
export type AiMode = "fast" | "smart" | "reasoning"
export type UsageUnit = "AI" | "PHOTOREAL"
export type LimitKind = "businesses" | "seats" | "offerings" | "knowledgeSources" | "knowledgeCharacters" | "storageBytes"
export type AiTier = "fast" | "smart" | "reasoning"

export type Plan = {
    id: PlanId
    name: string
    description: string
    monthlyCents: number
    yearlyCents: number
    aiCredits: number
    photorealGenerations: number
    freeTrialGenerations: number
    aiModes: readonly AiMode[]
    aiTier: AiTier
    limits: Record<LimitKind, number>
    features: { customBranding: boolean; customInstructions: boolean; autoMemory: boolean; team: boolean; multiBusiness: boolean; advancedAnalytics: boolean }
    highlights: readonly string[]
    planned: readonly string[]
    public: boolean
    recommended: boolean
    customPricing: boolean
    aiUsageHint: string
}

const GB = 1024 ** 3
const definitions: Plan[] = [
    { id: "free", name: "Free", description: "For trying Introify.", monthlyCents: 0, yearlyCents: 0, aiCredits: 50, photorealGenerations: 0, freeTrialGenerations: 1, aiModes: ["fast"], aiTier: "fast", limits: { businesses: 1, seats: 1, offerings: 10, knowledgeSources: 5, knowledgeCharacters: 50_000, storageBytes: 500 * 1024 ** 2 }, features: { customBranding: false, customInstructions: false, autoMemory: false, team: false, multiBusiness: false, advancedAnalytics: false }, highlights: ["1 business", "1 seat", "Fast AI replies", "Limited published offerings", "1 eligible 3D trial"], planned: [], public: true, recommended: false, customPricing: false, aiUsageHint: "Enough for a first look at AI replies." },
    { id: "starter", name: "Starter", description: "Retired public plan. Existing subscriptions keep their recorded entitlements.", monthlyCents: 1_000, yearlyCents: 10_800, aiCredits: 500, photorealGenerations: 3, freeTrialGenerations: 0, aiModes: ["fast", "smart"], aiTier: "smart", limits: { businesses: 1, seats: 1, offerings: 100, knowledgeSources: 20, knowledgeCharacters: 200_000, storageBytes: GB }, features: { customBranding: true, customInstructions: true, autoMemory: false, team: false, multiBusiness: false, advancedAnalytics: false }, highlights: [], planned: [], public: false, recommended: false, customPricing: false, aiUsageHint: "Regular Fast and Smart replies." },
    { id: "pro", name: "Pro", description: "For creators, professionals and solo businesses.", monthlyCents: 1_900, yearlyCents: 19_000, aiCredits: 2_000, photorealGenerations: 10, freeTrialGenerations: 0, aiModes: ["fast", "smart", "reasoning"], aiTier: "reasoning", limits: { businesses: 1, seats: 3, offerings: 500, knowledgeSources: 100, knowledgeCharacters: 1_000_000, storageBytes: 5 * GB }, features: { customBranding: true, customInstructions: true, autoMemory: true, team: true, multiBusiness: false, advancedAnalytics: true }, highlights: ["1 business", "3 seats", "Fast + Smart + Reasoning AI", "Up to 500 published offerings", "10 3D generations / month"], planned: ["Custom domains", "Automated follow-up workflows"], public: true, recommended: true, customPricing: false, aiUsageHint: "Designed for regular AI conversations and content generation." },
    { id: "business", name: "Business", description: "For teams and businesses managing multiple brands or locations.", monthlyCents: 4_900, yearlyCents: 49_000, aiCredits: 7_500, photorealGenerations: 30, freeTrialGenerations: 0, aiModes: ["fast", "smart", "reasoning"], aiTier: "reasoning", limits: { businesses: 5, seats: 10, offerings: 2_000, knowledgeSources: 300, knowledgeCharacters: 3_000_000, storageBytes: 15 * GB }, features: { customBranding: true, customInstructions: true, autoMemory: true, team: true, multiBusiness: true, advancedAnalytics: true }, highlights: ["Up to 5 businesses", "10 seats", "Fast + Smart + Reasoning AI", "Up to 2,000 published offerings", "30 3D generations / month"], planned: ["Consolidated conversion reports", "Advanced automation workflows"], public: true, recommended: false, customPricing: false, aiUsageHint: "Room for a team using AI across several businesses." },
    { id: "scale", name: "Scale", description: "Custom pricing for larger groups, higher usage and more businesses.", monthlyCents: 10_000, yearlyCents: 100_000, aiCredits: 10_000, photorealGenerations: 50, freeTrialGenerations: 0, aiModes: ["fast", "smart", "reasoning"], aiTier: "reasoning", limits: { businesses: 10, seats: 15, offerings: 5_000, knowledgeSources: 1_000, knowledgeCharacters: 10_000_000, storageBytes: 50 * GB }, features: { customBranding: true, customInstructions: true, autoMemory: true, team: true, multiBusiness: true, advancedAnalytics: true }, highlights: ["More than 5 businesses", "Larger teams", "Higher AI and 3D usage"], planned: ["Reusable business templates", "Bulk workflow approvals", "Platform API and webhooks"], public: false, recommended: false, customPricing: true, aiUsageHint: "Usage is agreed with Introify." },
]

export const PLANS: readonly Plan[] = Object.freeze(definitions.map(plan => Object.freeze({ ...plan, limits: Object.freeze(plan.limits), features: Object.freeze(plan.features), aiModes: Object.freeze(plan.aiModes), highlights: Object.freeze(plan.highlights), planned: Object.freeze(plan.planned) })))
export const PLAN_CATALOG = Object.freeze(Object.fromEntries(PLANS.map(plan => [plan.id, plan])) as Record<PlanId, Plan>)
export const PUBLIC_PLANS: readonly Plan[] = Object.freeze(PLANS.filter(plan => plan.public))
export function isPlanId(value: unknown): value is PlanId { return typeof value === "string" && Object.hasOwn(PLAN_CATALOG, value) }
export function getPlan(value: unknown): Plan { if (!isPlanId(value)) throw new Error("Unknown Introify plan"); return PLAN_CATALOG[value] }
export function allowedAiModes(planId: PlanId) { return getPlan(planId).aiModes }
export function canSelfServeCheckout(plan: Plan) { return plan.public && !plan.customPricing && plan.monthlyCents > 0 }
export function checkoutPlans() { return PLANS.filter(canSelfServeCheckout) }
export function highestPublicLimit(kind: LimitKind) { return Math.max(0, ...PUBLIC_PLANS.map(plan => plan.limits[kind])) }

export const AI_MODES = Object.freeze({
    fast: { id: "fast" as const, name: "Fast", credits: 1, description: "Everyday questions and grounded answers" },
    smart: { id: "smart" as const, name: "Smart", credits: 20, description: "Nuanced recommendations and instructions" },
    reasoning: { id: "reasoning" as const, name: "Reasoning", credits: 40, description: "Complex comparisons and planning" },
})
export function aiModeUnits(mode: AiMode) { return AI_MODES[mode].credits }
export function resolveAiMode(value: string | null | undefined): AiMode {
    if (!value || value === "fast" || value === "gpt-4o-mini" || value === "gpt-5.6-luna") return "fast"
    if (value === "smart" || value === "gpt-4o" || value === "gpt-5.6-terra") return "smart"
    if (value === "reasoning" || value === "gpt-5.6-sol") return "reasoning"
    throw new Error("This AI model is not in the approved model catalog.")
}

export const CREDIT_PACKS = Object.freeze([
    { id: "ai-1000", name: "1,000 AI credits", unit: "AI" as const, amount: 1_000, priceCents: 700 },
    { id: "3d-10", name: "10 photoreal generations", unit: "PHOTOREAL" as const, amount: 10, priceCents: 1_900 },
    { id: "3d-50", name: "50 photoreal generations", unit: "PHOTOREAL" as const, amount: 50, priceCents: 8_900 },
    { id: "3d-100", name: "100 photoreal generations", unit: "PHOTOREAL" as const, amount: 100, priceCents: 16_900 },
])
export function getCreditPack(id: string) { const pack = CREDIT_PACKS.find(item => item.id === id); if (!pack) throw new Error("Unknown credit pack"); return pack }
