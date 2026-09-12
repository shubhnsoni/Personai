export const ANIMOJI_IDS = ["bounce", "sun", "et"] as const

export type AnimojiId = (typeof ANIMOJI_IDS)[number]

export const DEFAULT_ANIMOJI: AnimojiId = "bounce"

export const ANIMOJI_FACES: { id: AnimojiId; label: string }[] = [
    { id: "bounce", label: "Bounce" },
    { id: "sun", label: "Sun" },
    { id: "et", label: "ET" },
]

export const ANIMOJI_FRAME_COUNT = 46
export const ANIMOJI_FRAME_SIZE = 180
export const ANIMOJI_DURATION_MS = 3833

const ANIMOJI_SET = new Set<string>(ANIMOJI_IDS)

export function isAnimojiId(value?: string | null): value is AnimojiId {
    return Boolean(value && ANIMOJI_SET.has(value))
}

/** Old raster-pack skins collapse to Bounce so saved shops keep a coded face. */
export function resolveAnimojiId(value?: string | null): AnimojiId {
    return isAnimojiId(value) ? value : DEFAULT_ANIMOJI
}

/** Mood is expressed on the chosen face, not by swapping another clip. */
export function animojiClipForMood(selected: AnimojiId, _mood?: string | null): AnimojiId {
    return resolveAnimojiId(selected)
}

export function animojiStripSrc(id: AnimojiId) {
    return `/bots/animoji/coded/${id}.webp`
}

export function animojiStripValues(count = ANIMOJI_FRAME_COUNT, size = ANIMOJI_FRAME_SIZE) {
    return Array.from({ length: count }, (_, index) => String(-index * size)).join(";")
}
