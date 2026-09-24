import { isJewelryKit, isJewelryRetail } from "@/lib/metal/math"
import { isAutoParts } from "@/lib/autoparts/fitment"
import { resolveKitRole } from "@/lib/role-alias"

/** Suggested follow-ups after an assistant reply. Role-aware — no hire-desk "working with" on retail jewellery or auto-parts. */
export function generateSuggestions(
    lastAssistant: string,
    displayName: string,
    role?: string | null,
): string[] {
    const kit = resolveKitRole(role) || (role || "").trim().toUpperCase()
    if (isJewelryRetail(role) || kit === "JEWELRY_RETAIL") {
        return [
            "What's today's gold rate?",
            "Do you have a 22K mangalsutra?",
            "Show bridal jewellery",
        ]
    }
    if (isJewelryKit(role) || kit === "JEWELRY_WHOLESALE") {
        return [
            "What's today's board?",
            "What stock is on the menu?",
            "How do I order as a shop?",
        ]
    }
    if (isAutoParts(role) || kit === "AUTO_PARTS") {
        return [
            "Do you have Swift brake pads?",
            "What oil filter fits my car?",
            "Show parts that fit Maruti Swift",
        ]
    }

    const t = (lastAssistant || "").toLowerCase()
    if (t.includes("book") || t.includes("call") || t.includes("session")) {
        return [`What does a first call with ${displayName} look like?`, "What should I prepare?", "Any openings this week?"]
    }
    if (t.includes("course") || t.includes("lesson") || t.includes("learn")) {
        return ["Who is that course for?", "How long does it take?", "Is there a starting module I can preview?"]
    }
    if (t.includes("product") || t.includes("workbook") || t.includes("download")) {
        return ["What's inside that file?", "Is it a one-time buy?", "Anything free to start with?"]
    }
    if (t.includes("event") || t.includes("workshop") || t.includes("office hour")) {
        return ["When is the next one?", "Is it live or recorded?", "Can I get a reminder?"]
    }
    if (t.includes("experience") || t.includes("background") || t.includes("work")) {
        return [`How did ${displayName} start?`, "Who do you usually work with?", "Can we book a fit call?"]
    }
    return [`Tell me more about working with ${displayName}`, "What should I do next?", "Do you have something free?"]
}
