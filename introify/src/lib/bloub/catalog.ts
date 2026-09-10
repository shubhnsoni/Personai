import {
    COLORS,
    COLOR_BY_ID,
    DEFAULT_COLOR,
    DEFAULT_SHAPE,
    mixHex,
    SHAPE_BY_ID,
    type ColorId,
    type ShapeId,
} from "./skins"
import {
    DEFAULT_EXPRESSION,
    EXPRESSION_BY_ID,
    type ExpressionId,
} from "./expressions"

export const BLOUB_SHAPES: { id: ShapeId; label: string }[] = [
    { id: "cercle", label: "Circle" },
    { id: "galet", label: "Pebble" },
    { id: "squircle", label: "Squircle" },
    { id: "capsule", label: "Capsule" },
    { id: "triangle", label: "Triangle" },
    { id: "hexagone", label: "Hexagon" },
    { id: "nuage", label: "Cloud" },
    { id: "goutte", label: "Droplet" },
]

export const BLOUB_EXPRESSIONS: { id: ExpressionId; label: string }[] = [
    { id: "centre", label: "Calm" },
    { id: "surpris", label: "Surprised" },
    { id: "neutre", label: "Neutral" },
    { id: "attentif", label: "Attentive" },
    { id: "excite", label: "Excited" },
    { id: "heureux", label: "Happy" },
    { id: "hilare", label: "Laughing" },
    { id: "colere", label: "Angry" },
    { id: "triste", label: "Sad" },
    { id: "effraye", label: "Scared" },
    { id: "mefiant", label: "Suspicious" },
    { id: "confus", label: "Confused" },
    { id: "curieux", label: "Curious" },
    { id: "fier", label: "Proud" },
    { id: "timide", label: "Shy" },
    { id: "blase", label: "Unimpressed" },
    { id: "somnolent", label: "Sleepy" },
]

export const BLOUB_COLORS = COLORS.map((c) => ({
    id: c.id,
    hex: c.hex,
    label: (
        {
            blanc: "White",
            encre: "Ink",
            brun: "Brown",
            rouge: "Red",
            orange: "Orange",
            ambre: "Amber",
            vert: "Green",
            turquoise: "Turquoise",
            bleu: "Blue",
            violet: "Purple",
            rose: "Pink",
            gris: "Grey",
            creme: "Cream",
        } as Record<ColorId, string>
    )[c.id],
}))

export type AuraId = "pulse" | "breathe" | "still"

export const BLOUB_AURAS: { id: AuraId; label: string }[] = [
    { id: "pulse", label: "Pulse" },
    { id: "breathe", label: "Breathe" },
    { id: "still", label: "Still" },
]

export const DEFAULT_AURA: AuraId = "pulse"

export type BloubThemeId = "classic" | "retro-lcd"

export const BLOUB_THEMES: { id: BloubThemeId; label: string; description: string }[] = [
    { id: "classic", label: "Classic", description: "Your colour, mood and aura." },
    { id: "retro-lcd", label: "Retro LCD", description: "Pixel circle. Two eyes. A nostalgic green screen." },
]

export type BloubPick = {
    shape: ShapeId
    expression: ExpressionId
    color: ColorId
    aura: AuraId
    theme: BloubThemeId
}

export const DEFAULT_BLOUB_PICK: BloubPick = {
    shape: DEFAULT_SHAPE,
    expression: DEFAULT_EXPRESSION,
    color: DEFAULT_COLOR,
    aura: DEFAULT_AURA,
    theme: "classic",
}

export const INCLUDED_BLOUB_BOTS: { id: ShapeId; label: string; expression: ExpressionId; color: ColorId }[] = [
    { id: "cercle", label: "Circle", expression: "centre", color: "blanc" },
    { id: "galet", label: "Pebble", expression: "heureux", color: "ambre" },
]

export const PREMIUM_BLOUB_BOTS: { id: ShapeId; label: string; expression: ExpressionId; color: ColorId }[] = [
    { id: "squircle", label: "Squircle", expression: "fier", color: "violet" },
    { id: "nuage", label: "Cloud", expression: "excite", color: "bleu" },
    { id: "goutte", label: "Droplet", expression: "curieux", color: "turquoise" },
    { id: "hexagone", label: "Hexagon", expression: "attentif", color: "encre" },
]

export const BLOUB_MOODS: { id: ExpressionId; label: string }[] = [
    { id: "centre", label: "Calm" },
    { id: "heureux", label: "Happy" },
    { id: "attentif", label: "Attentive" },
    { id: "curieux", label: "Curious" },
    { id: "surpris", label: "Surprised" },
    { id: "timide", label: "Shy" },
]

export function resolveBloubShape(id?: string | null): ShapeId {
    return SHAPE_BY_ID.has(id || "") ? (id as ShapeId) : DEFAULT_SHAPE
}

export function resolveBloubExpression(id?: string | null): ExpressionId {
    return EXPRESSION_BY_ID.has(id || "") ? (id as ExpressionId) : DEFAULT_EXPRESSION
}

export function resolveBloubColor(id?: string | null): ColorId {
    return COLORS.some((c) => c.id === id) ? (id as ColorId) : DEFAULT_COLOR
}

export function resolveBloubAura(id?: string | null): AuraId {
    return BLOUB_AURAS.some((item) => item.id === id) ? (id as AuraId) : DEFAULT_AURA
}

export function resolveBloubTheme(id?: string | null): BloubThemeId {
    return id === "retro-lcd" ? "retro-lcd" : "classic"
}

export function isIncludedBloubShape(shape: ShapeId): boolean {
    return INCLUDED_BLOUB_BOTS.some((bot) => bot.id === shape)
}

export function isPremiumBloubShape(shape: ShapeId): boolean {
    return !isIncludedBloubShape(shape)
}

export function clampOrbForPlan(pick: Partial<Record<"shape" | "expression" | "color" | "aura" | "theme", string | null>> | null | undefined, premium: boolean): BloubPick {
    const next: BloubPick = {
        shape: resolveBloubShape(pick?.shape),
        expression: resolveBloubExpression(pick?.expression),
        color: resolveBloubColor(pick?.color),
        aura: resolveBloubAura(pick?.aura),
        theme: resolveBloubTheme(pick?.theme),
    }
    if (next.theme === "retro-lcd") next.shape = "cercle"
    if (!premium && isPremiumBloubShape(next.shape)) next.shape = DEFAULT_SHAPE
    return next
}

export function gradientForColor(color: ColorId): [string, string] {
    const hex = COLOR_BY_ID.get(color)?.hex || "#f7f7f8"
    return [hex, mixHex(hex, "#0a0a0c", 0.72)]
}

export function parseOrbBag(personalityConfig?: string | null): BloubPick {
    try {
        const bag = JSON.parse(personalityConfig || "{}") as { orb?: Partial<BloubPick> }
        return clampOrbForPlan(bag.orb || {}, true)
    } catch {
        return { ...DEFAULT_BLOUB_PICK }
    }
}

export function writeOrbBag(personalityConfig: string | undefined, next: Partial<BloubPick>, premium = true): string {
    let bag: Record<string, unknown> = {}
    try {
        const parsed: unknown = JSON.parse(personalityConfig || "{}")
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) bag = parsed as Record<string, unknown>
    } catch {
        bag = {}
    }
    const prev = (bag.orb && typeof bag.orb === "object" && !Array.isArray(bag.orb) ? bag.orb : {}) as Partial<BloubPick>
    bag.orb = clampOrbForPlan({ ...prev, ...next }, premium)
    return JSON.stringify(bag)
}
