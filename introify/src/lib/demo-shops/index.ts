import { TRY_KITS } from "@/lib/try-kits"
import type { DemoShop } from "./types"
import { FOOD_SHOPS as BASE_FOOD_SHOPS } from "./food"
import { TRY_FOOD_SHOPS } from "./try-food"
import { SHOP_SHOPS } from "./shop"
import { BOOK_SHOPS } from "./book"
import { FIELD_SHOPS } from "./field"
import { TEACH_SHOPS } from "./teach"
import { STUDIO_SHOPS } from "./studio"
import { STAY_SHOPS } from "./stay"
import { NILESH_KUMAR } from "./neal"

/** Base food demos plus try-* showcase clones (try-restaurant, try-bakery). */
export const FOOD_SHOPS: DemoShop[] = [...BASE_FOOD_SHOPS, ...TRY_FOOD_SHOPS]

export const DEMO_SHOPS: DemoShop[] = [
    ...FOOD_SHOPS,
    ...STAY_SHOPS,
    ...SHOP_SHOPS,
    ...BOOK_SHOPS,
    ...FIELD_SHOPS,
    ...TEACH_SHOPS,
    ...STUDIO_SHOPS,
    NILESH_KUMAR,
]

export function demoShopByFlavor(flavor?: string | null): DemoShop | undefined {
    if (!flavor) return undefined
    return DEMO_SHOPS.find((shop) => shop.flavor === flavor)
}

export function demoShopBySlug(slug?: string | null): DemoShop | undefined {
    if (!slug) return undefined
    return DEMO_SHOPS.find((shop) => shop.slug === slug)
}

export function missingTryKitFlavors() {
    return TRY_KITS.filter((kit) => !demoShopByFlavor(kit.role)).map((kit) => kit.role)
}
