export const ANIMOJI_IDS = [
    "angry",
    "love",
    "coffee",
    "pacman",
    "wow",
    "laugh",
    "gamer",
    "selfie",
    "exploding",
    "creeped",
    "nervous",
    "eyeroll",
    "disappointed",
    "diva",
    "bounce",
    "vomit",
    "ghost",
    "curious",
    "sleepy",
    "et",
    "matrioska",
    "money",
    "monster",
    "zombie",
    "sun",
    "cloud",
    "cry",
    "headphone",
    "squash",
    "unfold",
] as const

export type AnimojiId = (typeof ANIMOJI_IDS)[number]

export const DEFAULT_ANIMOJI: AnimojiId = "bounce"

export const ANIMOJI_FACES: { id: AnimojiId; label: string }[] = [
    { id: "bounce", label: "Bounce" },
    { id: "laugh", label: "Laugh" },
    { id: "wow", label: "Wow" },
    { id: "love", label: "Love" },
    { id: "curious", label: "Curious" },
    { id: "coffee", label: "Coffee" },
    { id: "angry", label: "Angry" },
    { id: "eyeroll", label: "Eyes" },
    { id: "disappointed", label: "Down" },
    { id: "sleepy", label: "Sleepy" },
    { id: "cry", label: "Cry" },
    { id: "nervous", label: "Nervous" },
    { id: "creeped", label: "Yikes" },
    { id: "exploding", label: "Boom" },
    { id: "ghost", label: "Ghost" },
    { id: "sun", label: "Sun" },
    { id: "cloud", label: "Cloud" },
    { id: "headphone", label: "Beats" },
    { id: "gamer", label: "Gamer" },
    { id: "selfie", label: "Selfie" },
    { id: "diva", label: "Diva" },
    { id: "pacman", label: "Chomp" },
    { id: "money", label: "Money" },
    { id: "squash", label: "Squash" },
    { id: "unfold", label: "Unfold" },
    { id: "et", label: "ET" },
    { id: "matrioska", label: "Nest" },
    { id: "monster", label: "Monster" },
    { id: "zombie", label: "Zombie" },
    { id: "vomit", label: "Sick" },
]

const ANIMOJI_SET = new Set<string>(ANIMOJI_IDS)

export function isAnimojiId(value?: string | null): value is AnimojiId {
    return Boolean(value && ANIMOJI_SET.has(value))
}

export function resolveAnimojiId(value?: string | null): AnimojiId {
    return isAnimojiId(value) ? value : DEFAULT_ANIMOJI
}

export function animojiSrc(id: AnimojiId, still: boolean) {
    return still ? `/bots/animoji/${id}.png` : `/bots/animoji/${id}.webp`
}

const MOOD_CLIP: Record<string, AnimojiId> = {
    greeting: "bounce",
    thinking: "coffee",
    speaking: "laugh",
    listening: "curious",
    success: "love",
    error: "disappointed",
}

/** Chat mood plays a matching clip from the pack; idle keeps the face the owner picked. */
export function animojiClipForMood(selected: AnimojiId, mood?: string | null): AnimojiId {
    if (!mood || mood === "idle") return selected
    return MOOD_CLIP[mood] || selected
}
