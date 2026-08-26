import { parseGallery } from "@/lib/commerce"

export type ItemPhoto = {
    url: string
    source: "owner" | "review" | "auto"
}

const IMG_IN_TEXT = /https?:\/\/[^\s)]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s)]*)?/gi

export function photosFromReviews(reviews: { imageUrl?: string | null; text?: string | null }[]): ItemPhoto[] {
    const out: ItemPhoto[] = []
    const seen = new Set<string>()
    const push = (url?: string | null) => {
        const u = url?.trim()
        if (!u || seen.has(u)) return
        seen.add(u)
        out.push({ url: u, source: "review" })
    }
    for (const r of reviews) {
        push(r.imageUrl)
        const text = r.text || ""
        for (const m of text.match(IMG_IN_TEXT) || []) push(m)
    }
    return out
}

export function ownerPhotos(galleryUrls?: string | null, thumbnailUrl?: string | null): ItemPhoto[] {
    return parseGallery(galleryUrls, thumbnailUrl).map((url) => ({ url, source: "owner" as const }))
}

function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}

function queryBits(title: string, category?: string | null) {
    const words = `${title} ${category || ""}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["the", "and", "with", "house", "blu"].includes(w))
    return words.slice(0, 3)
}

export async function autoPhotos(title: string, category?: string | null, need = 4): Promise<ItemPhoto[]> {
    if (need <= 0) return []
    const bits = queryBits(title, category)
    const q = bits[0] || "food"
    const found: string[] = []

    try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`, {
            next: { revalidate: 86400 },
        })
        if (res.ok) {
            const data = (await res.json()) as { meals?: { strMealThumb?: string }[] | null }
            for (const meal of data.meals || []) {
                if (meal.strMealThumb) found.push(meal.strMealThumb)
                if (found.length >= need) break
            }
        }
    } catch {
        /* ignore */
    }

    const seed = hash(`${title}|${category || ""}`)
    let i = 0
    while (found.length < need && i < need + 2) {
        const tags = [...bits, "food"].slice(0, 2).join(",")
        found.push(`https://loremflickr.com/800/1000/${encodeURIComponent(tags)}?lock=${seed + i}`)
        i += 1
    }

    return found.slice(0, need).map((url) => ({ url, source: "auto" as const }))
}

export async function collectItemPhotos(input: {
    title: string
    category?: string | null
    galleryUrls?: string | null
    thumbnailUrl?: string | null
    reviews?: { imageUrl?: string | null; text?: string | null }[]
}): Promise<ItemPhoto[]> {
    const owned = ownerPhotos(input.galleryUrls, input.thumbnailUrl)
    const reviews = photosFromReviews(input.reviews || [])
    const seen = new Set(owned.concat(reviews).map((p) => p.url))
    const merged = [...owned, ...reviews]
    const extra = await autoPhotos(input.title, input.category, Math.max(0, 5 - merged.length))
    for (const p of extra) {
        if (seen.has(p.url)) continue
        seen.add(p.url)
        merged.push(p)
    }
    return merged
}
