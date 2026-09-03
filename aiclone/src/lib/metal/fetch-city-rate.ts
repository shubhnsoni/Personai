import { citySlug, goodreturnsUrl } from "@/lib/metal/city"
import { rupeesPerGramToPaisePer10g, type GoldRates } from "@/lib/metal/math"
import type { GoldQuote } from "@/lib/metal/board"

const UA =
    "Mozilla/5.0 (compatible; PersonaLink/1.0; +https://personalink.local) AppleWebKit/537.36"

function rupees(raw: string): number {
    return Number(raw.replace(/,/g, ""))
}

/**
 * GoodReturns city pages lead with:
 * "Today's gold price in Mumbai stands at **₹15,535** per gram for 24 karat gold …"
 */
export function parseGoodreturnsHtml(html: string): GoldRates | null {
    const text = html
        .replace(/&#x20b9;|&#8377;|&rupee;/gi, "₹")
        .replace(/&percnt;/gi, "%")
        .replace(/<[^>]+>/g, " ")
        .replace(/\*+/g, " ")
        .replace(/\s+/g, " ")
    const lead = text.match(
        /₹\s*([\d,]+)\s*\**\s*per gram for 24 karat[\s\S]{0,280}?₹\s*([\d,]+)\s*\**\s*per gram for 22 karat[\s\S]{0,280}?₹\s*([\d,]+)\s*\**\s*per gram for 18 karat/i,
    )
    if (lead) {
        const k24 = rupeesPerGramToPaisePer10g(rupees(lead[1]))
        const k22 = rupeesPerGramToPaisePer10g(rupees(lead[2]))
        const k18 = rupeesPerGramToPaisePer10g(rupees(lead[3]))
        if (k24 > 0 && k22 > 0 && k18 > 0) return { k24PaisePer10g: k24, k22PaisePer10g: k22, k18PaisePer10g: k18 }
    }
    return null
}

export async function fetchCityGoldRates(city: string): Promise<GoldQuote> {
    const slug = citySlug(city)
    const tried = slug === "india" ? ["india"] : [slug, "india"]
    let lastError = "Could not read city gold rates"
    for (const attempt of tried) {
        const url = goodreturnsUrl(attempt)
        try {
            const res = await fetch(url, {
                headers: { Accept: "text/html", "User-Agent": UA },
                cache: "no-store",
            })
            if (!res.ok) {
                lastError = `${url} → ${res.status}`
                continue
            }
            const html = await res.text()
            if (/page not found/i.test(html) && /cannot be found/i.test(html)) {
                lastError = `${url} missing`
                continue
            }
            const rates = parseGoodreturnsHtml(html)
            if (!rates) {
                lastError = `No 24K/22K/18K on ${url}`
                continue
            }
            const label = attempt === "india" ? "India" : city.trim() || "India"
            return {
                ...rates,
                fetchedAt: new Date().toISOString(),
                city: label,
                citySlug: attempt,
                sourcePage: url,
            }
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err)
        }
    }
    throw new Error(lastError)
}
