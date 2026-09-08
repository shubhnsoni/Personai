export const WEB_IMAGE_MAX_EDGE = 1600
export const WEB_JPEG_QUALITY = 82
export const WEB_WEBP_QUALITY = 80

export type OptimizedWebImage = {
    bytes: Buffer
    extension: "jpg" | "webp"
    mediaType: "image/jpeg" | "image/webp"
}

const RASTER = new Set(["jpeg", "png", "webp"])

export function isWebRasterKind(kind: string): boolean {
    return RASTER.has(kind)
}

export async function optimizeWebImage(bytes: Buffer): Promise<OptimizedWebImage | null> {
    if (bytes.length < 32) return null
    let sharp: typeof import("sharp")["default"]
    try {
        sharp = (await import("sharp")).default
    } catch {
        return null
    }
    try {
        const image = sharp(bytes, { failOn: "none", sequentialRead: true }).rotate()
        const meta = await image.metadata()
        const width = meta.width || 0
        const height = meta.height || 0
        if (width < 1 || height < 1) return null
        const needsResize = Math.max(width, height) > WEB_IMAGE_MAX_EDGE
        const needsOrient = Boolean(meta.orientation && meta.orientation !== 1)
        const pipeline = needsResize
            ? image.resize({
                width: WEB_IMAGE_MAX_EDGE,
                height: WEB_IMAGE_MAX_EDGE,
                fit: "inside",
                withoutEnlargement: true,
            })
            : image
        const hasAlpha = Boolean(meta.hasAlpha)
        const out = hasAlpha
            ? await pipeline.webp({ quality: WEB_WEBP_QUALITY, effort: 4 }).toBuffer()
            : await pipeline.jpeg({ quality: WEB_JPEG_QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer()
        if (!needsResize && !needsOrient && out.length >= bytes.length) return null
        return hasAlpha
            ? { bytes: out, extension: "webp", mediaType: "image/webp" }
            : { bytes: out, extension: "jpg", mediaType: "image/jpeg" }
    } catch {
        return null
    }
}
