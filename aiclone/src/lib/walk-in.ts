export type AboutWalkIn = {
    kind: "sphere" | "model"
    url: string
}

function cleanUrl(raw: unknown) {
    if (typeof raw !== "string") return null
    const url = raw.trim().slice(0, 500)
    if (!url.startsWith("/") && !url.startsWith("https://")) return null
    return url
}

export function walkInFromConfig(raw?: string | null): AboutWalkIn | null {
    try {
        const parsed = JSON.parse(raw || "{}") as { aboutWalkIn?: { kind?: unknown; url?: unknown } }
        const bag = parsed.aboutWalkIn
        const url = cleanUrl(bag?.url)
        if (!url) return null
        const kind = bag?.kind === "model" ? "model" : bag?.kind === "sphere" ? "sphere" : null
        if (!kind) {
            if (/\.glb($|\?)/i.test(url) || /\.gltf($|\?)/i.test(url)) return { kind: "model", url }
            return { kind: "sphere", url }
        }
        return { kind, url }
    } catch {
        return null
    }
}

export function writeWalkIn(raw: string | null | undefined, walkIn: AboutWalkIn | null) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    if (walkIn?.url) bag.aboutWalkIn = { kind: walkIn.kind, url: walkIn.url }
    else delete bag.aboutWalkIn
    return JSON.stringify(bag)
}
