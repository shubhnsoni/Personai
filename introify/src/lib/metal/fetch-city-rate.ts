import { citySlug, displayCity, goodreturnsUrl, TAPE_CITIES } from "@/lib/metal/city"
import { rupeesPerGramToPaisePer10g, type GoldRates } from "@/lib/metal/math"
import { orderTapeCities, type GoldQuote, type GoldTape, type GoldTapeCity } from "@/lib/metal/board"

const UA =
    "Mozilla/5.0 (compatible; Introify/1.0; +https://introify.com) AppleWebKit/537.36"

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

/**
 * "Indian Major Cities Gold Rates Today" table on the national GoodReturns page.
 * Amounts are ₹ / gram in 24K, 22K, 18K columns.
 */
export function parseMajorCitiesHtml(html: string): GoldTapeCity[] {
    const decoded = html.replace(/&#x20b9;|&#8377;|&rupee;/gi, "₹")
    const block =
        decoded.match(/major_cities_container[\s\S]*?<\/tbody>/i)?.[0]
        || decoded.match(/Indian Major Cities[\s\S]*?<\/tbody>/i)?.[0]
        || ""
    if (!block) return []
    const rows = block.match(/<tr[^>]*class="[^"]*city-row[^"]*"[\s\S]*?<\/tr>/gi) || []
    const cities: GoldTapeCity[] = []
    const seen = new Set<string>()
    for (const row of rows) {
        const title = row.match(/title="([^"]+)"/i)?.[1]
        const href = row.match(/href="([^"]+)"/i)?.[1]
        const hrefSlug = href?.match(/([a-z0-9-]+)\.html/i)?.[1]
        const label = (title || hrefSlug || "").trim()
        if (!label) continue
        const amounts = [...row.matchAll(/₹\s*([\d,]+)/g)].map((m) => rupees(m[1]))
        if (amounts.length < 3) continue
        const k24 = rupeesPerGramToPaisePer10g(amounts[0])
        const k22 = rupeesPerGramToPaisePer10g(amounts[1])
        const k18 = rupeesPerGramToPaisePer10g(amounts[2])
        if (k24 <= 0 || k22 <= 0 || k18 <= 0) continue
        const slug = citySlug(hrefSlug || label)
        if (!slug || seen.has(slug)) continue
        seen.add(slug)
        cities.push({
            city: displayCity(title || hrefSlug || label),
            citySlug: slug,
            k24PaisePer10g: k24,
            k22PaisePer10g: k22,
            k18PaisePer10g: k18,
        })
    }
    return cities
}

export async function fetchCityGoldRates(
    city: string,
    opts?: { fallbackIndia?: boolean; timeoutMs?: number },
): Promise<GoldQuote> {
    const slug = citySlug(city)
    const fallback = opts?.fallbackIndia !== false
    const tried = slug === "india" || !fallback ? [slug || "india"] : [slug, "india"]
    let lastError = "Could not read city gold rates"
    for (const attempt of tried) {
        const url = goodreturnsUrl(attempt)
        try {
            const res = await fetch(url, {
                headers: { Accept: "text/html", "User-Agent": UA },
                cache: "no-store",
                signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
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

function quoteToTapeCity(quote: GoldQuote): GoldTapeCity {
    return {
        city: quote.city,
        citySlug: quote.citySlug,
        k24PaisePer10g: quote.k24PaisePer10g,
        k22PaisePer10g: quote.k22PaisePer10g,
        k18PaisePer10g: quote.k18PaisePer10g,
    }
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R | null>): Promise<R[]> {
    const out: R[] = []
    let cursor = 0
    async function worker() {
        while (cursor < items.length) {
            const item = items[cursor++]
            const row = await fn(item)
            if (row) out.push(row)
        }
    }
    const n = Math.max(1, Math.min(limit, items.length))
    await Promise.all(Array.from({ length: n }, () => worker()))
    return out
}

/** One India-page table plus extra city pages. Cached on the gold board — not per visitor. */
export async function fetchCityTape(preferCity?: string | null): Promise<GoldTape> {
    const cities: GoldTapeCity[] = []
    const indiaUrl = goodreturnsUrl("india")
    try {
        const res = await fetch(indiaUrl, {
            headers: { Accept: "text/html", "User-Agent": UA },
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) {
            const html = await res.text()
            const india = parseGoodreturnsHtml(html)
            if (india) {
                cities.push({
                    city: "India",
                    citySlug: "india",
                    ...india,
                })
            }
            cities.push(...parseMajorCitiesHtml(html))
        }
    } catch {
        /* extras below may still fill the tape */
    }
    const have = new Set(cities.map((row) => row.citySlug))
    const missing = TAPE_CITIES.filter((name) => !have.has(citySlug(name)))
    const extras = await mapPool(missing, 4, async (name) => {
        try {
            const quote = await fetchCityGoldRates(name, { fallbackIndia: false, timeoutMs: 7_000 })
            return quoteToTapeCity(quote)
        } catch {
            return null
        }
    })
    const merged = orderTapeCities([...cities, ...extras], preferCity ? citySlug(preferCity) : null)
    if (merged.length === 0) throw new Error("Could not read city gold tape")
    return { fetchedAt: new Date().toISOString(), cities: merged }
}
