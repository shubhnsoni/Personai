import { encodeQr } from "@/lib/qr-encode"
import { hotelQrPath } from "./paths"
import { zipStore } from "./zip-store"

export const QR_QUIET_ZONE_MODULES = 4
export const PRINT_DPI = 300
export const PRINT_BLEED_MM = 3

export const PAPER_MM = {
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    A6: { width: 105, height: 148 },
} as const

export type PrintPaper = keyof typeof PAPER_MM

export const PRINT_TEMPLATES = [
    { id: "room_card", paper: "A6" as const, label: "Room card" },
    { id: "bedside", paper: "A6" as const, label: "Bedside" },
    { id: "door_sticker", paper: "A6" as const, label: "Door sticker" },
    { id: "reception_stand", paper: "A5" as const, label: "Reception stand" },
    { id: "table_tent", paper: "A5" as const, label: "Table tent" },
] as const

export type PrintQrRow = {
    code: string
    kind: string
    label: string | null
    roomNumber: string | null
}

export type PrintBrand = {
    slug: string
    hotelName: string
    origin: string
    accent: string
    logoUrl?: string | null
    qrs: PrintQrRow[]
}

export function paperPixels(paper: PrintPaper): { width: number; height: number } {
    const size = PAPER_MM[paper]
    return {
        width: Math.round((size.width / 25.4) * PRINT_DPI),
        height: Math.round((size.height / 25.4) * PRINT_DPI),
    }
}

export function validatePrintQr(input: { url: string; quietModules: number }): { ok: boolean; reason?: string } {
    if (input.quietModules < QR_QUIET_ZONE_MODULES) {
        return { ok: false, reason: `Quiet zone must be at least ${QR_QUIET_ZONE_MODULES} modules` }
    }
    try {
        const parsed = new URL(input.url)
        if (!/^https?:$/i.test(parsed.protocol)) return { ok: false, reason: "URL must be http(s)" }
        if (!parsed.pathname.startsWith("/q/")) return { ok: false, reason: "Print QR must point at /q/{code}" }
        return { ok: true }
    } catch {
        return { ok: false, reason: "URL is not valid" }
    }
}

function xmlEscape(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function qrSvg(url: string, opts?: { quietModules?: number; dark?: string; light?: string }): string {
    const quiet = opts?.quietModules ?? QR_QUIET_ZONE_MODULES
    const modules = encodeQr(url)
    const dim = modules.size + quiet * 2
    const dark = opts?.dark || "#141311"
    const light = opts?.light || "#fffdf8"
    const rects: string[] = []
    for (let r = 0; r < modules.size; r++) {
        for (let c = 0; c < modules.size; c++) {
            if (!modules.get(r, c)) continue
            rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`)
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges" role="img" aria-label="QR">
<rect width="${dim}" height="${dim}" fill="${xmlEscape(light)}"/>
<g fill="${xmlEscape(dark)}">${rects.join("")}</g>
</svg>`
}

function destUrl(origin: string, code: string) {
    return `${origin.replace(/\/$/, "")}${hotelQrPath(code)}`
}

export function buildPrintCsv(input: { origin: string; qrs: PrintQrRow[] }): string {
    const lines = ["room,kind,code,url,label"]
    for (const row of input.qrs) {
        const url = destUrl(input.origin, row.code)
        const room = row.roomNumber || (row.kind === "PROPERTY" ? "property" : "")
        const label = (row.label || row.kind).replace(/,/g, " ")
        lines.push([room, row.kind, row.code, url, label].join(","))
    }
    return `${lines.join("\n")}\n`
}

function nestedQr(url: string, x: number, y: number, size: number, accent: string) {
    const inner = qrSvg(url, { dark: "#141311", light: "#fffdf8" })
    const body = inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
    const modules = encodeQr(url)
    const dim = modules.size + QR_QUIET_ZONE_MODULES * 2
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">${body}<rect x="0.4" y="0.4" width="${dim - 0.8}" height="${dim - 0.8}" fill="none" stroke="${xmlEscape(accent)}" stroke-width="0.25"/></svg>`
}

function sheet(opts: {
    paper: PrintPaper
    title: string
    kicker: string
    subtitle: string
    url: string
    accent: string
    hotelName: string
    logoUrl?: string | null
    landscape?: boolean
}): string {
    const size = PAPER_MM[opts.paper]
    const w = opts.landscape ? size.height : size.width
    const h = opts.landscape ? size.width : size.height
    const qrSize = Math.min(w, h) * 0.52
    const qrX = (w - qrSize) / 2
    const qrY = h * 0.22
    const logo = opts.logoUrl
        ? `<image href="${xmlEscape(opts.logoUrl)}" x="8" y="7" width="12" height="12" preserveAspectRatio="xMidYMid slice"/>`
        : ""
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fbf7ef"/>
  <rect width="${w}" height="4" fill="${xmlEscape(opts.accent)}"/>
  ${logo}
  <text x="${opts.logoUrl ? 22 : 8}" y="12" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4.2" font-weight="600" fill="#141311">${xmlEscape(opts.hotelName)}</text>
  <text x="8" y="20" font-family="ui-sans-serif, system-ui, sans-serif" font-size="3.2" letter-spacing="0.4" fill="${xmlEscape(opts.accent)}">${xmlEscape(opts.kicker.toUpperCase())}</text>
  <text x="8" y="${qrY - 4}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="8" font-weight="600" fill="#141311">${xmlEscape(opts.title)}</text>
  ${nestedQr(opts.url, qrX, qrY, qrSize, opts.accent)}
  <text x="${w / 2}" y="${qrY + qrSize + 8}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4" fill="#3f3a34">${xmlEscape(opts.subtitle)}</text>
  <text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-family="ui-sans-serif, ui-monospace, monospace" font-size="3" fill="#6b645b">${xmlEscape(opts.url.replace(/^https?:\/\//, ""))}</text>
</svg>`
}

function a4RoomSheet(brand: PrintBrand, rooms: PrintQrRow[]): string {
    const w = PAPER_MM.A4.width
    const h = PAPER_MM.A4.height
    const cards = rooms.slice(0, 3)
    const cell = 58
    const gap = (w - cell * cards.length) / (cards.length + 1)
    const blocks = cards.map((row, i) => {
        const x = gap + i * (cell + gap)
        const y = 40
        const url = destUrl(brand.origin, row.code)
        return `<g>
  <text x="${x + cell / 2}" y="${y - 4}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="5" font-weight="600" fill="#141311">${xmlEscape(row.label || `Room ${row.roomNumber}`)}</text>
  ${nestedQr(url, x, y, cell, brand.accent)}
</g>`
    }).join("")
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fbf7ef"/>
  <rect width="${w}" height="6" fill="${xmlEscape(brand.accent)}"/>
  <text x="12" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="600" fill="#141311">${xmlEscape(brand.hotelName)} · room QRs</text>
  <text x="12" y="30" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4" fill="#6b645b">Test each /q code before print. Quiet zone is built in.</text>
  ${blocks}
</svg>`
}

function readme(brand: PrintBrand): string {
    return [
        `${brand.hotelName} print kit`,
        "",
        "Vector QR (SVG) with a 4-module quiet zone. Use Test QR on the dashboard before sending to print.",
        `Raster fallback size is ${PRINT_DPI} DPI for A6 (${paperPixels("A6").width}×${paperPixels("A6").height} px).`,
        `Bleed: ${PRINT_BLEED_MM} mm recommended; crop marks and CMYK conversion are a later slice — do not hold print for them.`,
        "Scan destination is always introify.com/q/{code} so room numbers can move without reprinting the code.",
        "mapping.csv is room → kind → code → URL.",
        brand.logoUrl ? `Logo: ${brand.logoUrl}` : "No hotel logo on file — wordmark only.",
        `Accent: ${brand.accent}`,
        "",
        "Templates: room card, bedside, door sticker (A6); reception stand and table tent (A5); A4 room sheet.",
    ].join("\n")
}

function fileSafe(value: string) {
    return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
}

export function buildPrintPackage(brand: PrintBrand): { zip: Uint8Array; filename: string; csv: string } {
    const origin = brand.origin.replace(/\/$/, "")
    const csv = buildPrintCsv({ origin, qrs: brand.qrs })
    const entries: { name: string; data: Uint8Array }[] = []
    const utf8 = new TextEncoder()
    entries.push({ name: "mapping.csv", data: utf8.encode(csv) })
    entries.push({ name: "README.txt", data: utf8.encode(readme(brand)) })

    const rooms = brand.qrs.filter((row) => row.kind === "ROOM" && row.roomNumber)
    const property = brand.qrs.find((row) => row.kind === "PROPERTY") || rooms[0]

    for (const row of brand.qrs) {
        const url = destUrl(origin, row.code)
        const check = validatePrintQr({ url, quietModules: QR_QUIET_ZONE_MODULES })
        if (!check.ok) throw new Error(check.reason || "QR is not print-ready")
        const stem = row.roomNumber ? `room-${fileSafe(row.roomNumber)}` : "property"
        entries.push({ name: `qrs/${stem}.svg`, data: utf8.encode(qrSvg(url, { dark: "#141311", light: "#fffdf8" })) })
    }

    for (const room of rooms) {
        const url = destUrl(origin, room.code)
        const number = room.roomNumber || ""
        entries.push({
            name: `templates/room-card-${fileSafe(number)}.svg`,
            data: utf8.encode(sheet({
                paper: "A6",
                hotelName: brand.hotelName,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: `Room ${number}`,
                kicker: "Room card",
                subtitle: "Scan for towels, Wi-Fi, food, reception",
                url,
            })),
        })
        entries.push({
            name: `templates/bedside-${fileSafe(number)}.svg`,
            data: utf8.encode(sheet({
                paper: "A6",
                hotelName: brand.hotelName,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: `Room ${number}`,
                kicker: "Bedside",
                subtitle: "The concierge already knows this room",
                url,
            })),
        })
        entries.push({
            name: `templates/door-sticker-${fileSafe(number)}.svg`,
            data: utf8.encode(sheet({
                paper: "A6",
                hotelName: brand.hotelName,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: `Room ${number}`,
                kicker: "Door sticker",
                subtitle: "Ask anything. Request anything.",
                url,
            })),
        })
    }

    if (property) {
        const url = destUrl(origin, property.code)
        entries.push({
            name: "templates/reception-stand.svg",
            data: utf8.encode(sheet({
                paper: "A5",
                hotelName: brand.hotelName,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: brand.hotelName,
                kicker: "Reception stand",
                subtitle: "Scan the property QR — no app required",
                url,
            })),
        })
        entries.push({
            name: "templates/table-tent.svg",
            data: utf8.encode(sheet({
                paper: "A5",
                hotelName: brand.hotelName,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: "Ask the concierge",
                kicker: "Table tent",
                subtitle: "Towels, Wi-Fi, food, or reception",
                url,
            })),
        })
    }

    if (rooms.length) {
        entries.push({
            name: "templates/a4-room-sheet.svg",
            data: utf8.encode(a4RoomSheet(brand, rooms)),
        })
    }

    return {
        zip: zipStore(entries),
        filename: `${fileSafe(brand.slug)}-print-kit.zip`,
        csv,
    }
}
