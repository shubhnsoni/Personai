import { describe, expect, it } from "vitest"
import jpeg from "jpeg-js"
import { PNG } from "pngjs"
import { optimizeWebImage, WEB_IMAGE_MAX_EDGE } from "@/lib/optimize-image"

function makeJpeg(width: number, height: number, quality = 95): Buffer {
    const data = Buffer.alloc(width * height * 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            data[i] = (x * 17) % 256
            data[i + 1] = (y * 13) % 256
            data[i + 2] = 90
            data[i + 3] = 255
        }
    }
    return Buffer.from(jpeg.encode({ data, width, height }, quality).data)
}

function makePng(width: number, height: number, alpha = false): Buffer {
    const png = new PNG({ width, height })
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            png.data[i] = 40
            png.data[i + 1] = 180
            png.data[i + 2] = 90
            png.data[i + 3] = alpha && x < width / 2 ? 0 : 255
        }
    }
    return PNG.sync.write(png)
}

describe("optimizeWebImage", () => {
    it("resizes a large jpeg down to the web edge and shrinks the file", async () => {
        const src = makeJpeg(2400, 1600, 98)
        const out = await optimizeWebImage(src)
        expect(out).toBeTruthy()
        expect(out!.extension).toBe("jpg")
        expect(out!.mediaType).toBe("image/jpeg")
        expect(out!.bytes.length).toBeLessThan(src.length)
        const sharp = (await import("sharp")).default
        const meta = await sharp(out!.bytes).metadata()
        expect(Math.max(meta.width || 0, meta.height || 0)).toBe(WEB_IMAGE_MAX_EDGE)
    })

    it("does not enlarge a small jpeg", async () => {
        const src = makeJpeg(400, 300, 70)
        const out = await optimizeWebImage(src)
        if (!out) return
        const sharp = (await import("sharp")).default
        const meta = await sharp(out.bytes).metadata()
        expect(meta.width).toBeLessThanOrEqual(400)
        expect(meta.height).toBeLessThanOrEqual(300)
    })

    it("writes transparent pngs as webp", async () => {
        const src = makePng(1800, 1200, true)
        const out = await optimizeWebImage(src)
        expect(out).toBeTruthy()
        expect(out!.extension).toBe("webp")
        expect(out!.mediaType).toBe("image/webp")
        const sharp = (await import("sharp")).default
        const meta = await sharp(out!.bytes).metadata()
        expect(meta.hasAlpha).toBe(true)
        expect(Math.max(meta.width || 0, meta.height || 0)).toBe(WEB_IMAGE_MAX_EDGE)
    })
})
