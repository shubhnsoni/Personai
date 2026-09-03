const LEGACY_KEY = (slug: string) => `pl-order-${slug}`
const LIST_KEY = (slug: string) => `pl-orders-${slug}`
const MAX_LIVE = 8

export function isLiveKitchenStatus(status: string) {
    return !["CANCELLED", "PAID", "SERVED"].includes(status)
}

function unique(tokens: string[]) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const token of tokens) {
        const clean = token.trim()
        if (!clean || seen.has(clean)) continue
        seen.add(clean)
        out.push(clean)
    }
    return out
}

export function readLiveOrderTokens(slug: string) {
    try {
        const raw = localStorage.getItem(LIST_KEY(slug))
        const listed = raw ? JSON.parse(raw) as unknown : []
        const fromList = Array.isArray(listed)
            ? listed.filter((item): item is string => typeof item === "string")
            : []
        const legacy = localStorage.getItem(LEGACY_KEY(slug))
        return unique([...fromList, legacy || ""]).slice(0, MAX_LIVE)
    } catch {
        return []
    }
}

export function writeLiveOrderToken(slug: string, token: string) {
    const next = unique([token, ...readLiveOrderTokens(slug)]).slice(0, MAX_LIVE)
    try {
        localStorage.setItem(LIST_KEY(slug), JSON.stringify(next))
        localStorage.setItem(LEGACY_KEY(slug), next[0] || token)
    } catch { /* ignore */ }
}

export function dropLiveOrderToken(slug: string, token: string) {
    const next = readLiveOrderTokens(slug).filter((item) => item !== token)
    try {
        localStorage.setItem(LIST_KEY(slug), JSON.stringify(next))
        if (next[0]) localStorage.setItem(LEGACY_KEY(slug), next[0])
        else localStorage.removeItem(LEGACY_KEY(slug))
    } catch { /* ignore */ }
}

export function clearLiveOrderToken(slug: string) {
    try {
        localStorage.removeItem(LIST_KEY(slug))
        localStorage.removeItem(LEGACY_KEY(slug))
    } catch { /* ignore */ }
}
