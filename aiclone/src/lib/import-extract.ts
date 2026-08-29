import zlib from "zlib"

export type ImportKind =
    | "profile"
    | "experience"
    | "project"
    | "service"
    | "product"
    | "course"
    | "event"
    | "community"
    | "leadMagnet"
    | "knowledge"

export type ImportSourceKind = "text" | "pdf" | "csv" | "ics" | "url" | "youtube"

export type CourseLessonDraft = {
    title: string
    durationMinutes: number
    isFree: boolean
    contentType: "TEXT" | "VIDEO" | "PDF"
}

export type CourseModuleDraft = {
    title: string
    description?: string
    lessons: CourseLessonDraft[]
}

export type ImportFields = {
    displayName?: string
    headline?: string
    bio?: string
    overwrite?: boolean
    company?: string
    role?: string
    startDate?: string
    endDate?: string
    description?: string
    year?: string
    client?: string
    link?: string
    price?: number
    durationMinutes?: number
    productType?: "PDF" | "VIDEO" | "AUDIO" | "OTHER"
    fileUrl?: string
    thumbnailUrl?: string
    category?: string
    diet?: string
    spiceLevel?: number
    fulfillment?: "DIGITAL" | "PHYSICAL" | "BOTH"
    url?: string
    modules?: CourseModuleDraft[]
    startTime?: string
    endTime?: string
    timezone?: string
    location?: string
    meetingUrl?: string
    eventType?: "WEBINAR" | "WORKSHOP" | "MEETUP"
    platform?: "TELEGRAM" | "DISCORD"
    inviteLink?: string
    billingCycle?: "MONTHLY" | "YEARLY" | "ONE_TIME"
    magnetType?: "FORM" | "GIVEAWAY" | "DOWNLOAD"
    body?: string
}

export type ImportItem = {
    id: string
    kind: ImportKind
    title: string
    confidence: number
    selected: boolean
    fields: ImportFields
}

export type ImportBundle = {
    sourceLabel: string
    sourceKind: ImportSourceKind
    items: ImportItem[]
    warning?: string
}

export type ImportedExperience = {
    company: string
    role: string
    startDate: string
    endDate: string | null
    description: string
}

export type ImportedProject = {
    title: string
    description: string
    year?: string
}

export type ImportedService = {
    name: string
    description: string
    price: number
}

export type ImportedProduct = {
    title: string
    description?: string
    price: number
    type: "PDF" | "VIDEO" | "AUDIO" | "OTHER"
    fileUrl?: string
}

export type ProfileDraft = {
    displayName?: string
    headline?: string
    bio?: string
    experiences: ImportedExperience[]
    projects: ImportedProject[]
    services: ImportedService[]
    sourceTitle?: string
}

const SECTION = /^(experience|work experience|work history|employment(?: history)?|career|professional experience|projects|selected work|selected projects|portfolio|education|academic|about|summary|profile|bio|objective|skills|services|offerings)\s*:?\s*$/i

let seq = 0
function nid(kind: ImportKind) {
    seq += 1
    return `${kind}-${seq}-${Math.random().toString(36).slice(2, 7)}`
}

export function item(
    kind: ImportKind,
    title: string,
    confidence: number,
    fields: ImportFields = {}
): ImportItem {
    return {
        id: nid(kind),
        kind,
        title: title.trim().slice(0, 160) || kind,
        confidence,
        selected: confidence >= 0.55,
        fields,
    }
}

export function emptyBundle(label = "Paste", sourceKind: ImportSourceKind = "text"): ImportBundle {
    return { sourceLabel: label, sourceKind, items: [] }
}

export function parseResumeText(raw: string): ProfileDraft {
    const text = raw.replace(/\r/g, "").trim()
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
    const draft: ProfileDraft = { experiences: [], projects: [], services: [] }
    if (!lines.length) return draft

    draft.displayName = cleanName(lines[0])
    const second = lines[1] || ""
    if (second && !SECTION.test(second) && second.length < 140) {
        draft.headline = second
    }

    const chunks = splitSections(lines)
    const about = chunks.about || chunks.summary || chunks.profile || chunks.bio
    if (about) draft.bio = about.join(" ").slice(0, 800)

    const expLines = chunks.experience || chunks["work experience"] || chunks.employment || chunks["employment history"] || chunks.career || []
    draft.experiences = parseExperienceBlock(expLines.length ? expLines : lines)

    const projectLines = chunks.projects || chunks["selected work"] || chunks.portfolio || []
    draft.projects = parseProjectBlock(projectLines)

    const serviceLines = chunks.services || chunks.offerings || []
    draft.services = parseServiceBlock(serviceLines)

    if (!draft.bio) {
        draft.bio = lines.slice(draft.headline ? 2 : 1, 6).join(" ").slice(0, 500)
    }
    return draft
}

export function parseHtmlPage(html: string, url: string): ProfileDraft {
    const title = pick(html, /<title[^>]*>([^<]{2,140})/i)
        || pick(html, /property=["']og:title["'][^>]*content=["']([^"']+)/i)
        || pick(html, /content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const desc = pick(html, /property=["']og:description["'][^>]*content=["']([^"']+)/i)
        || pick(html, /name=["']description["'][^>]*content=["']([^"']+)/i)
        || pick(html, /content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const text = stripTags(html)
    const draft = parseResumeText(text)
    if (title && !draft.displayName) draft.displayName = cleanName(title.split("|")[0].split("-")[0])
    if (title && !draft.headline) draft.headline = title.slice(0, 120)
    if (desc && !draft.bio) draft.bio = desc.slice(0, 800)
    draft.sourceTitle = title || url
    if (!draft.displayName) draft.displayName = hostnameName(url)
    return draft
}

export function parseCatalogList(raw: string): ImportedProduct[] {
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseCatalogLine)
        .filter((p): p is ImportedProduct => Boolean(p))
}

function parseCatalogLine(line: string): ImportedProduct | null {
    const parts = line.split(",").map((p) => p.trim())
    const moneyPart = parts[1]?.replace(/^(?:₹|Rs\.?|INR|\$)\s*/i, "").replace(/,/g, "")
    if (parts.length >= 2 && /^\d+(\.\d+)?$/.test(moneyPart || "")) {
        return {
            title: parts[0],
            price: parseFloat(moneyPart || "0") || 0,
            description: parts.slice(2).join(", ") || undefined,
            type: guessProductType(line),
        }
    }
    const priced = line.match(/^(.*?)[\s—-]+(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d{1,2})?)\s*$/i)
    if (priced) {
        return { title: priced[1].trim(), price: parseFloat(priced[2]), type: guessProductType(line) }
    }
    if (line.length < 4 || SECTION.test(line)) return null
    return { title: line, price: 0, type: guessProductType(line) }
}

export function parseCurriculumOutline(raw: string): CourseModuleDraft[] {
    const lines = raw.replace(/\r/g, "").split("\n")
    const modules: CourseModuleDraft[] = []
    let current: CourseModuleDraft | null = null

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const moduleHit = line.match(/^(module|section|week)\s*\d*\s*[:.-]\s*(.+)$/i)
            || (!line.startsWith("-") && !line.startsWith("*") && line.endsWith(":") ? [null, null, line.slice(0, -1)] : null)
        if (moduleHit && moduleHit[2]) {
            current = { title: moduleHit[2].trim(), lessons: [] }
            modules.push(current)
            continue
        }
        if (!current) {
            current = { title: "Curriculum", lessons: [] }
            modules.push(current)
        }
        const lesson = line.replace(/^[-*•]\s*/, "")
        const dur = lesson.match(/\((\d+)\s*m(?:in(?:ute)?s?)?\)/i)
        const isFree = /\bfree\b|\bpreview\b/i.test(lesson)
        const isVideo = /\bvideo\b|\byoutube\b|\bvimeo\b/i.test(lesson)
        const title = lesson
            .replace(/\((\d+)\s*m(?:in(?:ute)?s?)?\)/ig, "")
            .replace(/\b(free|preview|video|text)\b/ig, "")
            .replace(/\s{2,}/g, " ")
            .trim()
        if (title) {
            current.lessons.push({
                title,
                durationMinutes: dur ? parseInt(dur[1], 10) : 10,
                isFree,
                contentType: isVideo ? "VIDEO" : "TEXT",
            })
        }
    }
    return modules.filter((m) => m.lessons.length || m.title)
}

export function extractPdfStrings(buffer: Buffer): string {
    const latin = buffer.toString("latin1")
    const inflated = inflatePdfStreams(buffer)
    const cidText = decodeCidPdf(latin, inflated)
    if (cidText.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w)).length >= 6) {
        return cidText
    }
    const bodies = [latin, ...inflated]
    const chunks: string[] = []
    for (const body of bodies) {
        chunks.push(...stringsFromPdfBody(body))
    }
    const cleaned = chunks
        .map((s) => s.replace(/[^\S\n]+/g, " ").trim())
        .filter((s) => s.length > 1 && !/^wkhtmltopdf|^Qt \d|^\d{14}/.test(s) && /[A-Za-z]/.test(s))
    return uniqueKeepOrder(cleaned).join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function decodeCidPdf(latin: string, inflated: string[]): string {
    if (!/beginbfrange/.test(latin)) return ""
    const cmaps = fontCmaps(latin)
    const pages = inflated.filter((s) => /\bBT\b/.test(s))
    const lines: string[] = []
    for (const page of pages) {
        const blocks = page.split(/\bBT\b/).slice(1)
        for (const block of blocks) {
            const font = (block.match(/\/(F\d+)\s+[\d.]+\s+Tf/) || [])[1]
            const glyphs = [...block.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => parseInt(m[1], 16))
            if (!glyphs.length) continue
            const map = (font && cmaps[font]) || bestCmap(cmaps, glyphs)
            if (!map || map.size < 2) continue
            const text = glyphs.map((g) => map.get(g) || "").join("").replace(/\s+/g, " ").trim()
            if (text.length > 1) lines.push(text)
        }
    }
    return lines.join("\n")
}

function fontCmaps(latin: string): Record<string, Map<number, string>> {
    const cmapByObj: Record<string, Map<number, string>> = {}
    for (const m of latin.matchAll(/(\d+)\s+0\s+obj[\s\S]{0,400}?beginbfrange([\s\S]*?)endbfrange/g)) {
        cmapByObj[m[1]] = parseBfRange(m[2])
    }
    const fontToUni: Record<string, string> = {}
    for (const m of latin.matchAll(/(\d+)\s+0\s+obj[\s\S]{0,500}?\/ToUnicode\s+(\d+)\s+0\s+R/g)) {
        fontToUni[m[1]] = m[2]
    }
    const nameToFont: Record<string, string> = {}
    for (const m of latin.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
        nameToFont[m[1]] = m[2]
    }
    const out: Record<string, Map<number, string>> = {}
    for (const [name, fontObj] of Object.entries(nameToFont)) {
        const uni = fontToUni[fontObj]
        if (uni && cmapByObj[uni]) out[name] = cmapByObj[uni]
    }
    return out
}

function bestCmap(cmaps: Record<string, Map<number, string>>, glyphs: number[]) {
    let best: Map<number, string> | undefined
    let score = -1
    for (const map of Object.values(cmaps)) {
        const text = glyphs.map((g) => map.get(g) || "").join("")
        const n = (text.match(/[A-Za-z]/g) || []).length
        if (n > score) {
            score = n
            best = map
        }
    }
    return best
}

function parseBfRange(body: string): Map<number, string> {
    const map = new Map<number, string>()
    for (const m of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g)) {
        const start = parseInt(m[1], 16)
        const dests = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((x) => pdfHexToChar(x[1]))
        dests.forEach((ch, i) => map.set(start + i, ch))
    }
    for (const m of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const from = parseInt(m[1], 16)
        const to = parseInt(m[2], 16)
        let code = parseInt(m[3], 16)
        for (let g = from; g <= to; g += 1) {
            map.set(g, String.fromCharCode(code))
            code += 1
        }
    }
    return map
}

function pdfHexToChar(hex: string) {
    const n = parseInt(hex, 16)
    return Number.isFinite(n) ? String.fromCharCode(n) : ""
}

function inflatePdfStreams(buffer: Buffer): string[] {
    const latin = buffer.toString("latin1")
    const out: string[] = []
    const re = /\/FlateDecode[\s\S]{0,180}?stream\r?\n([\s\S]*?)\r?\nendstream/g
    for (const m of latin.matchAll(re)) {
        const raw = Buffer.from(m[1], "latin1")
        for (const fn of [zlib.inflateSync, zlib.inflateRawSync]) {
            try {
                out.push(fn(raw).toString("latin1"))
                break
            } catch {
                // try next
            }
        }
    }
    return out
}

function stringsFromPdfBody(latin: string): string[] {
    const unescape = (s: string) => s
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
    const fromTj = [...latin.matchAll(/\(([^\\()]*(?:\\.[^\\()]*)*)\)\s*Tj/g)].map((m) => unescape(m[1]))
    const fromTJ = [...latin.matchAll(/\[([\s\S]*?)\]\s*TJ/g)].flatMap((m) => (
        [...m[1].matchAll(/\(([^\\()]*(?:\\.[^\\()]*)*)\)/g)].map((p) => unescape(p[1]))
    ))
    const fromHex = [...latin.matchAll(/<([0-9A-Fa-f\s]{4,})>\s*Tj/g)].map((m) => decodePdfHex(m[1]))
    const structured = [...fromTj, ...fromTJ, ...fromHex]
    if (structured.length >= 4) return structured
    return [...latin.matchAll(/\(([^)]{3,240})\)/g)].map((m) => unescape(m[1]))
}

function uniqueKeepOrder(items: string[]) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const it of items) {
        const key = it.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(it)
    }
    return out
}

function decodePdfHex(raw: string) {
    const hex = raw.replace(/\s+/g, "")
    const bytes: number[] = []
    for (let i = 0; i < hex.length; i += 2) {
        const n = parseInt(hex.slice(i, i + 2), 16)
        if (Number.isFinite(n)) bytes.push(n)
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        let out = ""
        for (let i = 2; i + 1 < bytes.length; i += 2) {
            out += String.fromCharCode((bytes[i] << 8) + bytes[i + 1])
        }
        return out
    }
    return String.fromCharCode(...bytes.filter((b) => b >= 32 && b < 127))
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
    return sanitizeDbText(extractPdfStrings(buffer))
}

export function parseCsv(raw: string): ImportItem[] {
    const rows = raw.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (rows.length < 2) return []
    const headers = splitCsv(rows[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ""))
    const titleIdx = findHeader(headers, ["title", "name", "product", "event", "service"])
    if (titleIdx < 0) return []
    const priceIdx = findHeader(headers, ["price", "amount", "cost"])
    const descIdx = findHeader(headers, ["description", "desc", "details", "note"])
    const typeIdx = findHeader(headers, ["type", "kind"])
    const catIdx = findHeader(headers, ["category", "section", "course"])
    const dietIdx = findHeader(headers, ["diet", "veg", "vegnonveg"])
    const startIdx = findHeader(headers, ["start", "starttime", "date", "when"])
    const endIdx = findHeader(headers, ["end", "endtime"])
    const locIdx = findHeader(headers, ["location", "venue", "place"])
    const urlIdx = findHeader(headers, ["url", "link", "file", "fileurl"])
    const looksEvent = startIdx >= 0 || headers.some((h) => /event|webinar|workshop/.test(h))
    const looksService = headers.some((h) => /service|duration|session/.test(h))
    const items: ImportItem[] = []
    for (const row of rows.slice(1)) {
        const cols = splitCsv(row)
        const title = cols[titleIdx]?.trim()
        if (!title) continue
        const price = priceIdx >= 0 ? parseMoney(cols[priceIdx]) : 0
        const description = descIdx >= 0 ? cols[descIdx] : undefined
        const startTime = startIdx >= 0 ? parseLooseDate(cols[startIdx]) : undefined
        if (looksEvent && startTime) {
            const endTime = (endIdx >= 0 && parseLooseDate(cols[endIdx])) || addHour(startTime)
            items.push(item("event", title, 0.86, {
                description,
                price,
                startTime,
                endTime,
                location: locIdx >= 0 ? cols[locIdx] : undefined,
                eventType: "WEBINAR",
                timezone: "UTC",
            }))
            continue
        }
        if (looksService) {
            items.push(item("service", title, 0.8, { description, price, durationMinutes: 30 }))
            continue
        }
        items.push(item("product", title, 0.84, {
            description,
            price,
            productType: guessProductType(`${title} ${cols[typeIdx] || ""}`),
            fileUrl: urlIdx >= 0 ? cols[urlIdx] : undefined,
            category: catIdx >= 0 ? cols[catIdx] : undefined,
            diet: dietIdx >= 0 ? cols[dietIdx] : undefined,
            fulfillment: "PHYSICAL",
        }))
    }
    return items
}

export function parseIcs(raw: string): ImportItem[] {
    const blocks = raw.split(/BEGIN:VEVENT/i).slice(1)
    return blocks.map((block) => {
        const summary = icsField(block, "SUMMARY") || "Event"
        const description = icsField(block, "DESCRIPTION")
        const location = icsField(block, "LOCATION")
        const url = icsField(block, "URL")
        const startTime = icsDate(icsField(block, "DTSTART"))
        const endRaw = icsDate(icsField(block, "DTEND"))
        const endTime = endRaw || (startTime ? addHour(startTime) : undefined)
        return item("event", summary, startTime ? 0.9 : 0.4, {
            description,
            location,
            meetingUrl: url,
            startTime,
            endTime,
            eventType: /workshop/i.test(summary) ? "WORKSHOP" : /meetup|mixer/i.test(summary) ? "MEETUP" : "WEBINAR",
            timezone: "UTC",
            price: 0,
        })
    }).filter((e) => e.title)
}

export function parseJsonLd(html: string): ImportItem[] {
    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    const nodes: Record<string, unknown>[] = []
    for (const m of blocks) {
        try {
            const json = JSON.parse(m[1].replace(/[\u0000-\u001F]+/g, " "))
            flattenLd(json, nodes)
        } catch {
            // ignore broken ld+json
        }
    }
    const items: ImportItem[] = []
    for (const node of nodes) {
        const type = ldType(node)
        if (!type) continue
        if (type.includes("person") || type.includes("localbusiness") || type.includes("organization")) {
            const name = str(node.name)
            const headline = str(node.jobTitle) || str(node.description)?.slice(0, 120)
            const bio = str(node.description)
            if (name || headline || bio) {
                items.push(item("profile", name || "Profile", 0.9, {
                    displayName: name,
                    headline,
                    bio,
                }))
            }
            const offers = asArray(node.makesOffer || node.hasOfferCatalog)
            for (const offer of offers) {
                const rec = asRecord(offer)
                if (!rec) continue
                const oname = str(rec.name) || str(asRecord(rec.itemOffered)?.name)
                if (oname) items.push(item("service", oname, 0.82, { description: str(rec.description), price: ldPrice(rec) }))
            }
        }
        if (type.includes("product") || type.includes("offer")) {
            const name = str(node.name) || str(asRecord(node.itemOffered)?.name)
            if (name) {
                items.push(item("product", name, 0.9, {
                    description: str(node.description),
                    price: ldPrice(node),
                    thumbnailUrl: ldImage(node),
                    url: str(node.url),
                    productType: guessProductType(`${name} ${str(node.category) || ""}`),
                }))
            }
        }
        if (type.includes("event")) {
            const name = str(node.name)
            const startTime = parseLooseDate(str(node.startDate))
            if (name && startTime) {
                items.push(item("event", name, 0.9, {
                    description: str(node.description),
                    startTime,
                    endTime: parseLooseDate(str(node.endDate)) || addHour(startTime),
                    location: str(asRecord(node.location)?.name) || str(node.location),
                    meetingUrl: str(node.url),
                    thumbnailUrl: ldImage(node),
                    eventType: "WEBINAR",
                    timezone: "UTC",
                    price: ldPrice(node),
                }))
            }
        }
        if (type.includes("course")) {
            const name = str(node.name)
            if (name) {
                items.push(item("course", name, 0.88, {
                    description: str(node.description),
                    price: ldPrice(node),
                    thumbnailUrl: ldImage(node),
                    url: str(node.url),
                    modules: [],
                }))
            }
        }
        if (type.includes("listitem")) {
            const inner = asRecord(node.item) || node
            const name = str(inner.name)
            if (name) {
                const innerType = ldType(inner)
                const kind: ImportKind = innerType.includes("event") ? "event"
                    : innerType.includes("course") ? "course"
                    : innerType.includes("service") ? "service"
                    : "product"
                items.push(item(kind, name, 0.84, {
                    description: str(inner.description),
                    price: ldPrice(inner),
                    url: str(inner.url),
                    thumbnailUrl: ldImage(inner),
                }))
            }
        }
    }
    return items
}

export function parseOpenGraph(html: string, url: string): ImportItem[] {
    const title = pick(html, /property=["']og:title["'][^>]*content=["']([^"']+)/i)
        || pick(html, /content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
    const desc = pick(html, /property=["']og:description["'][^>]*content=["']([^"']+)/i)
    const image = pick(html, /property=["']og:image["'][^>]*content=["']([^"']+)/i)
    if (!title && !desc) return []
    return [item("profile", cleanName(title || hostnameName(url) || "Site") || "Site", 0.6, {
        displayName: title ? cleanName(title.split("|")[0].split("-")[0]) : hostnameName(url),
        headline: title?.slice(0, 120),
        bio: desc?.slice(0, 800),
        thumbnailUrl: image,
        url,
    })]
}

export function detectCommunity(url: string, title?: string): ImportItem | null {
    const discord = /discord\.(gg|com)/i.test(url)
    const telegram = /t\.me\/|telegram\.(me|org)/i.test(url)
    if (!discord && !telegram) return null
    const name = title || hostnameName(url) || (discord ? "Discord" : "Telegram")
    return item("community", name, 0.88, {
        platform: discord ? "DISCORD" : "TELEGRAM",
        inviteLink: url,
        billingCycle: "MONTHLY",
        price: 0,
        description: `Imported from ${url}`,
    })
}

export function bundleFromDraft(draft: ProfileDraft, sourceLabel: string, sourceKind: ImportSourceKind): ImportBundle {
    const items: ImportItem[] = []
    if (draft.displayName || draft.headline || draft.bio) {
        items.push(item("profile", draft.displayName || "Profile", 0.72, {
            displayName: draft.displayName,
            headline: draft.headline,
            bio: draft.bio,
        }))
    }
    for (const exp of draft.experiences) {
        items.push(item("experience", `${exp.role} · ${exp.company}`, 0.74, {
            role: exp.role,
            company: exp.company,
            startDate: exp.startDate,
            endDate: exp.endDate || undefined,
            description: exp.description,
        }))
    }
    for (const project of draft.projects) {
        items.push(item("project", project.title, 0.68, {
            description: project.description,
            year: project.year,
        }))
    }
    for (const service of draft.services) {
        items.push(item("service", service.name, 0.7, {
            description: service.description,
            price: service.price,
            durationMinutes: 30,
        }))
    }
    return { sourceLabel: draft.sourceTitle || sourceLabel, sourceKind, items }
}

export function bundleFromText(raw: string, sourceLabel = "Pasted text", sourceKind: ImportSourceKind = "text"): ImportBundle {
    const text = raw.replace(/\r/g, "").trim()
    if (!text) return emptyBundle(sourceLabel, sourceKind)
    if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(text)) {
        return { sourceLabel, sourceKind: sourceKind === "text" ? "ics" : sourceKind, items: parseIcs(text) }
    }
    const lines = text.split("\n")
    const looksCsv = lines[0]?.includes(",") && lines.length > 2 && splitCsv(lines[0]).length >= 2
        && /title|name|price|event|product/i.test(lines[0])
    if (looksCsv) {
        return { sourceLabel, sourceKind: "csv", items: parseCsv(text) }
    }

    const items: ImportItem[] = []
    const outline = looksLikeOutline(text) ? parseCurriculumOutline(text) : []
    if (outline.length && outline.some((m) => m.lessons.length)) {
        const title = outline[0].title === "Curriculum" ? guessCourseTitle(text) : outline[0].title
        items.push(item("course", title, 0.8, {
            description: `${outline.length} modules`,
            price: 0,
            modules: outline,
        }))
    }

    const catalogish = looksLikeCatalog(text)
    if (catalogish) {
        for (const p of parseCatalogList(text).slice(0, 40)) {
            items.push(item("product", p.title, 0.7, {
                description: p.description,
                price: p.price,
                productType: p.type,
                fileUrl: p.fileUrl,
                fulfillment: p.type === "PDF" || p.type === "VIDEO" || p.type === "AUDIO" ? "DIGITAL" : "PHYSICAL",
            }))
        }
    }

    const draftItems = bundleFromDraft(parseResumeText(text), sourceLabel, sourceKind).items
    items.push(...draftItems)

    if (!items.length) {
        items.push(item("knowledge", sourceLabel, 0.45, { body: text.slice(0, 8000), description: text.slice(0, 240) }))
    }

    return { sourceLabel, sourceKind, items: dedupeItems(items).slice(0, 60) }
}

export function extractPageText(html: string, max = 8000) {
    return stripTags(html).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
}

export function relatedPageUrls(html: string, base: string): string[] {
    let origin = ""
    try { origin = new URL(base).origin } catch { return [] }
    const interesting = /about|bio|work|works|project|portfolio|service|pricing|price|offer|shop|store|product|course|class|event|book|coach|experience|session|resume|cv|ajax/i
    const skip = /\.(png|jpe?g|webp|gif|svg|css|js|pdf|zip|mp4|woff2?)(\?|$)/i
    const found = new Set<string>()
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
        try {
            const u = new URL(m[1], base)
            if (u.origin !== origin) continue
            if (skip.test(u.pathname)) continue
            const key = u.origin + u.pathname.replace(/\/$/, "")
            if (key === origin || key === origin + "/") continue
            if (interesting.test(u.pathname) || interesting.test(m[1])) found.add(u.origin + u.pathname)
        } catch { /* ignore */ }
    }
    return [...found].slice(0, 8)
}

export function extractHtmlOffers(html: string): ImportItem[] {
    const items: ImportItem[] = []
    items.push(...extractProfileFromHtml(html))
    items.push(...extractPortfolioCards(html))
    items.push(...extractTimelineJobs(html))
    items.push(...extractServiceCards(html))
    items.push(...extractLabeledPairs(html))
    items.push(...extractPriceCards(html))
    items.push(...extractHeadingItems(html))
    return items.slice(0, 50)
}

function extractLabeledPairs(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const seen = new Set<string>()
    const re = /<p[^>]*mil-text-lg[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi
    for (const m of html.matchAll(re)) {
        const title = cleanHeading(m[1] || "")
        const meta = stripTags(m[2] || "").replace(/\s+/g, " ").trim()
        if (!title || isChromeHeading(title) || isEducationTitle(title) || /^\$\d|per hour/i.test(title)) continue
        const start = m.index || 0
        if (skipZone(html, start) || inEducationZone(html, start)) continue
        const section = enclosingSection(html, start)
        const price = firstPrice(meta + " " + stripTags(html.slice(start, start + 280)))
        const dated = looksLikeJob(meta) || /\btoday\b/i.test(meta)
        if (price != null && !dated) {
            const key = `service:${norm(title)}`
            if (seen.has(key)) continue
            seen.add(key)
            items.push(item("service", title, 0.83, { price, durationMinutes: firstDuration(meta) || 60, description: meta }))
            continue
        }
        if (dated || /experience|resume/.test(section)) {
            const company = guessCompany(html.slice(Math.max(0, start - 40), start + 280), title) || title
            const key = `exp:${norm(title)}:${norm(company)}`
            if (seen.has(key)) continue
            seen.add(key)
            const dates = meta.match(/((?:19|20)\d{2})\s*(?:[-–]|to)\s*((?:19|20)\d{2}|present|current|now|today)/i)
            items.push(item("experience", `${title} · ${company}`, 0.8, {
                role: title,
                company,
                startDate: dates?.[1] || (/today/i.test(meta) ? "Present" : ""),
                endDate: dates && !/present|current|now|today/i.test(dates[2]) ? dates[2] : undefined,
            }))
        }
    }
    return items
}

function extractProfileFromHtml(html: string): ImportItem[] {
    const spoken = html.match(/Hi,?\s*I.?m\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/i)
        || html.match(/Hello(?:\s+there!?)?\s*I.?m\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/i)
        || html.match(/My name is\s+([A-Z][A-Za-z.]+)/i)
        || stripTags(html).match(/I.?m\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,2})\.?/)
    const listName = pick(html, />\s*Name:\s*<\/span>\s*([^<]{2,60})/i)
        || pick(html, /I'm\s+<span[^>]*>([^<]{2,60})<\/span>/i)
        || pick(html, /<span[^>]*>\s*I.?m\s+([^<]{2,60})<\/span>/i)
        || pick(html, /title=["']I.?m\s+([^"']{2,60})["']/i)
        || pick(html, /Hello I(?:'|’|&apos;)m(?:\s|<[^>]+>)*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/i)
        || spoken?.[1]
    const h1 = cleanHeading((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "")
    const rawName = (listName || h1).replace(/\s+/g, " ").trim()
    const name = cleanName(rawName)
    if (!name || isTemplateBrand(name) || isChromeHeading(name) || name.length < 3) return []
    if (/^(different|here|ready|freelancer)$/i.test(name)) return []

    const im = html.match(/I'm\s+<span[^>]*>[^<]+<\/span>,?\s*([^<]{3,90})/i)
    const roleLine = pick(html, />\s*Role:\s*<\/(?:span|h6)>\s*<(?:p|span)[^>]*>([^<]{3,80})/i)
        || pick(html, /<h6[^>]*>\s*Role\s*<\/h6>\s*<p[^>]*>([^<]{3,80})/i)
    const headlineFromH1 = listName && h1 && norm(h1) !== norm(name) && h1.length < 80 ? h1 : ""
    const headline = cleanHeading(im?.[1] || roleLine || headlineFromH1 || "")
        .replace(/^a\s+/i, "")
        .slice(0, 120)

    const about = sectionChunks(html, /about|intro/)[0]?.html || ""
    const paras = [...(about || html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((m) => stripTags(m[1]).replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 50 && !/name:|email:|download cv|lorem ipsum is simply/i.test(p))
    const bio = paras.slice(0, 2).join(" ").slice(0, 800)

    return [item("profile", name, 0.88, {
        displayName: name,
        headline: headline || undefined,
        bio: bio || undefined,
    })]
}

function extractPortfolioCards(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const seen = new Set<string>()
    const zones = sectionChunks(html, /portfolio|\bworks\b|^projects?$/)
    let fallback = 0
    const push = (title: string, cat: string, img: string, href: string) => {
        let name = title
        if (!name || isChromeHeading(name) || /read more|thanks, your message/i.test(name)) {
            if (!img || !/portfolio|project|work/i.test(img)) return
            fallback += 1
            name = `Project ${fallback}`
        }
        if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(name) && !/project|design|mockup|brand/i.test(name)) return
        if (/^project title(?:\s+\d+)?$/i.test(name) || /^project$/i.test(name)) {
            const n = (img.match(/(\d+)(?=\.\w+$)/) || [])[1]
            fallback += 1
            name = cat && !/^categor/i.test(cat)
                ? `${cat} project${n ? ` ${n}` : ` ${fallback}`}`
                : `Project ${n || fallback}`
        }
        const key = norm(name)
        if (!key || seen.has(key) || isChromeHeading(name)) return
        seen.add(key)
        items.push(item("project", name, 0.8, {
            description: cat && !/^categor/i.test(cat) ? cat.slice(0, 160) : undefined,
            thumbnailUrl: img || undefined,
            link: href && !href.startsWith("#") ? href : undefined,
        }))
    }

    for (const zone of zones) {
        const overlays = [...zone.html.matchAll(/portfolio-overlay-details[\s\S]{0,500}?<h([4-6])[^>]*>([\s\S]*?)<\/h\1>[\s\S]{0,240}?<span[^>]*>([\s\S]*?)<\/span>/gi)]
        for (const m of overlays) {
            const around = zone.html.slice(Math.max(0, (m.index || 0) - 500), (m.index || 0) + 200)
            push(
                cleanHeading(m[2] || ""),
                cleanHeading(m[3] || ""),
                (around.match(/src=["']([^"']+)["']/i) || [])[1] || "",
                (around.match(/href=["']([^"']+)["']/i) || [])[1] || "",
            )
        }
        if (overlays.length) continue
        const heads = [...zone.html.matchAll(/<h([4-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
        for (const h of heads) {
            const around = zone.html.slice(Math.max(0, (h.index || 0) - 400), (h.index || 0) + 200)
            push(cleanHeading(h[2] || ""), "", (around.match(/src=["']([^"']+)["']/i) || [])[1] || "", (around.match(/href=["']([^"']+)["']/i) || [])[1] || "")
        }
        if (heads.length) continue
        const imgs = [...zone.html.matchAll(/src=["']([^"']*(?:portfolio|projects?)[^"']*)["']/gi)]
        for (const img of imgs) push("", "", img[1], "")
    }
    return items
}

function extractTimelineJobs(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const seen = new Set<string>()
    const zones = sectionChunks(html, /resume|experience|education/)
    for (const zone of zones) {
        if (/education|academic|certificate/i.test(zone.name) && !/experience|resume/i.test(zone.name)) continue
        const heads = [...zone.html.matchAll(/<h([3-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
        for (const h of heads) {
            const title = cleanHeading(h[2] || "")
            if (!title || isChromeHeading(title) || isEducationTitle(title) || /education|skills|experience|resume|summary/i.test(title)) continue
            if (inEducationZone(zone.html, h.index || 0)) continue
            const around = zone.html.slice(Math.max(0, (h.index || 0) - 220), (h.index || 0) + 320)
            const parsed = parseJobAround(title, around)
            if (!parsed) continue
            const key = `${norm(parsed.role)}:${norm(parsed.company)}`
            if (seen.has(key)) continue
            seen.add(key)
            items.push(item("experience", `${parsed.role} · ${parsed.company}`, 0.84, {
                role: parsed.role,
                company: parsed.company,
                startDate: parsed.startDate,
                endDate: parsed.endDate || undefined,
                description: parsed.description,
            }))
        }
        for (const box of [...zone.html.matchAll(/<(?:p|div)[^>]*(?:mil-text-lg|timeline|mil-box-text)[^>]*>([\s\S]{0,400}?)<\/(?:p|div)>/gi)]) {
            const title = cleanHeading(box[1] || "")
            if (!title || isChromeHeading(title) || isEducationTitle(title) || title.length > 70) continue
            if (inEducationZone(zone.html, box.index || 0)) continue
            if (/^\$\d|per hour/i.test(title)) continue
            const around = zone.html.slice(Math.max(0, (box.index || 0) - 80), (box.index || 0) + 320)
            const parsed = parseJobAround(title, around)
            if (!parsed) continue
            const key = `${norm(parsed.role)}:${norm(parsed.company)}`
            if (seen.has(key)) continue
            seen.add(key)
            items.push(item("experience", `${parsed.role} · ${parsed.company}`, 0.78, {
                role: parsed.role,
                company: parsed.company,
                startDate: parsed.startDate,
                endDate: parsed.endDate || undefined,
                description: parsed.description,
            }))
        }
    }
    return items
}

function extractServiceCards(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const seen = new Set<string>()
    const zones = sectionChunks(html, /service|what.?i.?do|offer/)
    for (const zone of zones) {
        const heads = [...zone.html.matchAll(/<h([3-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
        const mil = [...zone.html.matchAll(/<p[^>]*mil-text-lg[^>]*>([\s\S]*?)<\/p>/gi)]
        for (const m of mil) heads.push(["", "", m[1]] as unknown as RegExpExecArray)
        for (const h of heads) {
            const title = cleanHeading(h[2] || "")
            if (!title || title.length < 3 || title.length > 70 || isChromeHeading(title)) continue
            if (/about|portfolio|resume|education|contact|testimonial|blog|terms of|part [ivx]+|check details|per hour|^\$\d/i.test(title)) continue
            const start = h.index || 0
            const chunk = zone.html.slice(start, start + 700)
            const text = stripTags(chunk).replace(/\s+/g, " ").trim()
            if (inEducationZone(zone.html, start)) continue
            if (looksLikeJob(text) && /experience|resume/i.test(zone.name)) continue
            const price = firstPrice(text)
            const desc = stripTags((chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).map((p) => stripTags(p)).find((p) => p.length > 20 && !norm(p).includes(norm(title))) || "")
                .slice(0, 280)
            const key = norm(title)
            if (seen.has(key)) continue
            seen.add(key)
            items.push(item("service", title, price != null ? 0.82 : 0.74, {
                description: desc || undefined,
                price: price ?? undefined,
                durationMinutes: firstDuration(text) || 30,
            }))
        }
    }
    return items
}

function extractPriceCards(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const zones = sectionChunks(html, /pric|plan|package/)
    const hay = zones.length ? zones.map((z) => z.html).join("\n") : html
    const heads = [...hay.matchAll(/<h([2-5])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    const seen = new Set<string>()
    for (const h of heads) {
        const title = cleanHeading(h[2] || "")
        if (!title || isChromeHeading(title)) continue
        const chunk = hay.slice(h.index || 0, (h.index || 0) + 600)
        const price = firstPrice(stripTags(chunk))
        if (price == null) continue
        if (seen.has(norm(title))) continue
        seen.add(norm(title))
        items.push(item("product", title, 0.76, {
            price,
            description: stripTags(chunk).replace(/\s+/g, " ").trim().slice(title.length).trim().slice(0, 240),
            productType: "OTHER",
        }))
    }
    return items
}

function extractHeadingItems(html: string): ImportItem[] {
    const items: ImportItem[] = []
    const seen = new Set<string>()
    const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 90)
    for (let i = 0; i < headings.length; i++) {
        const title = cleanHeading(headings[i][2] || "")
        if (!title || title.length < 3 || title.length > 90 || isChromeHeading(title) || isEducationTitle(title)) continue
        if (/^hello\b|^hi[, ]|i['’]m |^part [ivx]+|thanks, your message|sent successfully/i.test(title)) continue
        const start = headings[i].index ?? 0
        if (skipZone(html, start)) continue
        const end = headings[i + 1]?.index ?? start + 700
        const chunk = html.slice(start, Math.min(end, start + 900))
        const text = stripTags(chunk).replace(/\s+/g, " ").trim()
        const price = firstPrice(text)
        const section = enclosingSection(html, start)
        const kind = classifyOffer(title, text, section, price)
        if (!kind || kind === "experience") continue
        const key = `${kind}:${norm(title)}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push(item(kind, title, price != null ? 0.7 : 0.56, {
            description: text.slice(title.length).trim().slice(0, 280),
            price: price ?? undefined,
            durationMinutes: kind === "service" ? (firstDuration(text) || 30) : undefined,
        }))
    }
    return items
}

function parseJobAround(title: string, around: string) {
    const text = stripTags(around).replace(/\s+/g, " ").trim()
    const dates = text.match(/((?:19|20)\d{2})\s*(?:[-–]|to)\s*((?:19|20)\d{2}|present|current|now|today)/i)
    const todayOnly = !dates && /\btoday\b/i.test(text)
    const company = guessCompany(around, title)
    if (!dates && !todayOnly && !company) return null
    const startDate = dates?.[1] || (todayOnly ? "Present" : "")
    const endRaw = dates?.[2] || (todayOnly ? "Present" : "")
    const endDate = /present|current|now|today/i.test(endRaw) ? null : (endRaw || null)
    const desc = [...around.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((m) => stripTags(m[1]).replace(/\s+/g, " ").trim())
        .find((p) => p.length > 24 && !norm(p).includes(norm(title)) && !/^\(?[A-Za-z].{0,40}\)?$/.test(p) && !/\d{4}/.test(p))
    return {
        role: title,
        company: company || title,
        startDate,
        endDate,
        description: desc?.slice(0, 280),
    }
}

function guessCompany(aroundHtml: string, role: string) {
    const idx = aroundHtml.toLowerCase().indexOf(role.toLowerCase())
    const afterHtml = idx >= 0 ? aroundHtml.slice(idx + role.length) : aroundHtml
    const beforeHtml = idx >= 0 ? aroundHtml.slice(0, idx) : ""
    const pick = (html: string) => {
        const lines = [...html.matchAll(/<(?:p|span|h6)[^>]*>([\s\S]*?)<\/(?:p|span|h6)>/gi)]
            .map((m) => stripTags(m[1]).replace(/\s+/g, " ").trim())
            .filter(Boolean)
        for (const line of lines.slice(0, 2)) {
            if (/^lorem|lisque|dummy text|it has survived/i.test(line)) continue
            const paren = line.match(/^\(([^)]+)\)\s*$/)
            const beforeSlash = line.split("/")[0].trim()
            const candidate = (paren?.[1] || beforeSlash || line).replace(/[()]/g, "").trim()
            if (!candidate || norm(candidate) === norm(role)) continue
            if (candidate.length > 60 || candidate.length < 2) continue
            if (/^\d{4}|present|current|today/i.test(candidate)) continue
            if (/per hour|\/m\b|download|read more/i.test(candidate)) continue
            if (isLocationLine(candidate)) continue
            return candidate
        }
        return ""
    }
    const after = pick(afterHtml)
    const before = pick(beforeHtml)
    if (after && looksLikeRoleLine(after) && before) return before
    return after || before
}

function looksLikeRoleLine(s: string) {
    return /\b(developer|designer|support|engineer|manager|consultant|specialist|animator|director)\b/i.test(s)
}

function isLocationLine(s: string) {
    return /^(new york|los angeles|san francisco|london|paris|california|usa|united states)\b/i.test(s)
        || /\b(city|street|avenue)\b/i.test(s)
}

function looksLikeJob(text: string) {
    return /((?:19|20)\d{2})\s*(?:[-–]|to)\s*((?:19|20)\d{2}|present|current|now)/i.test(text)
}

function inEducationZone(html: string, at: number) {
    const before = html.slice(Math.max(0, at - 2500), at)
    const heads = [...before.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    for (let i = heads.length - 1; i >= 0; i--) {
        const name = cleanHeading(heads[i][1])
        if (/education|academic|certificate/i.test(name)) return true
        if (/experience|employment|work history|resume/i.test(name)) return false
    }
    return false
}

function isEducationTitle(s: string) {
    return /\b(bachelor|master|degree|diploma|bsc|msc|mba|phd|computer science|fine.?art|higher studies|ib diploma)\b/i.test(s)
}

function skipZone(html: string, at: number) {
    const section = enclosingSection(html, at)
    return /testimonial|client speak|faq|accordion|contact|blog|privacy|terms|color switcher|preloader|why-choose|why i.?m different|work process|\bprocess\b|our clients|\bclients\b/i.test(section)
}

function sectionChunks(html: string, nameRe: RegExp): { name: string; html: string }[] {
    const re = /<(section|div)\b([^>]*\bid=["'](about|intro|home|service|services|resume|portfolio|projects?|works?|experience|education|pricing|prices|contact|contacts|testimonial|client|clients|why-choose|process|blog|faq)["'][^>]*)>/gi
    const matches = [...html.matchAll(re)]
    const out: { name: string; html: string }[] = []
    for (let i = 0; i < matches.length; i++) {
        const name = (matches[i][3] || "").toLowerCase()
        if (!nameRe.test(name)) continue
        const start = matches[i].index || 0
        const next = matches.find((m, idx) => idx > i && (m.index || 0) > start)
        const end = next?.index ?? Math.min(html.length, start + 14000)
        out.push({ name, html: html.slice(start, end) })
    }
    const heads = [...html.matchAll(/<h([1-2])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    for (let i = 0; i < heads.length; i++) {
        const name = cleanHeading(heads[i][2] || "").toLowerCase()
        if (!nameRe.test(name)) continue
        const start = heads[i].index || 0
        const end = heads[i + 1]?.index ?? Math.min(html.length, start + 8000)
        const slice = html.slice(start, end)
        if (!out.some((s) => s.html.includes(slice.slice(0, 120)) || slice.includes(s.html.slice(0, 120)))) {
            out.push({ name, html: slice })
        }
    }
    return out
}

function enclosingSection(html: string, at: number) {
    const before = html.slice(Math.max(0, at - 9000), at)
    const last = [...before.matchAll(/<(?:section|div)\b([^>]*\bid=["'](?:about|intro|home|service|services|resume|portfolio|projects?|works?|experience|education|pricing|prices|contact|contacts|testimonial|client|clients|why-choose|process|blog|faq)["'][^>]*)>/gi)].pop()
    const attrs = last?.[1] || ""
    const id = (attrs.match(/\bid=["']([^"']+)/i) || [])[1] || ""
    const cls = (attrs.match(/\bclass=["']([^"']+)/i) || [])[1] || ""
    const heads = [...before.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    const lastHead = heads.length ? cleanHeading(heads[heads.length - 1][1]) : ""
    return `${id} ${cls} ${lastHead}`.toLowerCase()
}

function isChromeHeading(s: string) {
    const t = s.replace(/\s+/g, " ").trim()
    if (!t || t.length < 2) return true
    if (/^\d+\s*[%+]?$/.test(t)) return true
    if (/^(years? experi[ea]nce|happy clients|projects done|get awards|satisfied clients)$/i.test(t)) return true
    if (/^(home|about|about me|know me more|contact|contacts|menu|login|sign(?: in| up)?|cart|shop|blog|blogs?|news|privacy(?: policy)?|terms(?: of (?:use|service))?|cookie|search|skip|follow(?: me)?|share|subscribe|nav|services?|our services|what i do\??|what we do\??|portfolio|projects?|my work|our (?:work|best works|portfolio|pricing|clients|blogs?(?: & news)?)|resume|summary|my (?:education|experience|skills|work)|skills?|education|experience|testimonial|testimonials|client speak|faq|frequently asked questions|color switcher|address|send us a note|download cv|hire me!?|loading|preloader|introduction|certificates?|ability or skill|hello i'?m|hi,? i'?m a freelancer|check details|result of my work|work process|visit us|call us now|inquiries)$/i.test(t)) return true
    if (/help your next project|most recent projects|summary of my resume|clients say|get you an estimate|enjoy discussing|what we.?re good at|best pricing|our blogs|know me more|interested in working|have any questions|let'?s get in touch|estimate your project|start a project|living in|i believe that collaboration|from crafting visually|what sets me apart|why i.?m different|unique design|fully customis|different layout|responsive layout|boxed|& wide|extensive documentation|planning & consulting|final discussion|delivery & launch/i.test(t)) return true
    if (/\?$/.test(t) && t.length > 18) return true
    return false
}

function isTemplateBrand(s: string) {
    return /template|themeforest|html template|personal portfolio/i.test(s)
}

function cleanHeading(raw: string) {
    return stripTags(raw || "").replace(/\s+/g, " ").trim()
}

function firstPrice(text: string) {
    const m = text.match(/(?:\$|usd\s*|₹|inr\s*)\s?(\d[\d,]*(?:\.\d{1,2})?)/i)
    return m ? parseFloat(m[1].replace(/,/g, "")) : undefined
}

function firstDuration(text: string) {
    const m = text.match(/(\d+)\s*(?:min|mins|minutes|hr|hrs|hour)/i)
    if (!m) return undefined
    const n = parseInt(m[1], 10)
    return /hr|hour/i.test(m[0]) ? n * 60 : n
}

function classifyOffer(title: string, text: string, section: string, price?: number): ImportKind | null {
    if (isChromeHeading(title) || isEducationTitle(title)) return null
    const sec = (section || "").toLowerCase()
    const name = title.toLowerCase()
    if (/faq|accordion|testimonial|client speak|blog|privacy|terms|color switcher|contact|why-choose|process|clients/.test(sec)) return null
    if (/education|academic|certificate/.test(sec) && !/experience/.test(sec)) return null
    if (/about|intro/.test(sec) && price == null) return null
    if (/course|curriculum|module|lesson|cohort/.test(name)) return "course"
    if (/event|workshop|webinar|meetup|retreat/.test(name) && !/portfolio|project/.test(sec)) return "event"
    if (/portfolio|projects?|works?\b/.test(sec) && !/process|why-choose|clients/.test(sec) && title.split(/\s+/).length <= 8) return "project"
    if (/service|what i do|offer/.test(sec)) return "service"
    if (/pric|plan|package/.test(sec) && price != null) return "product"
    if (/service|session|consult|coaching|retain/.test(name)) return "service"
    if (/project|case study|portfolio/.test(name) && title.split(/\s+/).length <= 6) return "project"
    if (price != null) return /book|call|session|hour/.test(`${name} ${text}`) ? "service" : "product"
    if (/experience|worked|role at/.test(sec)) return "experience"
    return null
}

export function bundleFromHtml(html: string, url: string): ImportBundle {
    const items: ImportItem[] = []
    items.push(...parseJsonLd(html))
    items.push(...extractHtmlOffers(html))
    if (!items.some((i) => i.kind === "profile")) {
        items.push(...parseOpenGraph(html, url))
    }
    const community = detectCommunity(url, items.find((i) => i.kind === "profile")?.title)
    if (community) items.push(community)
    if (!items.some((i) => i.kind === "profile" || i.kind === "knowledge")) {
        const text = extractPageText(html, 1600)
        if (text.length > 40) {
            items.push(item("knowledge", hostnameName(url) || "Page notes", 0.48, {
                body: text.slice(0, 2500),
                description: text.slice(0, 240),
                url,
            }))
        }
    }
    const cleaned = dedupeItems(items).slice(0, 60)
    return {
        sourceLabel: cleaned.find((i) => i.kind === "profile")?.title || hostnameName(url) || url,
        sourceKind: "url",
        items: cleaned,
    }
}

export function mergeBundles(base: ImportBundle, extra: ImportItem[]): ImportBundle {
    return { ...base, items: dedupeItems([...base.items, ...extra]) }
}

export function dedupeItems(items: ImportItem[]): ImportItem[] {
    const profiles = items.filter((i) => i.kind === "profile")
    const rest = items.filter((i) => i.kind !== "profile")
    const out: ImportItem[] = []
    if (profiles.length) {
        const best = [...profiles].sort((a, b) => b.confidence - a.confidence)[0]
        for (const p of profiles) {
            if (p === best) continue
            best.fields = { ...p.fields, ...omitEmpty(best.fields) }
            best.confidence = Math.max(best.confidence, p.confidence)
        }
        best.selected = best.confidence >= 0.55
        out.push(best)
    }

    const seen = new Map<string, ImportItem>()
    const kindRank: Record<string, number> = {
        experience: 5, service: 4, project: 3, product: 3, course: 3, event: 3, community: 2, leadMagnet: 2, knowledge: 1,
    }
    for (const it of rest) {
        const fuzzy = norm(it.title).replace(/^(the|a|an)/, "")
        const key = `${it.kind}:${fuzzy}:${norm(it.fields.company || "")}`
        const prev = seen.get(key) || seen.get(`*:${fuzzy}`)
        if (prev) {
            const richer = scoreItem(it) > scoreItem(prev) ? it : prev
            richer.fields = { ...prev.fields, ...omitEmpty(it.fields) }
            richer.confidence = Math.max(prev.confidence, it.confidence)
            richer.selected = richer.confidence >= 0.55
            seen.set(key, richer)
            seen.set(`*:${fuzzy}`, richer)
            continue
        }
        const clash = [...seen.values()].find((x) => norm(x.title) === fuzzy && x.kind !== it.kind)
        if (clash && (kindRank[it.kind] || 0) <= (kindRank[clash.kind] || 0)) continue
        if (clash && (kindRank[it.kind] || 0) > (kindRank[clash.kind] || 0)) {
            for (const [k, v] of seen) if (v === clash) seen.delete(k)
        }
        seen.set(key, it)
        seen.set(`*:${fuzzy}`, it)
    }
    const unique = [...new Set(seen.values())]
    return [...out, ...unique]
}

function scoreItem(it: ImportItem) {
    let n = it.confidence * 10
    if (it.fields.company) n += 3
    if (it.fields.description) n += 1
    if (it.fields.price) n += 1
    if (it.fields.startDate) n += 2
    return n
}

export function mergeModelItems(det: ImportItem[], model: ImportItem[]): ImportItem[] {
    const out = [...det]
    for (const next of model) {
        const hit = out.find((d) => d.kind === next.kind && norm(d.title) === norm(next.title))
        if (hit) {
            if (hit.confidence >= 0.7) {
                hit.fields = { ...next.fields, ...omitEmpty(hit.fields) }
            } else {
                hit.fields = { ...hit.fields, ...omitEmpty(next.fields) }
                hit.confidence = Math.max(hit.confidence, next.confidence)
                hit.selected = hit.confidence >= 0.55
            }
            continue
        }
        out.push(next)
    }
    return dedupeItems(out)
}

function looksLikeOutline(text: string) {
    return /^(module|section|week)\s*\d*\s*[:.-]/im.test(text) || (text.match(/^[-*•]\s+/gm) || []).length >= 3
}

export function looksLikeCatalog(text: string) {
    if (/^(experience|work experience|about|summary|profile|education|projects|services)\b/im.test(text)) return false
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return false
    const priced = lines.filter((l) => /(?:₹|Rs\.?|INR|\$)\s*\d+|\d+\s*(?:₹|Rs\.?|INR)/i.test(l) && l.length < 140)
    return priced.length >= 2 && priced.length / lines.length > 0.35
}

function guessCourseTitle(text: string) {
    const first = text.split("\n").map((l) => l.trim()).find((l) => l && !/^(module|section|week|[-*•])/i.test(l))
    return (first || "Imported course").slice(0, 80)
}

function guessProductType(s: string): "PDF" | "VIDEO" | "AUDIO" | "OTHER" {
    if (/\b(pdf|ebook|workbook|guide)\b/i.test(s)) return "PDF"
    if (/\b(video|youtube|vimeo|mp4)\b/i.test(s)) return "VIDEO"
    if (/\b(audio|mp3|podcast)\b/i.test(s)) return "AUDIO"
    return "OTHER"
}

function splitSections(lines: string[]) {
    const map: Record<string, string[]> = {}
    let current = "intro"
    map[current] = []
    for (const line of lines) {
        if (SECTION.test(line)) {
            current = line.replace(/:$/, "").toLowerCase()
            map[current] = map[current] || []
            continue
        }
        map[current].push(line)
    }
    return map
}

function parseExperienceBlock(lines: string[]): ImportedExperience[] {
    const items: ImportedExperience[] = []
    let i = 0
    const flushDesc = (exp: ImportedExperience, extra: string) => {
        if (!extra || SECTION.test(extra) || looksLikeJobLine(extra)) return
        if (extra.length > 8) exp.description = [exp.description, extra].filter(Boolean).join(" ")
    }
    while (i < lines.length) {
        const line = lines[i]
        const next = lines[i + 1] || ""
        const third = lines[i + 2] || ""
        const dated = line.match(/^(.+?)\s+[—–-]\s+(.+?)\s*\(([^)]+)\)\s*$/)
        const at = line.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*\(([^)]+)\)|\s+[—–-]\s+(.+))?\s*$/i)
        const onlyDate = line.match(/^((?:19|20)\d{2})\s*(?:[-–]|to)\s*((?:19|20)\d{2}|present|current|now)$/i)
        const nextSlash = next.match(/^(.+?)\s*\/\s*((?:19|20)\d{2}.+)$/i)
        const parenCompany = next.match(/^\(([^)]+)\)\s*$/) || third.match(/^\(([^)]+)\)\s*$/)

        if (dated) {
            const dates = splitDates(dated[3])
            items.push({ role: dated[1].trim(), company: dated[2].trim(), startDate: dates[0], endDate: dates[1], description: "" })
            i += 1
            continue
        }
        if (at && line.length < 160) {
            const dates = splitDates(at[3] || at[4] || "")
            const company = stripPlace(at[2].replace(/\s*\((?:19|20)\d{2}.*$/, "").trim())
            items.push({ role: at[1].trim(), company, startDate: dates[0] || "", endDate: dates[1], description: "" })
            i += 1
            continue
        }
        if (nextSlash && line.length < 80 && !SECTION.test(line)) {
            const dates = splitDates(nextSlash[2])
            const exp = { role: line, company: nextSlash[1].trim(), startDate: dates[0], endDate: dates[1], description: "" }
            flushDesc(exp, third)
            items.push(exp)
            i += third && !looksLikeJobLine(third) ? 3 : 2
            continue
        }
        if (onlyDate && next && next.length < 80 && !SECTION.test(next)) {
            const dates = splitDates(line)
            const company = (parenCompany?.[1] || (third.length < 50 && !looksLikeJobLine(third) ? third.replace(/[()]/g, "").trim() : "")).trim()
            if (company) {
                const exp = { role: next.replace(/[()]/g, "").trim(), company, startDate: dates[0], endDate: dates[1], description: "" }
                items.push(exp)
                i += parenCompany && third === parenCompany[0] || third === `(${company})` ? 3 : (company === third.replace(/[()]/g, "").trim() ? 3 : 2)
                continue
            }
        }
        if (items.length && !looksLikeJobLine(line) && !SECTION.test(line)) {
            const last = items[items.length - 1]
            last.description = [last.description, line].filter(Boolean).join(" ")
        }
        i += 1
    }
    return items.filter((e) => e.role && e.company)
}

function stripPlace(company: string) {
    const parts = company.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) return company
    const rest = parts.slice(1)
    if (rest.every((p) => isLocationLine(p) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(p))) {
        return parts[0]
    }
    return company
}

function looksLikeJobLine(line: string) {
    return /(?:19|20)\d{2}\s*(?:[-–]|to)\s*(?:(?:19|20)\d{2}|present|current|now)/i.test(line)
        || /\s+(?:at|@)\s+/.test(line)
        || /\s+[—–-]\s+.+\(/.test(line)
}

function parseProjectBlock(lines: string[]): ImportedProject[] {
    return lines
        .filter((l) => l.length > 3 && !SECTION.test(l) && !/^(selected|projects?)$/i.test(l))
        .slice(0, 8)
        .map((line) => {
            const year = line.match(/\b(19|20)\d{2}\b/)
            return {
                title: line.replace(/\b(19|20)\d{2}\b/g, "").replace(/[—–-]/g, " ").trim().slice(0, 80) || line.slice(0, 80),
                description: line,
                year: year?.[0],
            }
        })
}

function parseServiceBlock(lines: string[]): ImportedService[] {
    return lines.slice(0, 8).map((line) => {
        const priced = line.match(/\$(\d+(?:\.\d{1,2})?)/)
        return {
            name: line.replace(/\$\d+(?:\.\d{1,2})?/, "").replace(/[—–-]/g, " ").trim().slice(0, 80),
            description: line,
            price: priced ? parseFloat(priced[1]) : 0,
        }
    }).filter((s) => s.name)
}

function splitDates(raw: string): [string, string | null] {
    const parts = raw.split(/[—–-]|to/i).map((p) => p.trim()).filter(Boolean)
    if (!parts.length) return ["", null]
    const end = /present|now|current/i.test(parts[1] || "") ? null : (parts[1] || null)
    return [parts[0], end]
}

function cleanName(s: string) {
    return s.replace(/\s+/g, " ").replace(/[|·•].*$/, "").replace(/[.\s]+$/, "").trim().slice(0, 60)
}

function hostnameName(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "").split(".")[0]
    } catch {
        return undefined
    }
}

function pick(html: string, re: RegExp) {
    const m = html.match(re)
    return m?.[1]?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
}

export function stripTags(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
}

function splitCsv(line: string) {
    const out: string[] = []
    let cur = ""
    let q = false
    for (const ch of line) {
        if (ch === '"') {
            q = !q
            continue
        }
        if (ch === "," && !q) {
            out.push(cur.trim())
            cur = ""
            continue
        }
        cur += ch
    }
    out.push(cur.trim())
    return out
}

function findHeader(headers: string[], names: string[]) {
    return headers.findIndex((h) => names.includes(h))
}

function parseMoney(raw?: string) {
    if (!raw) return 0
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""))
    return Number.isFinite(n) ? n : 0
}

function parseLooseDate(raw?: string) {
    if (!raw) return undefined
    const t = Date.parse(raw)
    if (!Number.isNaN(t)) return new Date(t).toISOString()
    const compact = raw.replace(/[-:]/g, "")
    const m = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/)
    if (m) {
        const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4] || "09"}:${m[5] || "00"}:${m[6] || "00"}Z`
        const t2 = Date.parse(iso)
        if (!Number.isNaN(t2)) return new Date(t2).toISOString()
    }
    return undefined
}

function addHour(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    d.setHours(d.getHours() + 1)
    return d.toISOString()
}

function icsField(block: string, name: string) {
    const re = new RegExp(`^${name}[^:]*:(.*)$`, "im")
    const m = block.match(re)
    return m?.[1]?.replace(/\\n/g, "\n").replace(/\\,/g, ",").trim()
}

function icsDate(raw?: string) {
    return parseLooseDate(raw)
}

function flattenLd(json: unknown, out: Record<string, unknown>[], depth = 0) {
    if (!json || depth > 8 || out.length > 80) return
    if (Array.isArray(json)) {
        json.slice(0, 40).forEach((n) => flattenLd(n, out, depth + 1))
        return
    }
    const rec = asRecord(json)
    if (!rec) return
    if (rec["@graph"]) flattenLd(rec["@graph"], out, depth + 1)
    out.push(rec)
}

function ldType(node: Record<string, unknown>) {
    const t = node["@type"]
    if (Array.isArray(t)) return t.map((x) => String(x).toLowerCase()).join(" ")
    return t ? String(t).toLowerCase() : ""
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function asArray(v: unknown, depth = 0): unknown[] {
    if (!v || depth > 6) return []
    if (Array.isArray(v)) return v.slice(0, 40)
    const rec = asRecord(v)
    if (rec?.itemListElement) return asArray(rec.itemListElement, depth + 1)
    return [v]
}

function str(v: unknown, depth = 0): string | undefined {
    if (typeof v === "string") return v.trim().slice(0, 800) || undefined
    if (typeof v === "number") return String(v)
    if (depth > 4) return undefined
    const rec = asRecord(v)
    if (rec?.name) return str(rec.name, depth + 1)
    if (rec?.["@value"]) return str(rec["@value"], depth + 1)
    return undefined
}

function ldPrice(node: Record<string, unknown>) {
    const offer = asRecord(node.offers) || node
    const raw = offer.price ?? asRecord(offer.priceSpecification)?.price
    return parseMoney(raw == null ? undefined : String(raw))
}

function ldImage(node: Record<string, unknown>) {
    const img = node.image
    if (typeof img === "string") return img
    return str(asRecord(img)?.url) || str(asArray(img)[0])
}

function norm(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function omitEmpty(fields: ImportFields): ImportFields {
    const out: ImportFields = {}
    for (const [k, v] of Object.entries(fields) as [keyof ImportFields, ImportFields[keyof ImportFields]][]) {
        if (v === undefined || v === null || v === "") continue
        if (Array.isArray(v) && v.length === 0) continue
        ;(out as Record<string, unknown>)[k] = v
    }
    return out
}


/**
 * Strips bytes Postgres refuses to store in a text column.
 *
 * PDF text is recovered from raw latin1 bytes and CID glyph maps, so NUL (0x00)
 * and other C0 control characters can survive into the extracted string. Writing
 * one through Prisma fails the whole query with:
 *   22021 invalid byte sequence for encoding "UTF8": 0x00
 * Lone surrogates are dropped for the same reason — they cannot be encoded as
 * valid UTF-8. Newlines and tabs are kept because extracted text relies on them.
 */
export function sanitizeDbText(value: string): string {
    return value
        .replace(/\u0000/g, "")
        // C0 controls except \t (09) and \n (0A), plus DEL
        .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        // unpaired surrogates cannot be encoded to UTF-8
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
        .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1")
}
