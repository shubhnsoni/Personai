import { DEFAULT_ANIMOJI, isAnimojiId, resolveAnimojiId, type AnimojiId } from "@/lib/animoji"
import { ORB_VARIANTS, type OrbVariantId } from "@/lib/orb-variants"
import { resolveOrbLook, type OrbLook, type PixelSkin } from "@/lib/pixel-skins"
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
    // Keep the stored value compatible with existing profiles.
    { id: "still", label: "Aura off" },
]

export const DEFAULT_AURA: AuraId = "pulse"

export type PlanetThemeId = "planet-azure" | "planet-rose" | "planet-sage"
export type CosmicThemeId = "cosmic-space" | "cosmic-comic"
export type BloubThemeId = "classic" | "retro-lcd" | "astral-nebula" | "holographic-hud" | "liquid-chrome" | PlanetThemeId | CosmicThemeId
export const PLANET_THEMES: readonly PlanetThemeId[] = ["planet-azure", "planet-rose", "planet-sage"]
export const COSMIC_THEMES: readonly CosmicThemeId[] = ["cosmic-space", "cosmic-comic"]

export function isPlanetTheme(theme?: string | null): theme is PlanetThemeId {
    return PLANET_THEMES.includes(theme as PlanetThemeId)
}

export function isCosmicTheme(theme?: string | null): theme is CosmicThemeId {
    return COSMIC_THEMES.includes(theme as CosmicThemeId)
}

export const BLOUB_THEMES: { id: BloubThemeId; label: string; description: string }[] = [
    { id: "classic", label: "Classic", description: "" },
    { id: "retro-lcd", label: "Retro LCD", description: "" },
    { id: "planet-azure", label: "Azure", description: "" },
    { id: "planet-rose", label: "Rose", description: "" },
    { id: "planet-sage", label: "Sage", description: "" },
    { id: "cosmic-space", label: "Space", description: "" },
    { id: "cosmic-comic", label: "Comic", description: "" },
    { id: "astral-nebula", label: "Astral Nebula", description: "" },
    { id: "holographic-hud", label: "Hologram", description: "" },
    { id: "liquid-chrome", label: "Liquid Chrome", description: "" },
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
    "cosmic-space": {
        canvas: { light: "#f3edfc", dark: "#0b0818" },
        thumb: { bg: "#0b0818", dot: "#d8a0ff", bar: "#b874ef" },
        thumbLight: { bg: "#f3edfc", dot: "#7838aa", bar: "#452760" },
        note: "Violet starlight and a deep-space canvas, with a soft lavender light mode.",
    },
    "cosmic-comic": {
        canvas: { light: "#f5e7c9", dark: "#181020" },
        thumb: { bg: "#181020", dot: "#f270c9", bar: "#e7cfa1" },
        thumbLight: { bg: "#f5e7c9", dot: "#a52c80", bar: "#28182f" },
        note: "Magenta ink, bold outlines and halftone paper, with a matching dark edition.",
    },
    "planet-azure": {
        canvas: { light: "#edf5fb", dark: "#07111f" },
        thumb: { bg: "#07111f", dot: "#88c8f3", bar: "#88c8f3" },
        thumbLight: { bg: "#edf5fb", dot: "#2563a6", bar: "#172f4c" },
        note: "Cloud blue and soft silver, with a matching light and dark canvas.",
    },
    "planet-rose": {
        canvas: { light: "#fbf0f3", dark: "#1a0d17" },
        thumb: { bg: "#1a0d17", dot: "#f0a4c8", bar: "#f0a4c8" },
        thumbLight: { bg: "#fbf0f3", dot: "#a8406b", bar: "#4a2639" },
        note: "Rose pink and soft pearl, with a matching light and dark canvas.",
    },
    "planet-sage": {
        canvas: { light: "#edf6ef", dark: "#081710" },
        thumb: { bg: "#081710", dot: "#9ed2ac", bar: "#9ed2ac" },
        thumbLight: { bg: "#edf6ef", dot: "#35734e", bar: "#203e2b" },
        note: "Sage green and soft mint, with a matching light and dark canvas.",
    },
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
        canvas: { light: "#eef6fc", dark: "#091525" },
        thumb: { bg: "#091525", dot: "#a7ddff", bar: "#66b3e8" },
        thumbLight: { bg: "#eef6fc", dot: "#367fad", bar: "#214969" },
        note: "Ice-blue light and a translucent globe, tuned for light and dark. Your Classic colour is kept for when you switch back.",
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
    orbitProfile: boolean
    look?: OrbLook
    skin?: PixelSkin | AnimojiId
    variant?: OrbVariantId
}

export const DEFAULT_BLOUB_PICK: BloubPick = {
    shape: DEFAULT_SHAPE,
    expression: DEFAULT_EXPRESSION,
    color: DEFAULT_COLOR,
    aura: DEFAULT_AURA,
    theme: "classic",
    orbitProfile: false,
    look: "bloub",
    variant: "aqua",
}

const BLOB_COLOR_ORDER: OrbVariantId[] = ["aqua", "forest", "ember", "violet", "sunrise", "ice"]

export const BLOB_COLOR_STOPS = BLOB_COLOR_ORDER.map((id) => {
    const item = ORB_VARIANTS.find((variant) => variant.id === id)!
    return { id: item.id, hex: item.colors[0], deep: item.colors[1], label: item.name }
})

const VARIANT_COLOR: Record<OrbVariantId, ColorId> = {
    aqua: "turquoise",
    forest: "vert",
    ember: "ambre",
    violet: "violet",
    sunrise: "rose",
    ice: "blanc",
}

export function blobColorIndex(variant?: string | null): number {
    const i = BLOB_COLOR_STOPS.findIndex((stop) => stop.id === variant)
    return i >= 0 ? i : 0
}

export function blobColorFromIndex(index: number) {
    const i = Math.max(0, Math.min(BLOB_COLOR_STOPS.length - 1, Math.round(index)))
    return BLOB_COLOR_STOPS[i]
}

export function blobPickFromColorIndex(index: number, look?: OrbLook | string | null): Partial<BloubPick> {
    const stop = blobColorFromIndex(index)
    const resolved = resolveOrbLook(look)
    return {
        look: resolved === "glass" ? "glass" : "bloub",
        theme: "classic",
        variant: stop.id,
        color: VARIANT_COLOR[stop.id],
    }
}

export type CustomizerBot = {
    id: "blob" | "glow" | "animoji" | PixelSkin
    label: string
    look: OrbLook
    skin?: PixelSkin | AnimojiId
    premium?: boolean
}

export const CUSTOMIZER_BOTS: CustomizerBot[] = [
    { id: "blob", label: "Blob", look: "bloub" },
    { id: "glow", label: "Glow", look: "glass" },
    { id: "animoji", label: "Animoji", look: "animoji", skin: DEFAULT_ANIMOJI },
    { id: "bit", label: "8-Bit", look: "pixel", skin: "bit", premium: true },
    { id: "crt", label: "CRT", look: "pixel", skin: "crt", premium: true },
    { id: "spark", label: "Spark", look: "pixel", skin: "spark", premium: true },
]

export const BLOB_SHAPES: { id: ShapeId; label: string; premium?: boolean }[] = [
    { id: "cercle", label: "Circle" },
    { id: "galet", label: "Sol" },
    { id: "squircle", label: "Lux", premium: true },
    { id: "nuage", label: "Sky", premium: true },
    { id: "goutte", label: "Dew", premium: true },
]

const FREE_BLOB_SHAPES: ShapeId[] = ["cercle", "galet"]

export function customizerBotPick(bot: CustomizerBot, current: BloubPick): Partial<BloubPick> {
    if (bot.look === "animoji") {
        return {
            look: "animoji",
            skin: isAnimojiId(current.skin) ? current.skin : DEFAULT_ANIMOJI,
            theme: "classic",
            shape: "cercle",
            aura: current.aura,
        }
    }
    if (bot.look === "pixel") {
        return { look: "pixel", skin: bot.skin, theme: "classic", shape: "cercle" }
    }
    if (bot.look === "glass") {
        return {
            look: "glass",
            skin: undefined,
            theme: "classic",
            shape: "cercle",
            variant: current.variant || "aqua",
            color: current.variant ? VARIANT_COLOR[current.variant] : current.color,
        }
    }
    return {
        look: "bloub",
        skin: undefined,
        theme: "classic",
        shape: BLOB_SHAPES.some((item) => item.id === current.shape) ? current.shape : "cercle",
        variant: current.variant || "aqua",
        color: current.variant ? VARIANT_COLOR[current.variant] : current.color,
    }
}

export function isCustomizerBotSelected(bot: CustomizerBot, value: BloubPick) {
    if (bot.look === "animoji") return resolveOrbLook(value.look) === "animoji"
    if (bot.look === "pixel") return value.look === "pixel" && value.skin === bot.skin
    if (bot.look === "glass") return resolveOrbLook(value.look) === "glass" && value.theme === "classic"
    return resolveOrbLook(value.look) === "bloub" && value.theme === "classic"
}

export type BloubBot = {
    id: ShapeId
    label: string
    expression: ExpressionId
    color: ColorId
    aura: AuraId
    theme: BloubThemeId
    /** Alternate page and character treatments owned by this single bot. */
    themes?: readonly BloubThemeId[]
}

export const INCLUDED_BLOUB_BOTS: BloubBot[] = [
    { id: "cercle", label: "LCD", expression: "centre", color: "vert", aura: "still", theme: "retro-lcd" },
    { id: "cercle", label: "Azure", expression: "centre", color: "bleu", aura: "breathe", theme: "planet-azure", themes: PLANET_THEMES },
    { id: "cercle", label: "Nova", expression: "centre", color: "violet", aura: "breathe", theme: "cosmic-space", themes: COSMIC_THEMES },
]

export const PREMIUM_BLOUB_BOTS: BloubBot[] = [
    { id: "cercle", label: "Nyx", expression: "centre", color: "violet", aura: "breathe", theme: "astral-nebula" },
    { id: "cercle", label: "Ion", expression: "heureux", color: "turquoise", aura: "pulse", theme: "holographic-hud" },
    { id: "cercle", label: "Vex", expression: "blase", color: "gris", aura: "breathe", theme: "liquid-chrome" },
]

/** Selecting a named bot applies its defaults, retaining its selected alternate treatment. */
export function bloubBotPick(bot: BloubBot, current?: BloubPick): Partial<BloubPick> {
    const theme = current && isNamedBloubBotSelected(bot, current) ? current.theme : bot.theme
    return { look: "bloub", shape: bot.id, expression: bot.expression, color: bot.color, aura: current?.aura ?? bot.aura, theme }
}

export function isNamedBloubBotSelected(bot: BloubBot, value: BloubPick) {
    if (resolveOrbLook(value.look) !== "bloub") return false
    if (value.shape !== bot.id || !(bot.themes ?? [bot.theme]).includes(value.theme)) return false
    if (!resolveThemedOrb(bot.theme) && bot.id === "cercle") {
        if (value.expression !== bot.expression || value.color !== bot.color) return false
        if (value.variant && VARIANT_COLOR[value.variant] !== bot.color) return false
    }
    return true
}

/** Chat themes that belong to the selected bot — Look never lists every theme. */
export function lookThemesFor(value: BloubPick) {
    const look = resolveOrbLook(value.look)
    if (look === "pixel" || look === "glass" || look === "animoji") return []
    const theme = resolveBloubTheme(value.theme)
    if (PLANET_THEMES.includes(theme as PlanetThemeId)) return []
    const family = [...INCLUDED_BLOUB_BOTS, ...PREMIUM_BLOUB_BOTS].find((bot) => bot.themes?.includes(theme))
    return BLOUB_THEMES.filter((item) => family?.themes ? family.themes.includes(item.id) : item.id === theme)
}

export function usesBlobColorSlider(value: BloubPick) {
    const look = resolveOrbLook(value.look)
    if (look === "pixel" || look === "animoji") return false
    if (look === "glass") return true
    return !resolveThemedOrb(value.theme)
}

export function usesBlobShapes(value: BloubPick) {
    return resolveOrbLook(value.look) === "bloub" && !resolveThemedOrb(value.theme)
}

export function usesAnimojiFaces(value: BloubPick) {
    return resolveOrbLook(value.look) === "animoji"
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
export function resolveThemedOrb(id?: string | null): ThemedOrbId | null {
    const theme = resolveBloubTheme(id)
    return theme === "classic" ? null : theme
}

export function isIncludedBloubShape(shape: ShapeId): boolean {
    return FREE_BLOB_SHAPES.includes(shape)
}

export function isPremiumBloubShape(shape: ShapeId): boolean {
    return !isIncludedBloubShape(shape)
}

export type OrbPickInput = Partial<Record<"shape" | "expression" | "color" | "aura" | "theme" | "look" | "skin" | "variant", string | null>> & { orbitProfile?: unknown }

export function clampOrbForPlan(pick: OrbPickInput | null | undefined, premium: boolean): BloubPick {
    if (!pick || Object.keys(pick).length === 0) return { ...DEFAULT_BLOUB_PICK }
    const look = pick?.look === "pixel" || pick?.look === "glass" || pick?.look === "bloub" || pick?.look === "blob" || pick?.look === "animoji" ? pick.look : "bloub"
    const pixelSkin = pick?.skin === "bit" || pick?.skin === "crt" || pick?.skin === "spark" ? pick.skin : undefined
    const variant = ORB_VARIANTS.some((item) => item.id === pick?.variant) ? pick?.variant as OrbVariantId : undefined
    const next: BloubPick = {
        shape: resolveBloubShape(pick?.shape),
        expression: resolveBloubExpression(pick?.expression),
        color: resolveBloubColor(pick?.color),
        aura: resolveBloubAura(pick?.aura),
        theme: resolveBloubTheme(pick?.theme),
        orbitProfile: pick?.orbitProfile === true,
        look: look === "blob" ? "bloub" : look,
        ...(variant ? { variant } : {}),
    }
    if (next.look === "animoji") {
        next.skin = resolveAnimojiId(pick?.skin)
        next.shape = "cercle"
        next.theme = "classic"
    } else if (pixelSkin) {
        next.skin = pixelSkin
    }
    if (resolveThemedOrb(next.theme)) {
        next.shape = "cercle"
        next.look = "bloub"
        delete next.skin
    }
    if (!premium && isPremiumBloubShape(next.shape)) next.shape = DEFAULT_SHAPE
    if (!premium && isPremiumBloubTheme(next.theme)) next.theme = "classic"
    if (!premium && next.look === "pixel") {
        next.look = "bloub"
        delete next.skin
    }
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
