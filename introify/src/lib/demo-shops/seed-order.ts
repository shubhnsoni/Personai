const PRIORITY_SLUGS = [
    "neal",
    "aura-fitness-ranchi",
    "fit24-ranchi",
    "fitness-addiction-doranda",
    "churuwala-upper-bazar",
    "kaveri-main-road",
    "mk-jewellers",
    // EVENTS P1-4: reseed NLE/LC heroes before budget can skip them.
    "next-level-events-kanke",
    "lets-click-ratu-road",
]

export const FORCE_REFRESH_SLUGS = new Set([
    "neal",
    "aura-fitness-ranchi",
    "fit24-ranchi",
    "skydine-cafe",
    "churuwala-upper-bazar",
    // P1-1: drop accidental Bakery/Chocolate brownie leakage from SWEETS demo seed.
    "samriddhi-sweets",
    // P0-1: re-seed shop fixtures so cross-role food/home/people thumbs are cleared.
    "raghuvanshi-stores",
    "firayalal-nxt",
    "mk-jewellers",
    // Salon P1-2: clear mug/lamp/gift-box thumbs on H Square + Prince retail.
    "h-square-salon-harmu",
    "prince-barber-lalpur",
    // Gym P1-2: clear blu-cafe coffee/muffin + recycled tub/floor thumbs on gym retail.
    "fitness-addiction-doranda",
    // Clinic P1-2: clear cafe/desk/smoothie thumbs on Sanjivani MEDICINES.
    "sanjivani-medico",
    // EVENTS P1-4: clear leela/workshop/film/anika heroes on NLE + Let's Click.
    "next-level-events-kanke",
    "lets-click-ratu-road",
])

export function orderedDemoShops<T extends { slug: string }>(shops: T[]): T[] {
    const bySlug = new Map(shops.map((shop) => [shop.slug, shop]))
    const seen = new Set<string>()
    const out: T[] = []
    for (const slug of PRIORITY_SLUGS) {
        const shop = bySlug.get(slug)
        if (shop) {
            out.push(shop)
            seen.add(slug)
        }
    }
    const rest = shops.filter((shop) => !seen.has(shop.slug) && shop.slug !== "skydine-cafe")
    const sky = bySlug.get("skydine-cafe")
    return sky ? [...out, ...rest, sky] : [...out, ...rest]
}

export function catalogSize(shop: { products?: unknown[]; services?: unknown[] }) {
    return (shop.products?.length || 0) + (shop.services?.length || 0)
}

export function shouldSkipPopulated(
    shop: { slug?: string; products?: unknown[]; services?: unknown[] },
    productCount: number,
    serviceCount: number,
    replace: boolean,
) {
    if (replace) return false
    if (shop.slug && FORCE_REFRESH_SLUGS.has(shop.slug)) return false
    const expected = catalogSize(shop)
    if (expected <= 0) return false
    return productCount + serviceCount >= expected
}

export function seedBudgetMs(env: Record<string, string | undefined> = process.env) {
    const raw = env.INTROIFY_SEED_BUDGET_MS
    if (raw === undefined || raw === "") return 300_000
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 5_000) return 300_000
    return Math.min(n, 5 * 60_000)
}

export async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
    let index = 0
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (true) {
            const current = index
            index += 1
            if (current >= items.length) return
            await fn(items[current])
        }
    })
    await Promise.all(workers)
}