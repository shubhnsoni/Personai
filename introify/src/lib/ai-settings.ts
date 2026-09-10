import { clampOrbForPlan } from "@/lib/bloub/catalog"
import { allowedAiModes, getPlan, resolveAiMode, type PlanId } from "@/lib/billing/catalog"

export function permittedPersonality(config: string | null | undefined, customInstructions: boolean) {
    if (!config || customInstructions) return config
    try {
        const data = JSON.parse(config)
        if (!data || typeof data !== "object" || Array.isArray(data)) return null
        delete data.customInstructions
        return JSON.stringify(data)
    } catch { return null }
}

export function validateAiSettings(planId: PlanId, data: { aiModel?: string; autoMemoryEnabled?: boolean; personalityConfig?: string }) {
    const plan = getPlan(planId)
    const mode = data.aiModel === undefined ? undefined : resolveAiMode(data.aiModel)
    if (mode && !allowedAiModes(planId).includes(mode)) throw new Error("This AI mode is not included in your plan. Choose an available mode or upgrade.")
    if (data.autoMemoryEnabled && !plan.features.autoMemory) throw new Error("Private conversation memory is available on Pro and above.")
    let personalityConfig = permittedPersonality(data.personalityConfig, plan.features.customInstructions)
    if (personalityConfig) {
        try {
            const bag = JSON.parse(personalityConfig) as Record<string, unknown>
            if (bag.orb && typeof bag.orb === "object") {
                bag.orb = clampOrbForPlan(bag.orb as Record<string, string | null>, plan.features.customBranding)
            }
            if (!plan.features.customBranding) delete bag.hideIntroifyBrand
            personalityConfig = JSON.stringify(bag)
        } catch { personalityConfig = null }
    }
    return { aiModel: mode, autoMemoryEnabled: data.autoMemoryEnabled, personalityConfig }
}
