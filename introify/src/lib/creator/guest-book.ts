import { resolveKitRole } from "@/lib/role-alias"

/** Guest `/book` chrome for CREATOR / COLLECT_LEADS kits — never appointment empty chrome. */
export const CREATOR_GUEST_BOOK_LABEL = "Contact"

export const CREATOR_GUEST_BOOK_EMPTY_TITLE =
    "No booking slots online — message on WhatsApp or chat"

export const CREATOR_GUEST_BOOK_EMPTY_DETAIL =
    "This page is for getting in touch — no online booking slots are published. Reach out on WhatsApp or chat and we will follow up."

export const CREATOR_GUEST_BOOK_FORBIDDEN_COPY = [
    "No sessions to book",
    "No sessions to book.",
    "sessions to book",
    "Book session",
] as const

/**
 * Lead / creator kits that must not show appointment empty chrome when offerings are empty.
 * COLLECT_LEADS always qualifies. CREATOR (+ NGO alias) qualifies by role.
 * CONSULTANT / CA / DESIGNER alone do not — unless primaryGoal is COLLECT_LEADS.
 */
export function isCreatorLeadBookSurface(role?: string | null, primaryGoal?: string | null): boolean {
    if (primaryGoal === "COLLECT_LEADS") return true
    return resolveKitRole(role) === "CREATOR"
}

export function creatorGuestBookLabel(_role?: string | null, _primaryGoal?: string | null): string {
    void _role
    void _primaryGoal
    return CREATOR_GUEST_BOOK_LABEL
}

/**
 * Use CreatorGuestBook empty surface only for lead kits with zero offerings.
 * When offerings exist, fall through to BookList (covers consultant /demo/book).
 */
export function shouldUseCreatorLeadBookEmpty(input: {
    role?: string | null
    primaryGoal?: string | null
    offeringCount: number
}): boolean {
    if (!isCreatorLeadBookSurface(input.role, input.primaryGoal)) return false
    return input.offeringCount === 0
}

function firstName(displayName: string): string {
    const part = displayName.trim().split(/\s+/)[0]
    return part || "them"
}

export function creatorGuestBookEmptyCopy(input: {
    displayName: string
    whatsapp?: boolean
}): { title: string; detail: string; chatLabel: string; waLabel: string } {
    const who = firstName(input.displayName)
    const waHint = input.whatsapp
        ? `Message ${who} on WhatsApp or chat — no online booking slots are published.`
        : `Chat with ${who} to get in touch — no online booking slots are published.`
    return {
        title: CREATOR_GUEST_BOOK_EMPTY_TITLE,
        detail: waHint,
        chatLabel: `Chat with ${who}`,
        waLabel: "WhatsApp",
    }
}

/** True when a string looks like appointment empty chrome (must never ship on creator lead /book). */
export function creatorBookCopyLooksLikeSessions(text: string): boolean {
    const lower = text.toLowerCase()
    return (
        lower.includes("no sessions to book") ||
        /\bsessions?\s+to\s+book\b/.test(lower) ||
        /\bbook\s+session\b/.test(lower)
    )
}
