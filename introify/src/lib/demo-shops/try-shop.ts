import type { DemoShop } from "./types"
import { ARMONIA_LALPUR, RAGHUVANSHI_STORES } from "./shop"

/** Marketing showcase clone of Armonia — slug matches TRY_KITS try-shop (classic SHOP). */
export const TRY_SHOP: DemoShop = {
    ...ARMONIA_LALPUR,
    slug: "try-shop",
}

/** Marketing showcase clone of Raghuvanshi Stores — /try-store grocery storefront alias. */
export const TRY_STORE: DemoShop = {
    ...RAGHUVANSHI_STORES,
    slug: "try-store",
}

export const TRY_SHOP_SHOPS: DemoShop[] = [TRY_SHOP, TRY_STORE]

export const TRY_SHOP_SHOWCASE_SLUGS = ["try-shop", "try-store"] as const

export type TryShopShowcaseSlug = (typeof TRY_SHOP_SHOWCASE_SLUGS)[number]

export function isTryShopShowcaseSlug(slug?: string | null): slug is TryShopShowcaseSlug {
    return Boolean(slug && (TRY_SHOP_SHOWCASE_SLUGS as readonly string[]).includes(slug))
}

export function tryShopShopBySlug(slug?: string | null): DemoShop | undefined {
    if (!isTryShopShowcaseSlug(slug)) return undefined
    return TRY_SHOP_SHOPS.find((shop) => shop.slug === slug)
}
