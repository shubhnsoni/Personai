export const ANIMOJI_IDS = ["bounce", "sun", "et"] as const

export type AnimojiId = (typeof ANIMOJI_IDS)[number]

export const DEFAULT_ANIMOJI: AnimojiId = "bounce"

export const ANIMOJI_FACES: { id: AnimojiId; label: string }[] = [
    { id: "bounce", label: "Bounce" },
    { id: "sun", label: "Sun" },
    { id: "et", label: "ET" },
]

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
