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

export type BloubThemeId = "classic" | "retro-lcd" | "astral-nebula" | "holographic-hud" | "liquid-chrome"

export const BLOUB_THEMES: { id: BloubThemeId; label: string; description: string }[] = [
    { id: "classic", label: "Classic", description: "Your colour, mood and aura." },
    { id: "retro-lcd", label: "Retro LCD", description: "Pixel circle. Two eyes. A nostalgic green screen." },
    { id: "astral-nebula", label: "Astral Nebula", description: "Swirling violet plasma with star-core eyes and orbiting dust." },
    { id: "holographic-hud", label: "Holographic HUD", description: "Cyan wireframe scanlines with targeting-bracket eyes." },
    { id: "liquid-chrome", label: "Liquid Chrome", description: "Polished mercury sphere with slim aperture-slit eyes." },
]

export const PREMIUM_BLOUB_THEMES: readonly BloubThemeId[] = ["astral-nebula", "holographic-hud", "liquid-chrome"]

export function isPremiumBloubTheme(theme?: BloubThemeId | string | null): boolean {
    return PREMIUM_BLOUB_THEMES.includes(theme as BloubThemeId)
}

/** Themes that render a bespoke orb superseding the Classic blob, and theme the whole public page. */
export type ThemedOrbId = Exclude<BloubThemeId, "classic">

export type BloubThemeMeta = {
    /** Browser chrome + page canvas per appearance mode. */
    canvas: { light: string; dark: string }
    /** Picker thumbnail chips: dark-context and light-context treatments. */
    thumb: { bg: string; dot: string; bar: string }
    thumbLight: { bg: string; dot: string; bar: string }
    /** Shown instead of the colour swatches while this theme owns the palette. */
    note: string
}

export const BLOUB_THEME_META: Partial<Record<BloubThemeId, BloubThemeMeta>> = {
    "retro-lcd": {
        canvas: { light: "#c4d58a", dark: "#10170f" },
        thumb: { bg: "#253021", dot: "#c4d58a", bar: "#c4d58a" },
        thumbLight: { bg: "#c4d58a", dot: "#253021", bar: "#253021" },
        note: "Pale LCD green and deep olive, automatically inverted in dark mode. Your Classic colour is kept for when you switch back.",
    },
    "astral-nebula": {
        canvas: { light: "#ede6fb", dark: "#090714" },
        thumb: { bg: "#150d2e", dot: "#c084fc", bar: "#8b5cf6" },
        thumbLight: { bg: "#ede6fb", dot: "#7c3aed", bar: "#a855f7" },
        note: "Cosmic violet and supernova magenta, tuned for light and dark. Your Classic colour is kept for when you switch back.",
    },
    "holographic-hud": {
        canvas: { light: "#e5f8fd", dark: "#060810" },
        thumb: { bg: "#04131c", dot: "#00f0ff", bar: "#0aa8c2" },
        thumbLight: { bg: "#e5f8fd", dot: "#00b7d4", bar: "#164e63" },
        note: "Laser cyan on void black with mono type. Your Classic colour is kept for when you switch back.",
    },
    "liquid-chrome": {
        canvas: { light: "#e9ecf1", dark: "#0b0d12" },
        thumb: { bg: "#15181f", dot: "#e2e8f0", bar: "#94a3b8" },
        thumbLight: { bg: "#e9ecf1", dot: "#cbd5e1", bar: "#64748b" },
        note: "Polished silver with prismatic reflections, inverted in dark mode. Your Classic colour is kept for when you switch back.",
    },
}

/** Thumbnail swatches for the theme picker, honouring the surrounding surface brightness. */
export function bloubThemeThumb(id: BloubThemeId, surface: "dark" | "light"): { bg: string; dot: string; bar: string } {
    const meta = BLOUB_THEME_META[id]
    if (meta) return surface === "dark" ? meta.thumb : meta.thumbLight
    return surface === "dark"
        ? { bg: "#15202b", dot: "#b2edff", bar: "#dbe4ee" }
        : { bg: "#e7ebf0", dot: "#00a0c3", bar: "#445365" }
}

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

export type BloubBot = {
    id: ShapeId
    label: string
    expression: ExpressionId
    color: ColorId
    aura: AuraId
    theme: BloubThemeId
}

export const INCLUDED_BLOUB_BOTS: BloubBot[] = [
    { id: "cercle", label: "Zen", expression: "centre", color: "blanc", aura: "pulse", theme: "classic" },
    { id: "galet", label: "Sol", expression: "heureux", color: "ambre", aura: "breathe", theme: "classic" },
]

export const PREMIUM_BLOUB_BOTS: BloubBot[] = [
    { id: "squircle", label: "Lux", expression: "fier", color: "violet", aura: "pulse", theme: "classic" },
    { id: "nuage", label: "Sky", expression: "excite", color: "bleu", aura: "breathe", theme: "classic" },
    { id: "goutte", label: "Dew", expression: "curieux", color: "turquoise", aura: "pulse", theme: "classic" },
    { id: "hexagone", label: "Neo", expression: "attentif", color: "encre", aura: "still", theme: "classic" },
    { id: "cercle", label: "Nyx", expression: "centre", color: "violet", aura: "breathe", theme: "astral-nebula" },
    { id: "cercle", label: "Ion", expression: "attentif", color: "turquoise", aura: "pulse", theme: "holographic-hud" },
    { id: "cercle", label: "Vex", expression: "blase", color: "gris", aura: "breathe", theme: "liquid-chrome" },
]

/** Selecting a bot applies its complete look: silhouette, mood, colour, aura and theme. */
export function bloubBotPick(bot: BloubBot): Partial<BloubPick> {
    return { shape: bot.id, expression: bot.expression, color: bot.color, aura: bot.aura, theme: bot.theme }
}

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
    return BLOUB_THEMES.some((item) => item.id === id) ? (id as BloubThemeId) : "classic"
}

/** The orb renderer each bespoke theme uses; null keeps the Classic blob renderer. */
export function resolveThemedOrb(id?: string | null): "retro-lcd" | "astral-nebula" | "holographic-hud" | "liquid-chrome" | null {
    const theme = resolveBloubTheme(id)
    return theme === "classic" ? null : theme
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
    if (resolveThemedOrb(next.theme)) next.shape = "cercle"
    if (!premium && isPremiumBloubShape(next.shape)) next.shape = DEFAULT_SHAPE
    if (!premium && isPremiumBloubTheme(next.theme)) next.theme = "classic"
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
