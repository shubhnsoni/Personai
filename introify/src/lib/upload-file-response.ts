import type { FileHandle } from "node:fs/promises"
import { extname } from "node:path"
import { Readable } from "node:stream"
import { openStoredUploadFile, validUploadSegments } from "@/lib/uploads-storage"

// Match the upload endpoint's accepted formats. HTML, script and arbitrary SVG
// uploads are deliberately absent; generated payment QR SVGs are handled below.
const MEDIA_TYPES: Readonly<Record<string, string>> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".usdz": "model/vnd.usdz+zip",
}

function mediaType(segments: readonly string[]): string | undefined {
    const filename = segments[segments.length - 1]
    // These are written by ensureProfilePaymentQr, not accepted by /api/upload.
    if (segments.length === 1 && /^[a-z0-9][a-z0-9-]*-upi\.svg$/.test(filename)) return "image/svg+xml"
    return MEDIA_TYPES[extname(filename).toLowerCase()]
}

function errorResponse(status: number, extraHeaders?: HeadersInit): Response {
    const headers = new Headers(extraHeaders)
    headers.set("Cache-Control", "no-store")
    headers.set("X-Content-Type-Options", "nosniff")
    return new Response(null, { status, headers })
}

type ByteRange = { start: number; end: number }

function parseRange(value: string, size: number): ByteRange | "unsatisfiable" | null {
    // Only a single byte range is needed for media seeking. Ignore other units
    // and multipart ranges, as allowed by HTTP, and send the complete resource.
    if (!value.startsWith("bytes=") || value.includes(",")) return null
    const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
    if (!match || (!match[1] && !match[2])) return null
    if (!size) return "unsatisfiable"
    const first = match[1] ? Number(match[1]) : null
    const last = match[2] ? Number(match[2]) : null
    if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return "unsatisfiable"
    if (first === null) {
        if (!last) return "unsatisfiable"
        return { start: Math.max(0, size - last), end: size - 1 }
    }
    if (first >= size || (last !== null && last < first)) return "unsatisfiable"
    return { start: first, end: Math.min(last ?? size - 1, size - 1) }
}

function matchesEtag(value: string, etag: string): boolean {
    return value.split(",").some((candidate) => {
        const tag = candidate.trim()
        return tag === "*" || tag.replace(/^W\//, "") === etag.replace(/^W\//, "")
    })
}

function unmodifiedSince(value: string, modifiedAt: number): boolean {
    const date = Date.parse(value)
    return Number.isFinite(date) && Math.floor(modifiedAt / 1000) <= Math.floor(date / 1000)
}

/** Serve files created after Next's public-file inventory was collected. */
export async function serveUploadFile(request: Request, segments: readonly string[], uploadsDirectory: string | string[]): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return errorResponse(405, { Allow: "GET, HEAD" })
    if (!validUploadSegments(segments)) return errorResponse(404)
    const type = mediaType(segments)
    if (!type) return errorResponse(404)

    let file: FileHandle | undefined
    try {
        const opened = await openStoredUploadFile(segments, typeof uploadsDirectory === "string" ? [uploadsDirectory] : uploadsDirectory)
        file = opened.file
        const stat = opened.stat

        const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
        const headers = new Headers({
            "Content-Type": type,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "public, max-age=0, must-revalidate",
            "Last-Modified": stat.mtime.toUTCString(),
            ETag: etag,
            "Accept-Ranges": "bytes",
        })
        if (type === "model/vnd.usdz+zip") headers.set("Content-Disposition", `inline; filename="${segments[segments.length - 1]}"`)

        const ifNoneMatch = request.headers.get("if-none-match")
        const ifModifiedSince = request.headers.get("if-modified-since")
        if (ifNoneMatch !== null ? matchesEtag(ifNoneMatch, etag) : ifModifiedSince !== null && unmodifiedSince(ifModifiedSince, stat.mtimeMs)) {
            return new Response(null, { status: 304, headers })
        }

        let range: ByteRange | null = null
        const rangeHeader = request.headers.get("range")
        const ifRange = request.headers.get("if-range")
        // Our metadata ETag is weak, so If-Range may only match a date, not a tag.
        const canUseRange = ifRange === null || (!ifRange.startsWith('"') && !ifRange.startsWith("W/") && unmodifiedSince(ifRange, stat.mtimeMs))
        if (request.method === "GET" && rangeHeader && canUseRange) {
            const parsed = parseRange(rangeHeader, stat.size)
            if (parsed === "unsatisfiable") return errorResponse(416, { "Content-Range": `bytes */${stat.size}` })
            range = parsed
        }

        headers.set("Content-Length", String(range ? range.end - range.start + 1 : stat.size))
        if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`)
        if (request.method === "HEAD" || stat.size === 0) return new Response(null, { status: 200, headers })

        const stream = file.createReadStream({
            ...(range ?? {}),
            autoClose: true,
            signal: request.signal,
        })
        const response = new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
            status: range ? 206 : 200,
            headers,
        })
        file = undefined // The stream owns and closes the descriptor from here.
        return response
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        return errorResponse(["ENOENT", "ENOTDIR", "ELOOP", "EACCES", "EPERM"].includes(code ?? "") ? 404 : 500)
    } finally {
        await file?.close()
    }
}
