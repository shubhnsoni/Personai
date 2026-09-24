// @vitest-environment node
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
    AUTO_PARTS_LEAKED_PRODUCT_IMAGE_MARKERS,
    PARAS_AUTO_IMAGE_FILES,
    PARAS_AUTO_PRODUCT_IMAGES,
    PARAS_AUTO_UPLOAD_PREFIX,
    isLeakedAutoPartsProductImage,
    isParasAutoProductImage,
    parasAutoProductImage,
} from "@/lib/autoparts/auto-parts-imagery"
import { PARAS_AUTO } from "@/lib/demo-shops/shop"
import { FORCE_REFRESH_SLUGS, shouldSkipPopulated } from "@/lib/demo-shops/seed-order"
import {
    isCrossRoleShopProductImage,
    resolveShopProductImage,
} from "@/lib/shop-product-imagery"

const root = process.cwd()

describe("AUTO P0-2 - Paras catalogue product photography", () => {
    it("ships auto-parts JPG assets on disk for every primary SKU", () => {
        expect(PARAS_AUTO_IMAGE_FILES.length).toBe(10)
        for (const file of PARAS_AUTO_IMAGE_FILES) {
            expect(existsSync(join(root, "public/uploads/paras-auto", file))).toBe(true)
        }
    })

    it("maps every Paras catalogue SKU to /uploads/paras-auto/*.jpg (not lamp/mug bleed)", () => {
        expect(PARAS_AUTO.slug).toBe("paras-auto")
        expect(PARAS_AUTO.flavor).toBe("AUTO_PARTS")
        expect(PARAS_AUTO.products?.length).toBeGreaterThanOrEqual(10)
        for (const product of PARAS_AUTO.products || []) {
            expect(product.sku).toBeTruthy()
            const mapped = parasAutoProductImage(product.sku!)
            expect(mapped).toBeTruthy()
            expect(product.thumbnailUrl).toBe(mapped)
            expect(isParasAutoProductImage(product.thumbnailUrl)).toBe(true)
            expect(product.thumbnailUrl!.startsWith(PARAS_AUTO_UPLOAD_PREFIX)).toBe(true)
            expect(isLeakedAutoPartsProductImage(product.thumbnailUrl)).toBe(false)
            expect(isCrossRoleShopProductImage(product.thumbnailUrl)).toBe(false)
            expect(
                resolveShopProductImage({
                    role: PARAS_AUTO.flavor,
                    thumbnailUrl: product.thumbnailUrl,
                }),
            ).toBe(product.thumbnailUrl)
        }
        expect(Object.keys(PARAS_AUTO_PRODUCT_IMAGES).sort()).toEqual(
            (PARAS_AUTO.products || []).map((p) => p.sku).sort(),
        )
    })

    it("keeps cafe/home/brand/lassi stock banned for auto-parts product art", () => {
        expect(AUTO_PARTS_LEAKED_PRODUCT_IMAGE_MARKERS).toEqual(
            expect.arrayContaining([
                "try-lamp",
                "try-mug",
                "try-tote",
                "try-storefront",
                "try-brand",
                "try-lassi",
                "blu-cafe",
                "skydine-cafe",
            ]),
        )
        expect(isLeakedAutoPartsProductImage("/uploads/try-lamp.jpg")).toBe(true)
        expect(isLeakedAutoPartsProductImage("/uploads/try-mug.jpg")).toBe(true)
        expect(isLeakedAutoPartsProductImage("/uploads/try-lassi.jpg")).toBe(true)
        expect(isLeakedAutoPartsProductImage("/uploads/try-storefront.jpg")).toBe(true)
        expect(isLeakedAutoPartsProductImage("/uploads/paras-auto/brake-pad.jpg")).toBe(false)
        expect(isLeakedAutoPartsProductImage(null)).toBe(false)
        expect(
            resolveShopProductImage({
                role: "AUTO_PARTS",
                thumbnailUrl: "/uploads/try-lamp.jpg",
            }),
        ).toBeNull()
    })

    it("force-refreshes paras-auto so catalogue thumbs reseed on bootstrap", () => {
        expect(FORCE_REFRESH_SLUGS.has("paras-auto")).toBe(true)
        expect(
            shouldSkipPopulated({ slug: "paras-auto", products: [{}, {}], services: [] }, 10, 0, false),
        ).toBe(false)
    })
})
