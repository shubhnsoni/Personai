// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { serveUploadFile } from "@/lib/upload-file-response"

let fixture: string
let uploads: string

beforeEach(async () => {
    fixture = await mkdtemp(join(tmpdir(), "personai-upload-route-"))
    uploads = join(fixture, "uploads")
    await mkdir(join(uploads, "owner"), { recursive: true })
})

afterEach(async () => {
    // Delete only the dedicated fixture created by this test, never real uploads.
    expect(dirname(resolve(fixture))).toBe(resolve(tmpdir()))
    expect(basename(fixture).startsWith("personai-upload-route-")).toBe(true)
    await rm(fixture, { recursive: true, force: true })
})

function request(segments: string[], options: RequestInit = {}) {
    return serveUploadFile(new Request("https://example.test/uploads/file", options), segments, uploads)
}

describe("runtime upload files", () => {
    it("finds files written after an earlier missing-file request", async () => {
        const missing = await request(["owner", "new.png"])
        expect(missing.status).toBe(404)
        expect(missing.headers.get("cache-control")).toBe("no-store")
        const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff])
        await writeFile(join(uploads, "owner", "new.png"), bytes)
        const response = await request(["owner", "new.png"])
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/png")
        expect(response.headers.get("content-length")).toBe(String(bytes.length))
        expect(response.headers.get("x-content-type-options")).toBe("nosniff")
        expect(response.headers.get("content-security-policy")).toContain("sandbox")
        expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    })

    it.each([
        ["photo.jpg", "image/jpeg"],
        ["photo.jpeg", "image/jpeg"],
        ["photo.WEBP", "image/webp"],
        ["photo.gif", "image/gif"],
        ["document.pdf", "application/pdf"],
        ["clip.mp4", "video/mp4"],
        ["clip.webm", "video/webm"],
        ["audio.mp3", "audio/mpeg"],
        ["audio.wav", "audio/wav"],
        ["dish-ar.glb", "model/gltf-binary"],
        ["dish.gltf", "model/gltf+json"],
        ["dish.ql.usdz", "model/vnd.usdz+zip"],
    ])("serves %s with its media type and HEAD metadata", async (filename, type) => {
        await writeFile(join(uploads, "owner", filename), "asset")
        const response = await request(["owner", filename], { method: "HEAD", headers: { Range: "bytes=1-2" } })
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe(type)
        expect(response.headers.get("content-length")).toBe("5")
        expect(await response.text()).toBe("")
        if (filename.endsWith(".usdz")) expect(response.headers.get("content-disposition")).toBe(`inline; filename="${filename}"`)
    })

    it("allows generated payment QR SVGs with a restrictive document policy", async () => {
        await writeFile(join(uploads, "cafe-one-upi.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>')
        const response = await request(["cafe-one-upi.svg"])
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("image/svg+xml")
        expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox")
        await response.arrayBuffer()
    })

    it.each(["page.html", "script.js", "data.json", "drawing.svg", "owner-upi.svg", "executable.exe"])("rejects non-allowlisted owner file %s", async (filename) => {
        await writeFile(join(uploads, "owner", filename), "blocked")
        expect((await request(["owner", filename])).status).toBe(404)
    })

    it.each([
        [], ["..", "outside.png"], ["."], [""], ["/outside.png"],
        ["owner/../outside.png"], ["owner\\outside.png"], ["C:\\outside.png"],
        ["C:outside.png"], ["file.png:stream"], ["file\u0000.png"],
        ["%2e%2e", "outside.png"], ["%252e%252e", "outside.png"],
        ["owner", "file.png."], ["CON.png"],
    ])("rejects unsafe path segments %j", async (...segments) => {
        expect((await request(segments as string[])).status).toBe(404)
    })

    it("rejects directories, missing roots, and unsupported methods", async () => {
        await mkdir(join(uploads, "directory.png"))
        expect((await request(["directory.png"])).status).toBe(404)
        const missing = await serveUploadFile(new Request("https://example.test"), ["photo.png"], join(fixture, "missing"))
        expect(missing.status).toBe(404)
        const post = await request(["photo.png"], { method: "POST" })
        expect(post.status).toBe(405)
        expect(post.headers.get("allow")).toBe("GET, HEAD")
    })

    it("rejects symlinked directories that escape the root, including sibling-prefix paths", async () => {
        const outside = join(fixture, "uploads-private")
        await mkdir(outside)
        await writeFile(join(outside, "secret.png"), "private")
        await symlink(outside, join(uploads, "linked"), process.platform === "win32" ? "junction" : "dir")
        expect((await request(["linked", "secret.png"])).status).toBe(404)
    })

    it("rejects an uploads root replaced by a symlink", async () => {
        const alias = join(fixture, "alias")
        await symlink(uploads, alias, process.platform === "win32" ? "junction" : "dir")
        await writeFile(join(uploads, "photo.png"), "image")
        const response = await serveUploadFile(new Request("https://example.test"), ["photo.png"], alias)
        expect(response.status).toBe(404)
    })

    it("revalidates with ETag and Last-Modified and gives ETag precedence", async () => {
        await writeFile(join(uploads, "photo.png"), "first")
        const first = await request(["photo.png"])
        const etag = first.headers.get("etag")!
        const modified = first.headers.get("last-modified")!
        expect(first.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
        await first.arrayBuffer()
        const unchanged = await request(["photo.png"], { headers: { "If-None-Match": etag } })
        expect(unchanged.status).toBe(304)
        expect(await unchanged.text()).toBe("")
        expect((await request(["photo.png"], { method: "HEAD", headers: { "If-Modified-Since": modified } })).status).toBe(304)
        expect((await request(["photo.png"], { method: "HEAD", headers: { "If-None-Match": '"other"', "If-Modified-Since": modified } })).status).toBe(200)
        await writeFile(join(uploads, "photo.png"), "changed content")
        const changed = await request(["photo.png"], { headers: { "If-None-Match": etag } })
        expect(changed.status).toBe(200)
        expect(await changed.text()).toBe("changed content")
    })

    it.each([
        ["bytes=2-5", "2345", "bytes 2-5/10"],
        ["bytes=7-", "789", "bytes 7-9/10"],
        ["bytes=-3", "789", "bytes 7-9/10"],
        ["bytes=8-99", "89", "bytes 8-9/10"],
    ])("streams %s for media seeking", async (range, expected, contentRange) => {
        await writeFile(join(uploads, "video.mp4"), "0123456789")
        const response = await request(["video.mp4"], { headers: { Range: range } })
        expect(response.status).toBe(206)
        expect(response.headers.get("content-range")).toBe(contentRange)
        expect(response.headers.get("content-length")).toBe(String(expected.length))
        expect(await response.text()).toBe(expected)
    })

    it.each(["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=999999999999999999999-"])("rejects unsatisfiable range %s", async (range) => {
        await writeFile(join(uploads, "video.mp4"), "0123456789")
        const response = await request(["video.mp4"], { headers: { Range: range } })
        expect(response.status).toBe(416)
        expect(response.headers.get("content-range")).toBe("bytes */10")
    })

    it("ignores multipart ranges and stale If-Range conditions", async () => {
        await writeFile(join(uploads, "dish.glb"), "0123456789")
        const headerCases: HeadersInit[] = [
            { Range: "bytes=0-1,4-5" },
            { Range: "bytes=0-1", "If-Range": "Wed, 01 Jan 2020 00:00:00 GMT" },
            { Range: "bytes=0-1", "If-Range": 'W/"old"' },
        ]
        for (const headers of headerCases) {
            const response = await request(["dish.glb"], { headers })
            expect(response.status).toBe(200)
            expect(await response.text()).toBe("0123456789")
        }
    })

    it("handles empty files without an invalid stream range", async () => {
        await writeFile(join(uploads, "empty.mp4"), "")
        const response = await request(["empty.mp4"])
        expect(response.status).toBe(200)
        expect(response.headers.get("content-length")).toBe("0")
        expect(await response.text()).toBe("")
        expect((await request(["empty.mp4"], { headers: { Range: "bytes=0-" } })).status).toBe(416)
    })
})
