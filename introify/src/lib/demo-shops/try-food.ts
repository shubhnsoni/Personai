import type { DemoShop } from "./types"
import { BAKERS_FRESH, KAVERI_RESTAURANT, SAMRIDDHI_SWEETS } from "./food"

/** Marketing showcase clone of Kaveri — slug matches TRY_KITS try-restaurant. */
export const TRY_RESTAURANT: DemoShop = {
    ...KAVERI_RESTAURANT,
    slug: "try-restaurant",
}

/** Marketing showcase clone of Baker's Fresh — slug matches TRY_KITS try-bakery. */
export const TRY_BAKERY: DemoShop = {
    ...BAKERS_FRESH,
    slug: "try-bakery",
}

/** Marketing showcase clone of Samriddhi Sweets — slug matches TRY_KITS try-sweets. */
export const TRY_SWEETS: DemoShop = {
    ...SAMRIDDHI_SWEETS,
    slug: "try-sweets",
}

export const TRY_FOOD_SHOPS: DemoShop[] = [TRY_RESTAURANT, TRY_BAKERY, TRY_SWEETS]

export const TRY_FOOD_SHOWCASE_SLUGS = ["try-restaurant", "try-bakery", "try-sweets"] as const

export type TryFoodShowcaseSlug = (typeof TRY_FOOD_SHOWCASE_SLUGS)[number]

export function isTryFoodShowcaseSlug(slug?: string | null): slug is TryFoodShowcaseSlug {
    return Boolean(slug && (TRY_FOOD_SHOWCASE_SLUGS as readonly string[]).includes(slug))
}

export function tryFoodShopBySlug(slug?: string | null): DemoShop | undefined {
    if (!isTryFoodShowcaseSlug(slug)) return undefined
    return TRY_FOOD_SHOPS.find((shop) => shop.slug === slug)
}
