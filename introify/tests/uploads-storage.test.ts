// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { GET, HEAD } from "@/app/api/uploads/[...path]/route"
import { bundledUploadsDirectory, readUploadedFile, uploadReadDirectories, uploadsDirectory } from "@/lib/uploads-storage"

let fixture: string
let build: string
let persisted: string
let bundled: string

beforeEach(async () => {
    fixture = await mkdtemp(join(tmpdir(), "introify-storage-test-"))
    build = join(fixture, "build")
    persisted = join(fixture, "persisted")
    bundled = join(build, "public", "uploads")
    await mkdir(join(persisted, "owner"), { recursive: true })
    await mkdir(join(bundled, "owner"), { recursive: true })
    vi.spyOn(process, "cwd").mockReturnValue(build)
    vi.stubEnv("UPLOADS_DIR", persisted)
})

afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    expect(dirname(resolve(fixture))).toBe(resolve(tmpdir()))
    expect(basename(fixture).startsWith("introify-storage-test-")).toBe(true)
    await rm(fixture, { recursive: true, force: true })
})

function serve(path: string[], method = "GET", headers?: HeadersInit) {
    const request = new Request("https://example.test/api/uploads/file.png", { method, headers })
    return (method === "HEAD" ? HEAD : GET)(request, { params: Promise.resolve({ path }) })
}

describe("persistent upload storage", () => {
    it("defaults local reads and writes to a single bundled directory", () => {
        vi.stubEnv("UPLOADS_DIR", "")
        expect(uploadsDirectory()).toBe(bundled)
        expect(bundledUploadsDirectory()).toBe(bundled)
        expect(uploadReadDirectories()).toEqual([bundled])
    })

    it("resolves absolute or relative configuration explicitly", () => {
        expect(uploadsDirectory()).toBe(persisted)
        expect(uploadReadDirectories()).toEqual([persisted, bundled])
        vi.stubEnv("UPLOADS_DIR", " ../shared-uploads ")
        expect(uploadsDirectory()).toBe(join(fixture, "shared-uploads"))
    })

    it("serves persisted content ahead of the same bundled URL and reads it for AR", async () => {
        await writeFile(join(persisted, "owner", "photo.png"), "persisted image")
        await writeFile(join(bundled, "owner", "photo.png"), "old bundled image")
        const response = await serve(["owner", "photo.png"])
        expect(response.status).toBe(200)
        expect(await response.text()).toBe("persisted image")
        expect((await readUploadedFile(["owner", "photo.png"])).toString()).toBe("persisted image")
        const head = await serve(["owner", "photo.png"], "HEAD")
        expect(head.headers.get("content-length")).toBe("15")
        expect(await head.text()).toBe("")
    })

    it("falls back to committed demo assets without copying or rewriting them", async () => {
        await writeFile(join(bundled, "owner", "demo.glb"), "0123456789")
        const response = await serve(["owner", "demo.glb"], "GET", { Range: "bytes=2-4" })
        expect(response.status).toBe(206)
        expect(await response.text()).toBe("234")
        expect((await readUploadedFile(["owner", "demo.glb"])).toString()).toBe("0123456789")
    })

    it("serves bundled assets before the persistent directory has been created", async () => {
        vi.stubEnv("UPLOADS_DIR", join(fixture, "not-created-yet"))
        await writeFile(join(bundled, "demo.png"), "demo")
        expect(await (await serve(["demo.png"])).text()).toBe("demo")
        expect((await readUploadedFile(["demo.png"])).toString()).toBe("demo")
    })

    it("keeps assets accessible when the app deployment directory changes", async () => {
        await writeFile(join(persisted, "owner", "photo.png"), "survives deploy")
        vi.spyOn(process, "cwd").mockReturnValue(join(fixture, "next-deployment"))
        expect(uploadsDirectory()).toBe(persisted)
        expect(await (await serve(["owner", "photo.png"])).text()).toBe("survives deploy")
    })

    it("rejects traversal and symlink escapes through both route and AR reader", async () => {
        const outside = join(fixture, "private")
        await mkdir(outside)
        await writeFile(join(outside, "secret.png"), "private")
        await symlink(outside, join(persisted, "linked"), process.platform === "win32" ? "junction" : "dir")
        for (const path of [["..", "private", "secret.png"], ["linked", "secret.png"]]) {
            expect((await serve(path)).status).toBe(404)
            await expect(readUploadedFile(path)).rejects.toMatchObject({ code: "ENOENT" })
        }
    })
})
