import { clampOrbForPlan, gradientForColor, type AuraId } from "@/lib/bloub/catalog"
import { getProfileBilling } from "@/lib/billing/service"

export type PublicAnimationConfig = { speed?: number; intensity?: number; colors?: string[]; variant?: string; look?: string; skin?: string; shape?: string; expression?: string; color?: string; aura?: AuraId | string }
export const INTROIFY_PUBLIC_STYLE: PublicAnimationConfig = {
    colors: gradientForColor("blanc"),
    look: "bloub",
    shape: "cercle",
    expression: "centre",
    color: "blanc",
    aura: "pulse",
    speed: 1,
    intensity: 1,
}

function freeLiveLook(configured: PublicAnimationConfig): PublicAnimationConfig {
    const orb = clampOrbForPlan({
        shape: configured.shape,
        expression: configured.expression,
        color: configured.color,
        aura: configured.aura,
    }, false)
    return {
        look: "bloub",
        shape: orb.shape,
        expression: orb.expression,
        color: orb.color,
        aura: orb.aura,
        colors: gradientForColor(orb.color),
        speed: 1,
        intensity: 1,
    }
}

/** A billing outage or downgrade restores required Introify presentation. */
export async function publicBrandingAccess(profileId: string) {
    try { return (await getProfileBilling(profileId)).features.customBranding } catch { return false }
}

export async function publicAnimationConfig(profileId: string, configured: PublicAnimationConfig): Promise<PublicAnimationConfig> {
    return await publicBrandingAccess(profileId) ? configured : freeLiveLook(configured)
}

export function canHideIntroifyBrand(entitled: boolean, personalityConfig?: string | null) {
    if (!entitled) return false
    try { return JSON.parse(personalityConfig || "{}").hideIntroifyBrand === true } catch { return false }
}
