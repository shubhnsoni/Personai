export type OrbVariantId = "aqua" | "ember" | "violet" | "forest" | "sunrise" | "ice"

export type OrbVariant = {
    id: OrbVariantId
    name: string
    colors: [string, string]
}

export const ORB_VARIANTS: OrbVariant[] = [
    { id: "aqua", name: "Aqua", colors: ["#00D7FF", "#07104D"] },
    { id: "ember", name: "Ember", colors: ["#FFB020", "#3A0A08"] },
    { id: "violet", name: "Violet", colors: ["#C084FC", "#1E0B3A"] },
    { id: "forest", name: "Forest", colors: ["#34D399", "#052E1A"] },
    { id: "sunrise", name: "Sunrise", colors: ["#FB7185", "#431407"] },
    { id: "ice", name: "Ice", colors: ["#E0F2FE", "#0C1929"] },
]

export const ORB_THEMES: Record<OrbVariantId, {
    bright: string
    deep: string
    mid: string
    accent: string
    onAccent: string
}> = {
    aqua: { bright: "#00D7FF", deep: "#07104D", mid: "#0987ed", accent: "#0670C8", onAccent: "#FFFFFF" },
    ember: { bright: "#FFD166", deep: "#9A2A0C", mid: "#FF8A2A", accent: "#C2410C", onAccent: "#FFFFFF" },
    violet: { bright: "#F0ABFC", deep: "#6D28D9", mid: "#C084FC", accent: "#6D28D9", onAccent: "#FFFFFF" },
    forest: { bright: "#A7F3D0", deep: "#047857", mid: "#34D399", accent: "#047857", onAccent: "#FFFFFF" },
    sunrise: { bright: "#FECDD3", deep: "#E11D48", mid: "#FB7185", accent: "#BE123C", onAccent: "#FFFFFF" },
    ice: { bright: "#F0F9FF", deep: "#0284C7", mid: "#7DD3FC", accent: "#0369A1", onAccent: "#FFFFFF" },
}

export function resolveOrbVariant(
    colors?: string[] | null,
    variant?: string | null
): OrbVariantId {
    if (variant && ORB_VARIANTS.some((v) => v.id === variant)) {
        return variant as OrbVariantId
    }
    if (!colors?.[0]) return "aqua"
    const a = colors[0].replace("#", "").toLowerCase()
    const b = (colors[1] || colors[0]).replace("#", "").toLowerCase()
    const hit = ORB_VARIANTS.find((v) => {
        const ca = v.colors[0].replace("#", "").toLowerCase()
        const cb = v.colors[1].replace("#", "").toLowerCase()
        return (a === ca && b === cb) || a === ca || a === cb
    })
    return hit?.id ?? "aqua"
}
