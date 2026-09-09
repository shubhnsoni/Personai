import { getProfileBilling } from "@/lib/billing/service"

export type PublicAnimationConfig = { speed?: number; intensity?: number; colors?: string[]; variant?: string; look?: string; skin?: string; shape?: string; expression?: string; color?: string }
export const INTROIFY_PUBLIC_STYLE: PublicAnimationConfig = { colors: ["#34D399", "#052E1A"], variant: "forest", look: "bloub", shape: "cercle", expression: "heureux", color: "vert", speed: 1, intensity: 1 }

/** A billing outage or downgrade restores required Introify presentation. */
export async function publicBrandingAccess(profileId: string) {
    try { return (await getProfileBilling(profileId)).features.customBranding } catch { return false }
}

export async function publicAnimationConfig(profileId: string, configured: PublicAnimationConfig): Promise<PublicAnimationConfig> {
    return await publicBrandingAccess(profileId) ? configured : { ...INTROIFY_PUBLIC_STYLE, colors: [...INTROIFY_PUBLIC_STYLE.colors!] }
}

export function canHideIntroifyBrand(entitled: boolean, personalityConfig?: string | null) {
    if (!entitled) return false
    try { return JSON.parse(personalityConfig || "{}").hideIntroifyBrand === true } catch { return false }
}
