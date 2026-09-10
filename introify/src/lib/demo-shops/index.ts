import { TRY_KITS } from "@/lib/try-kits"
import type { DemoShop } from "./types"
import { FOOD_SHOPS } from "./food"
import { SHOP_SHOPS } from "./shop"
import { BOOK_SHOPS } from "./book"
import { FIELD_SHOPS } from "./field"
import { TEACH_SHOPS } from "./teach"
import { STUDIO_SHOPS } from "./studio"

export const DEMO_SHOPS: DemoShop[] = [
    ...FOOD_SHOPS,
    ...SHOP_SHOPS,
    ...BOOK_SHOPS,
    ...FIELD_SHOPS,
    ...TEACH_SHOPS,
    ...STUDIO_SHOPS,
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
