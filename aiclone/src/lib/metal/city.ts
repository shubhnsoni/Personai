const ALIASES: Record<string, string> = {
    bengaluru: "bangalore",
    bangaluru: "bangalore",
    gurugram: "gurgaon",
    calcutta: "kolkata",
    bombay: "mumbai",
    madras: "chennai",
    trivandrum: "trivandrum",
    thiruvananthapuram: "trivandrum",
    vasai: "vasai-virar",
    "vasai virar": "vasai-virar",
    pondicherry: "pondicherry",
    puducherry: "pondicherry",
}

export function citySlug(name: string): string {
    const s = name
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    if (!s || s === "india" || s === "in") return "india"
    return ALIASES[s] || ALIASES[s.replace(/-/g, " ")] || s
}

export function displayCity(name: string): string {
    const slug = citySlug(name)
    if (slug === "india") return "India"
    return slug
        .split("-")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ")
}

export function goodreturnsUrl(slug: string): string {
    if (!slug || slug === "india") return "https://www.goodreturns.in/gold-rates/"
    return `https://www.goodreturns.in/gold-rates/${slug}.html`
}
