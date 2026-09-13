// @vitest-environment node
import { EventEmitter } from "node:events"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    lookup: vi.fn(),
    request: vi.fn(),
    seen: [] as Array<{ hostname: string; lookupResult: string | null }>,
}))

vi.mock("node:dns/promises", () => ({ default: { lookup: mocks.lookup }, lookup: mocks.lookup }))
vi.mock("node:http", () => ({ default: { request: mocks.request }, request: mocks.request }))
vi.mock("node:https", () => ({ default: { request: mocks.request }, request: mocks.request }))

import { collectProfileSources, discoverProfileLinks, isPublicIpv4, literalProfileLinks, normalizeProfileSourceUrl } from "@/lib/profile-import-sources"

function fakeResponse(status: number, body: string, headers: Record<string, string> = {}) {
    const response = new EventEmitter() as EventEmitter & {
        statusCode: number; headers: Record<string, string>; resume: () => void; destroy: () => void
    }
    response.statusCode = status
    response.headers = { "content-type": "text/html; charset=utf-8", ...headers }
    response.resume = () => {}
    response.destroy = () => { response.removeAllListeners() }
    return { response, body }
}

function serve(handler: (hostname: string) => { status: number; body?: string; chunks?: string[]; headers?: Record<string, string> } | { redirect: string; status?: number }) {
    mocks.request.mockImplementation((options: { hostname: string; lookup?: (h: string, o: unknown, cb: (e: null, a: string, f: number) => void) => void; signal?: AbortSignal }, callback: (res: unknown) => void) => {
        const request = new EventEmitter() as EventEmitter & { setTimeout: (n: number, cb: () => void) => void; destroy: (e?: Error) => void; end: () => void }
        request.setTimeout = () => {}
        request.destroy = () => {}
        request.end = () => {
            let pinned: string | null = null
            if (options.lookup) options.lookup(options.hostname, {}, (_e, a) => { pinned = a })
            mocks.seen.push({ hostname: options.hostname, lookupResult: pinned })
            const answer = handler(options.hostname)
            if ("redirect" in answer) {
                const { response } = fakeResponse(answer.status || 302, "", { location: answer.redirect })
                callback(response)
                return
            }
            const { response } = fakeResponse(answer.status, "", answer.headers)
            callback(response)
            const parts = "chunks" in answer && answer.chunks ? answer.chunks : [("body" in answer && answer.body) || ""]
            let i = 0
            const next = () => {
                if (i < parts.length) { response.emit("data", Buffer.from(parts[i++], "utf8")); setTimeout(next, 1) }
                else response.emit("end")
            }
            setTimeout(next, 1)
        }
        return request
    })
}

const page = (text: string, extra = "") => `<html><body><main>${text}${extra}</main></body></html>`

beforeEach(() => {
    vi.clearAllMocks()
    mocks.seen.length = 0
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
})

describe("normalizeProfileSourceUrl", () => {
    it("normalises bare hosts and rejects unsafe links", () => {
        expect(normalizeProfileSourceUrl("example.com/about")).toBe("https://example.com/about")
        expect(normalizeProfileSourceUrl("https://example.com/a#frag")).toBe("https://example.com/a")
        for (const bad of [
            "ftp://example.com", "https://user:pw@example.com", "https://example.com:8443/x",
            "http://127.0.0.1/", "http://10.0.0.4/", "https://localhost/", "https://printer.internal/",
            "https://192.168.1.1/", "notaurl",
        ]) {
            expect(() => normalizeProfileSourceUrl(bad)).toThrow()
        }
    })
    it("classifies public vs private IPv4", () => {
        expect(isPublicIpv4("93.184.216.34")).toBe(true)
        for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.1.1", "172.16.5.5", "192.168.0.1", "100.64.0.1", "224.0.0.1", "198.51.100.7", "0.1.2.3"]) {
            expect(isPublicIpv4(ip)).toBe(false)
        }
    })
})

describe("discoverProfileLinks", () => {
    it("finds rel=me anchors and Person JSON-LD sameAs but ignores nav", () => {
        const html = `
            <nav><a href="/about">About</a><a href="https://random-blog.example/post">Blog</a></nav>
            <a rel="me" href="https://mastodon.social/@ada">Mastodon</a>
            <a rel="me author" href="https://github.com/ada">GitHub</a>
            <script type="application/ld+json">{"@type":"Person","name":"Ada","sameAs":["https://www.linkedin.com/in/ada","https://unrelated.example/x"]}</script>`
        const found = discoverProfileLinks(html, "https://ada.dev/")
        expect(found).toContain("https://mastodon.social/@ada")
        expect(found).toContain("https://github.com/ada")
        expect(found).toContain("https://www.linkedin.com/in/ada")
        expect(found).not.toContain("https://unrelated.example/x")
        expect(found).not.toContain("https://random-blog.example/post")
        expect(found.some(u => u.includes("ada.dev/about"))).toBe(false)
    })
})

describe("collectProfileSources", () => {
    it("reads two links plus a paste into deterministic evidence ids", async () => {
        serve(host => ({ status: 200, body: page(`content from ${host}`) }))
        const result = await collectProfileSources({
            requestId: "r", discover: false,
            links: ["https://ada.dev/", "https://work.example.com/me"],
            text: "pasted profile text",
        })
        expect(result.evidence.map(e => e.id)).toEqual(["s1", "s2", "s3"])
        expect(result.evidence[0].text).toContain("ada.dev")
        expect(result.evidence[2].text).toContain("pasted profile text")
        expect(result.sources.filter(s => s.status === "read")).toHaveLength(3)
        expect(result.sources.find(s => s.url === null)?.label).toBe("Pasted text")
    })

    it("dedupes normalized links and rejects over-cap input", async () => {
        serve(() => ({ status: 200, body: page("hi") }))
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["ada.dev", "https://ada.dev/", "https://ada.dev/#x"], text: "" })
        expect(result.sources.filter(s => s.status === "read")).toHaveLength(1)
        expect(result.warnings.join(" ")).toMatch(/Duplicate/)
        await expect(collectProfileSources({ requestId: "r", discover: false, links: Array.from({ length: 6 }, (_, i) => `https://s${i}.example.com`), text: "" })).rejects.toThrow(/at most 5/)
        await expect(collectProfileSources({ requestId: "r", discover: false, links: [], text: "x".repeat(100_001) })).rejects.toThrow(/at most/)
    })

    it("pins the socket to the pre-validated public IP and rejects private DNS answers", async () => {
        serve(() => ({ status: 200, body: page("hello world") }))
        await collectProfileSources({ requestId: "r", discover: false, links: ["https://ada.dev"], text: "" })
        expect(mocks.seen[0].lookupResult).toBe("93.184.216.34")

        mocks.lookup.mockResolvedValue([{ address: "10.4.5.6", family: 4 }])
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://internal.example.com"], text: "fallback paste" })
        expect(result.sources.find(s => s.url === "https://internal.example.com/")?.status).toBe("failed")
        expect(result.evidence).toHaveLength(1)
        expect(result.evidence[0].text).toContain("fallback")
    })

    it("revalidates each redirect hop and refuses a private redirect target", async () => {
        mocks.lookup.mockImplementation(async (host: string) => host === "ada.dev" ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "169.254.169.254", family: 4 }])
        serve(host => host === "ada.dev" ? { redirect: "https://169.254.169.254/latest" } : { status: 200, body: page("meta") })
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://ada.dev"], text: "kept" })
        expect(result.sources.find(s => s.url === "https://ada.dev/")?.status).toBe("failed")
        expect(result.evidence[0].text).toContain("kept")
    })

    it("marks login-walled pages blocked and still uses the paste", async () => {
        serve(() => ({ status: 200, body: "<html><body>Sign in to continue. Security checkpoint captcha.</body></html>" }))
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://www.linkedin.com/in/ada"], text: "my pasted profile" })
        const linkedin = result.sources.find(s => s.url?.includes("linkedin"))
        expect(linkedin?.status).toBe("blocked")
        expect(linkedin?.warning).toMatch(/Paste/i)
        expect(result.evidence).toHaveLength(1)
        expect(result.evidence[0].id).toBe("s1")
    })

    it("surfaces discovered links as candidates without fetching or citing them", async () => {
        serve(() => ({ status: 200, body: page("about ada", `<a rel="me" href="https://github.com/ada">gh</a><a href="/contact">Contact</a>`) }))
        const result = await collectProfileSources({ requestId: "r", discover: true, links: ["https://ada.dev"], text: "" })
        const candidate = result.sources.find(s => s.status === "candidate")
        expect(candidate?.url).toBe("https://github.com/ada")
        expect(candidate?.discoveredFrom).toBe("https://ada.dev/")
        expect(result.evidence).toHaveLength(1)
        expect(mocks.seen.map(s => s.hostname)).toEqual(["ada.dev"])
    })

    it("clips large evidence fairly and warns", async () => {
        serve(() => ({ status: 200, body: page("y".repeat(60_000)) }))
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://ada.dev"], text: "z".repeat(60_000) })
        const total = result.evidence.reduce((n, e) => n + Buffer.byteLength(e.text, "utf8"), 0)
        expect(total).toBeLessThanOrEqual(48_000)
        expect(result.warnings.join(" ")).toMatch(/clipped/i)
    })

    it("fails without charging when nothing is usable", async () => {
        serve(() => ({ status: 500, body: "" }))
        await expect(collectProfileSources({ requestId: "r", discover: false, links: ["https://down.example.com"], text: "" })).rejects.toThrow(/No readable source/i)
    })

    it("aborts the stream the moment it exceeds 512KB", async () => {
        serve(() => ({ status: 200, chunks: ["z".repeat(400_000), "z".repeat(400_000), "never-sent"] }))
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://huge.example.com"], text: "kept" })
        expect(result.sources.find(s => s.url === "https://huge.example.com/")?.status).toBe("failed")
        expect(result.evidence[0].text).toContain("kept")
    })

    it("times out stuck DNS inside the shared 8s page budget", async () => {
        vi.useFakeTimers()
        try {
            mocks.lookup.mockReturnValue(new Promise(() => {}))
            const pending = collectProfileSources({ requestId: "r", discover: false, links: ["https://stuck.example.com"], text: "kept" })
            await vi.advanceTimersByTimeAsync(8_100)
            const result = await pending
            expect(result.sources.find(s => s.url === "https://stuck.example.com/")?.status).toBe("failed")
            expect(result.evidence[0].text).toContain("kept")
        } finally {
            vi.useRealTimers()
        }
    })

    it("keeps plain-text lines instead of stripping them as HTML", async () => {
        serve(() => ({ status: 200, body: "line one <notatag\nline two", headers: { "content-type": "text/plain" } }))
        const result = await collectProfileSources({ requestId: "r", discover: false, links: ["https://ada.dev"], text: "" })
        expect(result.evidence[0].text).toContain("line one <notatag")
        expect(result.evidence[0].text).toContain("line two")
    })

    it("exposes literal profile URLs found in pasted text for social binding", () => {
        const links = literalProfileLinks("Reach me at https://www.linkedin.com/in/ada or my site.")
        expect(links).toContain("https://www.linkedin.com/in/ada")
    })

    it("caps total discovery at 5 across all submitted pages", async () => {
        serve(() => ({
            status: 200,
            body: page("x", Array.from({ length: 8 }, (_, i) => `<a rel="me" href="https://github.com/u${i}">g</a>`).join("")),
        }))
        const result = await collectProfileSources({ requestId: "r", discover: true, links: ["https://a.example.com", "https://b.example.com"], text: "" })
        expect(result.sources.filter(s => s.status === "candidate")).toHaveLength(5)
    })
})
