export function redactVisitorText(text: string, identities: Array<string | null | undefined> = []): string {
    let cleaned = text
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email removed]")
        .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, "[number removed]")
    for (const identity of identities) {
        if (!identity?.trim()) continue
        const escaped = identity.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        cleaned = cleaned.replace(new RegExp(escaped, "giu"), "[visitor]")
    }
    return cleaned.slice(0, 2400)
}

export function isPrivateChatDocument(document: { type: string; sourceType?: string | null }) {
    return document.type === "PROFILE_MEMORY" || document.type === "PRIVATE_CHAT_NOTES"
        || document.sourceType === "CHAT_SUMMARY" || document.sourceType === "CHAT_PRIVATE"
}
