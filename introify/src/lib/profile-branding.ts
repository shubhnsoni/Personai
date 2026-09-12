import { clampOrbForPlan, gradientForColor, resolveBloubTheme, resolveThemedOrb, type AuraId } from "@/lib/bloub/catalog"
import { lookupProfileEntitlement } from "@/lib/billing/entitlements"

export type PublicAnimationConfig = { speed?: number; intensity?: number; colors?: string[]; variant?: string; look?: string; skin?: string; shape?: string; expression?: string; color?: string; aura?: AuraId | string; theme?: string; orbitProfile?: boolean }
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
        theme: configured.theme,
        look: configured.look,
        skin: configured.skin,
        variant: configured.variant,
        orbitProfile: configured.orbitProfile,
    }, false)
    if (orb.look === "animoji") {
        return {
            look: "animoji",
            skin: orb.skin,
            shape: "cercle",
            expression: orb.expression,
            color: orb.color,
            aura: orb.aura,
            theme: "classic",
            colors: gradientForColor("blanc"),
            speed: 1,
            intensity: 1,
            ...(configured.orbitProfile !== undefined ? { orbitProfile: orb.orbitProfile } : {}),
        }
    }
    return {
        look: "bloub",
        shape: orb.shape,
        expression: orb.expression,
        color: orb.color,
        aura: orb.aura,
        ...(configured.theme !== undefined ? { theme: orb.theme } : {}),
        colors: gradientForColor(orb.color),
        speed: 1,
        intensity: 1,
        ...(configured.orbitProfile !== undefined ? { orbitProfile: orb.orbitProfile } : {}),
    }
}

/** A billing outage or downgrade restores required Introify presentation. */
export async function publicBrandingAccess(profileId: string) {
    try { return (await lookupProfileEntitlement(profileId)).features.customBranding } catch { return false }
}

export async function publicAnimationConfig(profileId: string, configured: PublicAnimationConfig): Promise<PublicAnimationConfig> {
    const allowed = await publicBrandingAccess(profileId) ? {
        ...configured,
        ...(configured.orbitProfile !== undefined ? { orbitProfile: configured.orbitProfile === true } : {}),
    } : freeLiveLook(configured)
    if (allowed.theme === undefined) return allowed
    const theme = resolveBloubTheme(allowed.theme)
    // An older animation preset can still say "glass" or omit look entirely. Bespoke
    // themed orbs always render the round bot, even after a downgrade.
    return resolveThemedOrb(theme)
        ? { ...allowed, theme, look: "bloub", shape: "cercle" }
        : { ...allowed, theme }
}

/** The saved bot choice takes precedence over a legacy animation preset on every public route. */
export function configuredProfileAnimation(profile: {
    animationStyle?: { config?: unknown } | null
    personalityConfig?: string | null
}): PublicAnimationConfig {
    let configured: PublicAnimationConfig = {}
    try {
        const raw = profile.animationStyle?.config
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) configured = parsed
    } catch { /* A malformed preset must not prevent the saved bot from loading. */ }
    try {
        const bag = JSON.parse(profile.personalityConfig || "{}")
        if (bag?.orb && typeof bag.orb === "object" && !Array.isArray(bag.orb)) {
            configured = { ...configured, ...bag.orb }
        }
    } catch { /* Keep the preset when the personalization bag is malformed. */ }
    return configured
}

export function canHideIntroifyBrand(entitled: boolean, personalityConfig?: string | null) {
    if (!entitled) return false
    try { return JSON.parse(personalityConfig || "{}").hideIntroifyBrand === true } catch { return false }
}
