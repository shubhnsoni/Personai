// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    JEWELRY_LEAKED_PRODUCT_IMAGE_MARKERS,
    MK_JEWELLERY_IMAGE_FILES,
    MK_JEWELLERY_PRODUCT_IMAGES,
    MK_JEWELLERY_UPLOAD_PREFIX,
    isLeakedJewelryProductImage,
    isMkJewelleryProductImage,
    mkJewelleryProductImage,
} from "@/lib/metal/jewelry-imagery"
import { MK_JEWELLERS } from "@/lib/demo-shops/shop"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"
import {
    isCrossRoleShopProductImage,
    resolveShopProductImage,
} from "@/lib/shop-product-imagery"

const root = process.cwd()

describe("JEWELRY P1-2 - MK catalogue product photography", () => {
    it("ships jewellery-class JPG assets on disk for every primary SKU", () => {
        expect(MK_JEWELLERY_IMAGE_FILES.length).toBe(10)
        for (const file of MK_JEWELLERY_IMAGE_FILES) {
            expect(existsSync(join(root, "public/uploads/mk-jewellers", file))).toBe(true)
        }
    })

    it("maps every MK catalogue SKU to /uploads/mk-jewellers/*.jpg (not PHYSICAL null)", () => {
        expect(MK_JEWELLERS.slug).toBe("mk-jewellers")
        expect(MK_JEWELLERS.flavor).toBe("JEWELRY_RETAIL")
        expect(MK_JEWELLERS.products?.length).toBeGreaterThanOrEqual(10)
        for (const product of MK_JEWELLERS.products || []) {
            expect(product.sku).toBeTruthy()
            const mapped = mkJewelleryProductImage(product.sku!)
            expect(mapped).toBeTruthy()
            expect(product.thumbnailUrl).toBe(mapped)
            expect(isMkJewelleryProductImage(product.thumbnailUrl)).toBe(true)
            expect(product.thumbnailUrl!.startsWith(MK_JEWELLERY_UPLOAD_PREFIX)).toBe(true)
            expect(isLeakedJewelryProductImage(product.thumbnailUrl)).toBe(false)
            expect(isCrossRoleShopProductImage(product.thumbnailUrl)).toBe(false)
            expect(
                resolveShopProductImage({
                    role: MK_JEWELLERS.flavor,
                    thumbnailUrl: product.thumbnailUrl,
                }),
            ).toBe(product.thumbnailUrl)
        }
        expect(Object.keys(MK_JEWELLERY_PRODUCT_IMAGES).sort()).toEqual(
            (MK_JEWELLERS.products || []).map((p) => p.sku).sort(),
        )
    })

    it("keeps cafe/home/people stock banned for jewellery product art", () => {
        expect(JEWELRY_LEAKED_PRODUCT_IMAGE_MARKERS).toEqual(
            expect.arrayContaining(["try-mira", "try-brand", "try-lamp", "blu-cafe", "skydine-cafe"]),
        )
        expect(isLeakedJewelryProductImage("/uploads/try-mira.jpg")).toBe(true)
        expect(isLeakedJewelryProductImage("/uploads/try-lamp.jpg")).toBe(true)
        expect(isLeakedJewelryProductImage("/uploads/mk-jewellers/mangalsutra.jpg")).toBe(false)
        expect(isLeakedJewelryProductImage(null)).toBe(false)
    })

    it("force-refreshes mk-jewellers so catalogue thumbs reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("mk-jewellers")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "mk-jewellers", products: [{}, {}], services: [] }, 10, 0, false),
        ).toBe(false)
    })
})
