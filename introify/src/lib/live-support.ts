const LIVE_SUPPORT_RE = /\b(?:live\s*(?:chat|support|help|agent|person)|(?:customer|human|urgent)\s+support|customer\s+service|real\s+(?:person|human)|speak(?:\s+to|\s+with)\s+(?:a\s+)?(?:human|person|agent|someone|representative|staff|owner)|talk(?:\s+to|\s+with)\s+(?:a\s+)?(?:human|person|agent|someone|representative|staff|owner)|need(?:\s+a)?\s+(?:human|person|agent)|help\s+me\s+now|representative)\b/i

export function wantsLiveSupport(text: string): boolean {
    return LIVE_SUPPORT_RE.test((text || "").replace(/\s+/g, " ").trim())
}
