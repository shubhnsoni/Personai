import dns from "node:dns/promises"
import http from "node:http"
import https from "node:https"
import { extractPageText } from "@/lib/import-extract"
import { clipUtf8 } from "@/lib/ai-runtime"
import { PROFILE_IMPORT_POLICY, type ProfileImportInput, type ProfileImportSource } from "@/lib/profile-import-contract"

export type ProfileImportEvidence = { id: string; url: string | null; text: string }
export type CollectedSources = { sources: ProfileImportSource[]; evidence: ProfileImportEvidence[]; warnings: string[] }

const MAX_REDIRECTS = 3
const CONCURRENCY = 2

const PROFILE_HOSTS = [
    "linkedin.com", "instagram.com", "facebook.com", "fb.com", "fb.me",
    "x.com", "twitter.com", "youtube.com", "youtu.be", "github.com",
    "threads.net", "tiktok.com", "medium.com", "substack.com",
    "behance.net", "dribbble.com", "mastodon.social", "bsky.app",
    "scholar.google.com", "orcid.org", "stackoverflow.com", "linktr.ee",
]

const BLOCKED_TLDS = ["localhost", "local", "internal", "intranet", "corp", "lan", "home", "test", "invalid"]

function hostMatches(hostname: string, host: string) {
    return hostname === host || hostname.endsWith(`.${host}`)
}

export function isPublicIpv4(address: string): boolean {
    const octets = address.split('.')
    if (octets.length !== 4 || octets.some(value => !/^\d{1,3}$/.test(value))) return false
    const [a, b, c, d] = octets.map(Number)
    if ([a, b, c, d].some(value => value > 255)) return false
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113))
}

export function normalizeProfileSourceUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length > 2048) throw new Error("Invalid link.")
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
    let url: URL
    try { url = new URL(withScheme) } catch { throw new Error("Invalid link.") }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links can be imported.")
    if (url.username || url.password) throw new Error("Links with credentials cannot be imported.")
    if (url.port) throw new Error("Links with custom ports cannot be imported.")
    const hostname = url.hostname.toLowerCase()
    if (!hostname.includes(".") || hostname.endsWith(".")) throw new Error("Only public links can be imported.")
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[") || hostname.includes(":")) throw new Error("IP address links cannot be imported.")
    const tld = hostname.split(".").pop() || ""
    if (BLOCKED_TLDS.includes(tld)) throw new Error("Only public links can be imported.")
    url.hash = ""
    return url.toString()
}

async function resolvePublicIpv4(hostname: string, signal: AbortSignal): Promise<string> {
    const results = await Promise.race([
        dns.lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_resolve, reject) => {
            const onAbort = () => reject(new Error("page_timeout"))
            if (signal.aborted) onAbort()
            else signal.addEventListener("abort", onAbort, { once: true })
        }),
    ])

    const v4 = results.filter(result => result.family === 4)
    if (v4.some(result => !isPublicIpv4(result.address))) throw new Error("That link resolves to a private address.")
    const address = v4[0]?.address
    if (!address) throw new Error("That link does not resolve to a public address.")
    return address
}

type FetchedPage = { url: string; body: string; status: number; contentType: string }

function requestPinned(url: URL, address: string, signal: AbortSignal): Promise<FetchedPage & { redirectTo?: string }> {
    return new Promise((resolve, reject) => {
        let settled = false
        const done = (fn: () => void) => {
            if (settled) return
            settled = true
            signal.removeEventListener("abort", onAbort)
            fn()
        }
        const onAbort = () => done(() => { request.destroy(); reject(new Error("page_timeout")) })
        const transport = url.protocol === "http:" ? http : https
        const request = transport.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: "GET",
            family: 4,
            agent: false,
            lookup: (_host, _options, callback) => callback(null, address, 4),
            headers: {
                "user-agent": "IntroifyProfileImport/1.0",
                accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
            },
            signal,
        }, (response) => {
            const status = response.statusCode || 0
            const location = response.headers.location
            if (status >= 300 && status < 400 && location) {
                response.destroy()
                done(() => resolve({ url: url.toString(), body: "", status, contentType: "", redirectTo: location }))
                return
            }
            const contentType = String(response.headers["content-type"] || "")
            const chunks: Buffer[] = []
            let received = 0
            response.on("data", (chunk: Buffer) => {
                received += chunk.length
                if (received > PROFILE_IMPORT_POLICY.pageBytes) {
                    done(() => { response.destroy(); request.destroy(); reject(new Error("page_too_large")) })
                    return
                }
                chunks.push(chunk)
            })
            response.on("end", () => done(() => resolve({ url: url.toString(), body: Buffer.concat(chunks).toString("utf8"), status, contentType })))
            response.on("error", (error) => done(() => reject(error)))
        })
        signal.addEventListener("abort", onAbort, { once: true })
        request.on("error", (error) => done(() => reject(error)))
        request.end()
    })
}

async function fetchPublicPage(rawUrl: string): Promise<FetchedPage> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROFILE_IMPORT_POLICY.pageTimeoutMs)
    try {
        let current = new URL(rawUrl)
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const address = await resolvePublicIpv4(current.hostname, controller.signal)
            const page = await requestPinned(current, address, controller.signal)
            if (!page.redirectTo) return page
            if (hop === MAX_REDIRECTS) break
            current = new URL(normalizeProfileSourceUrl(new URL(page.redirectTo, current).toString()))
        }
        throw new Error("Too many redirects.")
    } finally {
        clearTimeout(timer)
    }
}

function looksBlocked(page: FetchedPage): boolean {
    if ([401, 402, 403, 407, 429, 999].includes(page.status)) return true
    return /captcha|authwall|checkpoint|sign in to continue|log in to continue|verify you are|are you a robot/i.test(page.body.slice(0, 4000))
}

function readablePage(page: FetchedPage): boolean {
    if (page.status < 200 || page.status >= 300) return false
    if (!page.contentType) return true
    return /text\/html|text\/plain|application\/xhtml/i.test(page.contentType)
}

export function pageText(page: FetchedPage, max: number): string {
    if (/text\/plain/i.test(page.contentType)) {
        return page.body.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    }
    return extractPageText(page.body, max)
}

function anchorAttribute(tag: string, name: string): string | null {
    const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"))
    return match ? match[1] : null
}

function isProfileUrl(raw: string, baseUrl: string): string | null {
    try {
        const normalized = normalizeProfileSourceUrl(new URL(raw, baseUrl).toString())
        const hostname = new URL(normalized).hostname.toLowerCase()
        return PROFILE_HOSTS.some(host => hostMatches(hostname, host)) ? normalized : null
    } catch {
        return null
    }
}

function* personNodes(parsed: unknown): Generator<Record<string, unknown>> {
    const nodes = Array.isArray(parsed) ? parsed : [parsed]
    for (const node of nodes) {
        if (!node || typeof node !== "object") continue
        const record = node as Record<string, unknown>
        yield record
        const graph = record["@graph"]
        if (Array.isArray(graph)) for (const entry of graph) if (entry && typeof entry === "object") yield entry as Record<string, unknown>
    }
}

function isPersonNode(record: Record<string, unknown>): boolean {
    const type = record["@type"]
    return type === "Person" || (Array.isArray(type) && type.includes("Person"))
}

export function discoverProfileLinks(html: string, baseUrl: string): string[] {
    const found = new Set<string>()
    const add = (raw: string | null | undefined) => {
        if (!raw || found.size >= PROFILE_IMPORT_POLICY.maxDiscoveredLinks) return
        const url = isProfileUrl(raw, baseUrl)
        if (url) found.add(url)
    }
    for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
        const tag = match[0]
        const rel = anchorAttribute(tag, "rel")
        if (!rel || !/(^|\s)me(\s|$)/i.test(rel)) continue
        add(anchorAttribute(tag, "href"))
    }
    for (const match of html.matchAll(/<script\b[^>]*?type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            for (const node of personNodes(JSON.parse(match[1]))) {
                if (!isPersonNode(node) || !Array.isArray(node.sameAs)) continue
                for (const link of node.sameAs) if (typeof link === "string") add(link)
            }
        } catch { }
    }
    return [...found].slice(0, PROFILE_IMPORT_POLICY.maxDiscoveredLinks)
}

export function literalProfileLinks(text: string): string[] {
    const found = new Set<string>()
    for (const match of text.matchAll(/https?:\/\/[^\s<>"'()]+/gi)) {
        const url = isProfileUrl(match[0].replace(/[.,;:!?\]]+$/, ""), "https://paste.invalid/")
        if (url) found.add(url)
        if (found.size >= PROFILE_IMPORT_POLICY.maxDiscoveredLinks) break
    }
    return [...found]
}

async function mapPool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length) as R[]
    let index = 0
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (index < items.length) {
            const current = index++
            results[current] = await work(items[current])
        }
    }))
    return results
}

function labelFor(url: string | null): string {
    if (!url) return "Pasted text"
    try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url }
}

export async function collectProfileSources(input: ProfileImportInput): Promise<CollectedSources> {
    const warnings: string[] = []
    const rawLinks = (input.links || []).map(link => link.trim()).filter(Boolean)
    const text = input.text || ""
    if (rawLinks.length > PROFILE_IMPORT_POLICY.maxLinks) throw new Error(`Add at most ${PROFILE_IMPORT_POLICY.maxLinks} links.`)
    if (text.length > PROFILE_IMPORT_POLICY.maxTextCharacters) throw new Error(`Paste at most ${PROFILE_IMPORT_POLICY.maxTextCharacters.toLocaleString()} characters.`)

    const links: string[] = []
    for (const raw of rawLinks) {
        try {
            const normalized = normalizeProfileSourceUrl(raw)
            if (!links.includes(normalized)) links.push(normalized)
            else warnings.push(`Duplicate link skipped: ${normalized}`)
        } catch {
            warnings.push(`Link skipped: ${raw.slice(0, 120)} is not a public http(s) page.`)
        }
    }

    const sources: ProfileImportSource[] = []
    const pages = await mapPool(links, CONCURRENCY, async (link) => {
        try {
            const page = await fetchPublicPage(link)
            if (looksBlocked(page)) {
                return { source: { id: "", label: labelFor(link), url: link, status: "blocked" as const, discoveredFrom: null, warning: "This page asks visitors to log in or pass a check. Paste the page text instead." }, page: null }
            }
            if (!readablePage(page)) {
                return { source: { id: "", label: labelFor(link), url: link, status: "failed" as const, discoveredFrom: null, warning: `That page returned ${page.status || "an unreadable response"}. Paste the text instead.` }, page: null }
            }
            return { source: { id: "", label: labelFor(link), url: link, status: "read" as const, discoveredFrom: null, warning: null }, page }
        } catch {
            return { source: { id: "", label: labelFor(link), url: link, status: "failed" as const, discoveredFrom: null, warning: "Could not read that page. Paste the text instead." }, page: null }
        }
    })

    const discovered = new Set<string>()
    for (const { source, page } of pages) {
        sources.push(source)
        if (!page || !input.discover || discovered.size >= PROFILE_IMPORT_POLICY.maxDiscoveredLinks) continue
        for (const link of discoverProfileLinks(page.body, page.url)) {
            if (links.includes(link) || discovered.has(link) || discovered.size >= PROFILE_IMPORT_POLICY.maxDiscoveredLinks) continue
            discovered.add(link)
            sources.push({ id: "", label: labelFor(link), url: link, status: "candidate", discoveredFrom: page.url, warning: null })
        }
    }

    const readable = pages.filter(entry => entry.page && entry.source.status === "read")
    const evidenceCount = readable.length + (text.trim() ? 1 : 0)
    const evidence: ProfileImportEvidence[] = []
    if (evidenceCount) {
        const share = Math.floor(PROFILE_IMPORT_POLICY.maxSourceBytes / evidenceCount)
        let clipped = false
        const push = (body: string, url: string | null, source?: ProfileImportSource) => {
            const clippedText = clipUtf8(body, share)
            if (Buffer.byteLength(body, "utf8") > share) clipped = true
            if (!clippedText.trim()) {
                if (source) {
                    source.status = "failed"
                    source.warning = "That page had no readable text. Paste the text instead."
                }
                return
            }
            const id = `s${evidence.length + 1}`
            evidence.push({ id, url, text: clippedText })
            if (source) source.id = id
        }
        for (const { source, page } of readable) push(pageText(page!, PROFILE_IMPORT_POLICY.pageBytes), source.url, source)
        if (text.trim()) {
            const before = evidence.length
            push(text, null)
            if (evidence.length > before) {
                sources.push({ id: evidence[evidence.length - 1].id, label: "Pasted text", url: null, status: "read", discoveredFrom: null, warning: null })
            }
        }
        if (clipped) warnings.push("Some source text was clipped to fit the generation budget.")
    }

    for (const [index, source] of sources.entries()) {
        if (!source.id) source.id = `x${index + 1}`
    }

    if (!evidence.length) throw new Error("No readable source material. Paste your profile text or add a public link that loads without a login.")
    return { sources, evidence, warnings }
}
