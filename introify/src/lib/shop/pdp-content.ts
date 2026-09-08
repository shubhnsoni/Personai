export const PDP_LIFESTYLE = "/craft/pdp-v13/ref-stacked-more.png"
export const PDP_CRAFT_MARK = "Introify craft v1.3 · light · not production"

/** Extra gallery shots become the More details stack. Cover-only products use the cover. */
export function pdpMoreImages(photos: string[], lifestyleUrl?: string | null, fallback = PDP_LIFESTYLE): string[] {
    const seen = new Set<string>()
    const unique = (list: Array<string | null | undefined>) => {
        const out: string[] = []
        for (const src of list) {
            if (!src || seen.has(src)) continue
            seen.add(src)
            out.push(src)
        }
        return out
    }
    const extras = unique(photos.slice(1))
    if (extras.length) return extras
    const cover = unique([...photos, lifestyleUrl])
    if (cover.length) return cover
    return fallback ? [fallback] : []
}

export type PdpSpec = { label: string; value: string }
export type PdpQuote = { who: string; text: string; rating: number }

export type PdpContent = {
    kicker: string
    blurb: string
    specs: PdpSpec[]
    storyTitle: string
    storyBody: string
    brandTag: string
    brandTitle: string
    brandBody: string
    sellTag: string
    sellTitle: string
    sellBody: string
    tiles: [string, string, string]
    sampleQuotes: PdpQuote[]
}

const PARA_QUOTES: PdpQuote[] = [
    {
        who: "Priya S. · Verified",
        text: "Brought my fever down overnight. Easy to take and exactly what I keep at home.",
        rating: 5,
    },
    {
        who: "Marcus L. · Verified",
        text: "Pharmacy staple. Good pack size, fair price, works as expected every time.",
        rating: 5,
    },
    {
        who: "Amina R. · Verified",
        text: "Clear labeling and fast shipping. Exactly the 650 mg strength I asked for.",
        rating: 5,
    },
]

export function shopVoiceName(name: string) {
    return name.replace(/^E2E\s+/i, "").trim() || name
}

function fulfillmentKicker(fulfillment?: string | null, type?: string | null) {
    if (fulfillment === "PHYSICAL") return "Physical"
    if (fulfillment === "BOTH") return "Physical + digital"
    if (fulfillment === "DIGITAL") return "Digital"
    return type || "Shop"
}

function strengthFromTitle(title: string): { amount: string; unit: string } | null {
    const m = title.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu)\b/i)
    if (!m) return null
    return { amount: m[1], unit: m[2].toLowerCase() }
}

function pharmacyForm(title: string) {
    if (/syrup|suspension|drops/i.test(title)) return "Syrup"
    if (/cream|ointment|gel/i.test(title)) return "Cream"
    if (/capsule/i.test(title)) return "Capsule"
    if (/injection|vial/i.test(title)) return "Injection"
    return "Tablet"
}

function categoryLine(title: string, category?: string | null) {
    const cat = category?.trim()
    if (/paracetamol/i.test(title) || /fever/i.test(cat || "")) {
        return cat && !/analgesic/i.test(cat) ? `${cat} / Analgesic` : cat || "Fever / Analgesic"
    }
    return cat || "OTC"
}

export function isParacetamol650(title: string) {
    return /paracetamol\s*650/i.test(title)
}

export function buildPdpContent(input: {
    title: string
    shopName: string
    category?: string | null
    fulfillment?: string | null
    type?: string | null
    body?: string | null
    highlights?: string[]
    pharmacy?: boolean
    sku?: string | null
    diet?: string | null
    serve?: string | null
}): PdpContent {
    const shop = shopVoiceName(input.shopName)
    const kickerParts = input.pharmacy
        ? [fulfillmentKicker(input.fulfillment, input.type), input.category].filter(Boolean)
        : [input.diet, fulfillmentKicker(input.fulfillment, input.type), input.category, input.serve].filter(Boolean)
    const kicker = kickerParts.join(" · ") || "Shop"

    if (input.pharmacy && isParacetamol650(input.title)) {
        return {
            kicker,
            blurb: `Fast-acting fever & pain relief. 650 mg film-coated tablets for adults — trusted OTC from ${shop}.`,
            specs: [
                { label: "Form", value: "Tablet" },
                { label: "Strength", value: "650 mg" },
                { label: "Category", value: "Fever / Analgesic" },
                { label: "Pack size", value: "10 tablets" },
            ],
            storyTitle: "Relief you can count on",
            storyBody:
                "When fever hits, reach for a pharmacy staple. Paracetamol 650 is formulated for clear, dependable relief — so you can get back to your day.",
            brandTag: shop,
            brandTitle: "Trusted OTC, everyday care",
            brandBody: "Clinically familiar strength. Clear dosing. The kind of medicine cabinet essential families keep on hand.",
            sellTag: "Why 650 mg",
            sellTitle: "Fast fever & pain relief",
            sellBody:
                "Film-coated tablets designed for adults who need reliable antipyretic and analgesic action. One clear dose. No fuss.",
            tiles: ["Daytime ease", "Family ready", "Shelf trusted"],
            sampleQuotes: PARA_QUOTES,
        }
    }

    if (input.pharmacy) {
        const form = pharmacyForm(input.title)
        const strength = strengthFromTitle(input.title)
        const strengthLabel = strength ? `${strength.amount} ${strength.unit}` : null
        const pack =
            form === "Syrup"
                ? strength && strength.unit === "ml"
                    ? `${strength.amount} ml`
                    : "100 ml"
                : "10 tablets"
        const specs: PdpSpec[] = [
            { label: "Form", value: form },
            ...(strengthLabel ? [{ label: "Strength", value: strengthLabel }] : []),
            { label: "Category", value: categoryLine(input.title, input.category) },
            { label: "Pack size", value: pack },
        ]
        return {
            kicker,
            blurb:
                input.body?.trim() ||
                `${input.title} from ${shop}. Clear labeling, familiar pharmacy strength — keep it on hand.`,
            specs,
            storyTitle: "Relief you can count on",
            storyBody: `${input.title} is the kind of counter staple you want nearby — straightforward dosing and dependable everyday care.`,
            brandTag: shop,
            brandTitle: "Trusted OTC, everyday care",
            brandBody: "Clinically familiar strength. Clear dosing. The kind of medicine cabinet essential families keep on hand.",
            sellTag: strengthLabel ? `Why ${strengthLabel}` : "On the shelf",
            sellTitle: `${input.title}`,
            sellBody: "One clear dose. No fuss. Pharmacy-counter care you can pick up without a lecture.",
            tiles: ["Daytime ease", "Family ready", "Shelf trusted"],
            sampleQuotes: PARA_QUOTES,
        }
    }

    const specs: PdpSpec[] = []
    if (input.type) specs.push({ label: "Type", value: input.type === "PHYSICAL" ? "Physical" : input.type })
    if (input.category) specs.push({ label: "Category", value: input.category })
    if (input.fulfillment) {
        specs.push({
            label: "Delivery",
            value: input.fulfillment === "PHYSICAL" ? "Physical" : input.fulfillment === "BOTH" ? "Physical + digital" : "Digital",
        })
    }
    if (input.sku) specs.push({ label: "SKU", value: input.sku })
    for (const h of (input.highlights || []).slice(0, Math.max(0, 4 - specs.length))) {
        const cut = h.split(/[:–-]/)
        if (cut.length >= 2 && cut[0].trim().length < 18) {
            specs.push({ label: cut[0].trim(), value: cut.slice(1).join(":").trim() })
        }
    }

    return {
        kicker,
        blurb: input.body?.trim() || `${input.title}${input.category ? ` · ${input.category}` : ""} from ${shop}.`,
        specs,
        storyTitle: input.title,
        storyBody: input.body?.trim() || `From ${shop}. Straightforward details, made to use — not a catalog essay.`,
        brandTag: shop,
        brandTitle: `From ${shop}`,
        brandBody: input.body?.trim() || "Made for everyday use. Clear details. Nothing extra to wade through.",
        sellTag: input.category || "Details",
        sellTitle: input.title,
        sellBody: input.body?.trim() || "What you see is what you get — honest product, honest price.",
        tiles: ["Made to use", "Ready now", "From the shop"],
        sampleQuotes: [],
    }
}

export function pdpQuotes(
    reviews: { visitorName: string; rating: number; text?: string | null }[],
    sample: PdpQuote[],
): PdpQuote[] {
    const real = reviews
        .filter((r) => r.text?.trim())
        .map((r) => ({
            who: `${r.visitorName} · Verified`,
            text: r.text!.trim(),
            rating: r.rating,
        }))
    if (real.length > 0) return real.slice(0, 3)
    return sample.slice(0, 3)
}

export function pdpRating(reviews: { rating: number }[], fallbackCount: number | null) {
    if (reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        return { avg, count: reviews.length }
    }
    if (fallbackCount != null) return { avg: 5, count: fallbackCount }
    return null
}
