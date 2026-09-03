export type SocialLinks = {
    instagram?: string
    facebook?: string
    youtube?: string
    maps?: string
    zomato?: string
}

function cleanUrl(raw: unknown, hosts?: string[]) {
    if (typeof raw !== "string") return undefined
    const url = raw.trim().slice(0, 300)
    if (!url) return undefined
    if (!url.startsWith("https://") && !url.startsWith("http://")) return undefined
    if (hosts && !hosts.some((host) => url.includes(host))) return undefined
    return url
}

export function socialsFromConfig(raw?: string | null): SocialLinks {
    try {
        const parsed = JSON.parse(raw || "{}") as { socials?: Record<string, unknown> }
        const bag = parsed.socials || {}
        return {
            instagram: cleanUrl(bag.instagram, ["instagram.com"]),
            facebook: cleanUrl(bag.facebook, ["facebook.com", "fb.com"]),
            youtube: cleanUrl(bag.youtube, ["youtube.com", "youtu.be"]),
            maps: cleanUrl(bag.maps, ["google.com/maps", "maps.app.goo.gl", "maps.google.com"]),
            zomato: cleanUrl(bag.zomato, ["zomato.com"]),
        }
    } catch {
        return {}
    }
}

export function writeSocials(raw: string | null | undefined, socials: SocialLinks) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    const next: Record<string, string> = {}
    if (socials.instagram) next.instagram = socials.instagram
    if (socials.facebook) next.facebook = socials.facebook
    if (socials.youtube) next.youtube = socials.youtube
    if (socials.maps) next.maps = socials.maps
    if (socials.zomato) next.zomato = socials.zomato
    if (Object.keys(next).length) bag.socials = next
    else delete bag.socials
    return JSON.stringify(bag)
}

export function hasSocials(links: SocialLinks) {
    return Boolean(links.instagram || links.facebook || links.youtube || links.maps || links.zomato)
}
