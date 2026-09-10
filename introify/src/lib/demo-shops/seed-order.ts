const PRIORITY_SLUGS = [
    "aura-fitness-ranchi",
    "fit24-ranchi",
    "fitness-addiction-doranda",
    "kaveri-main-road",
    "mk-jewellers",
]

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
    shop: { products?: unknown[]; services?: unknown[] },
    productCount: number,
    serviceCount: number,
    replace: boolean,
) {
    if (replace) return false
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
