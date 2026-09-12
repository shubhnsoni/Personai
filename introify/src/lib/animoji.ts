export const ANIMOJI_IDS = [
    "bounce",
    "sun",
    "et",
    "love",
    "laugh",
    "wow",
    "sleepy",
    "ghost",
    "cloud",
    "coffee",
    "cry",
    "money",
    "angry",
    "wink",
    "cool",
    "star",
    "moon",
    "nerd",
    "shy",
    "devil",
    "angel",
    "cat",
    "robot",
    "flower",
    "fire",
    "frog",
    "panda",
] as const

export type AnimojiId = (typeof ANIMOJI_IDS)[number]

export const DEFAULT_ANIMOJI: AnimojiId = "bounce"

export const ANIMOJI_FACES: { id: AnimojiId; label: string }[] = [
    { id: "bounce", label: "Bounce" },
    { id: "sun", label: "Sun" },
    { id: "et", label: "ET" },
    { id: "love", label: "Love" },
    { id: "laugh", label: "Laugh" },
    { id: "wow", label: "Wow" },
    { id: "sleepy", label: "Sleepy" },
    { id: "ghost", label: "Ghost" },
    { id: "cloud", label: "Cloud" },
    { id: "coffee", label: "Coffee" },
    { id: "cry", label: "Cry" },
    { id: "money", label: "Money" },
    { id: "angry", label: "Angry" },
    { id: "wink", label: "Wink" },
    { id: "cool", label: "Cool" },
    { id: "star", label: "Star" },
    { id: "moon", label: "Moon" },
    { id: "nerd", label: "Nerd" },
    { id: "shy", label: "Shy" },
    { id: "devil", label: "Devil" },
    { id: "angel", label: "Angel" },
    { id: "cat", label: "Cat" },
    { id: "robot", label: "Robot" },
    { id: "flower", label: "Flower" },
    { id: "fire", label: "Fire" },
    { id: "frog", label: "Frog" },
    { id: "panda", label: "Panda" },
]

const ANIMOJI_SET = new Set<string>(ANIMOJI_IDS)

export function isAnimojiId(value?: string | null): value is AnimojiId {
    return Boolean(value && ANIMOJI_SET.has(value))
}

/** Unknown leftover pack skins collapse to Bounce. */
export function resolveAnimojiId(value?: string | null): AnimojiId {
    return isAnimojiId(value) ? value : DEFAULT_ANIMOJI
}

/** Mood is expressed on the chosen face, not by swapping another clip. */
export function animojiClipForMood(selected: AnimojiId, _mood?: string | null): AnimojiId {
    return resolveAnimojiId(selected)
}
