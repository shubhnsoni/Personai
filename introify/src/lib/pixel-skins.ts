export type OrbLook = "glass" | "pixel" | "bloub"
export type PixelSkin = "bit" | "crt" | "spark"

const SKINS: PixelSkin[] = ["bit", "crt", "spark"]

export function resolveOrbLook(look?: string | null): OrbLook {
    if (look === "pixel") return "pixel"
    if (look === "bloub" || look === "blob") return "bloub"
    return "glass"
}

export function resolvePixelSkin(skin?: string | null): PixelSkin {
    if (skin === "slime") return "bit"
    if (skin && SKINS.includes(skin as PixelSkin)) return skin as PixelSkin
    return "bit"
}
