import { encodeQr } from "@/lib/qr-encode"
import { zipStore } from "@/lib/hotels/zip-store"

export const QR_QUIET_ZONE_MODULES = 4
export const PRINT_DPI = 300
export const PRINT_BLEED_MM = 3

export const PAPER_MM = {
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    A6: { width: 105, height: 148 },
} as const

export type PrintPaper = keyof typeof PAPER_MM

export const FOOD_PRINT_TEMPLATES = [
    { id: "table_tent", paper: "A5" as const, label: "Table tent" },
    { id: "table_card", paper: "A6" as const, label: "Table card" },
    { id: "counter_stand", paper: "A5" as const, label: "Counter stand" },
    { id: "menu_qr_sheet", paper: "A4" as const, label: "Menu QR sheet" },
] as const

export type FoodPrintTable = {
    code: string
    label: string
    seats?: number | null
    zone?: string | null
}

export type FoodPrintBrand = {
    slug: string
    name: string
    origin: string
    accent: string
    logoUrl?: string | null
    tables: FoodPrintTable[]
}

export function paperPixels(paper: PrintPaper): { width: number; height: number } {
    const size = PAPER_MM[paper]
    return {
        width: Math.round((size.width / 25.4) * PRINT_DPI),
        height: Math.round((size.height / 25.4) * PRINT_DPI),
    }
}

export function menuUrl(origin: string, slug: string, tableCode?: string | null) {
    const base = `${origin.replace(/\/$/, "")}/${slug}/menu`
    if (!tableCode) return base
    return `${base}?t=${encodeURIComponent(tableCode)}`
}

export function validateFoodPrintQr(input: { url: string; quietModules: number; slug: string }): { ok: boolean; reason?: string } {
    if (input.quietModules < QR_QUIET_ZONE_MODULES) {
        return { ok: false, reason: `Quiet zone must be at least ${QR_QUIET_ZONE_MODULES} modules` }
    }
    try {
        const parsed = new URL(input.url)
        if (!/^https?:$/i.test(parsed.protocol)) return { ok: false, reason: "URL must be http(s)" }
        const expected = `/${input.slug}/menu`
        if (parsed.pathname !== expected) return { ok: false, reason: "Print QR must point at /{slug}/menu" }
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
    name: string
    logoUrl?: string | null
}): string {
    const size = PAPER_MM[opts.paper]
    const w = size.width
    const h = size.height
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
  <text x="${opts.logoUrl ? 22 : 8}" y="12" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4.2" font-weight="600" fill="#141311">${xmlEscape(opts.name)}</text>
  <text x="8" y="20" font-family="ui-sans-serif, system-ui, sans-serif" font-size="3.2" letter-spacing="0.4" fill="${xmlEscape(opts.accent)}">${xmlEscape(opts.kicker.toUpperCase())}</text>
  <text x="8" y="${qrY - 4}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="8" font-weight="600" fill="#141311">${xmlEscape(opts.title)}</text>
  ${nestedQr(opts.url, qrX, qrY, qrSize, opts.accent)}
  <text x="${w / 2}" y="${qrY + qrSize + 8}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4" fill="#3f3a34">${xmlEscape(opts.subtitle)}</text>
  <text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-family="ui-sans-serif, ui-monospace, monospace" font-size="3" fill="#6b645b">${xmlEscape(opts.url.replace(/^https?:\/\//, ""))}</text>
</svg>`
}

function a4TableSheet(brand: FoodPrintBrand, tables: FoodPrintTable[]): string {
    const w = PAPER_MM.A4.width
    const h = PAPER_MM.A4.height
    const cards = tables.slice(0, 6)
    const cols = Math.min(3, Math.max(1, cards.length))
    const cell = 52
    const gapX = (w - cell * cols) / (cols + 1)
    const gapY = 18
    const blocks = cards.map((row, i) => {
        const col = i % cols
        const rowIdx = Math.floor(i / cols)
        const x = gapX + col * (cell + gapX)
        const y = 42 + rowIdx * (cell + gapY)
        const url = menuUrl(brand.origin, brand.slug, row.code)
        return `<g>
  <text x="${x + cell / 2}" y="${y - 4}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4.5" font-weight="600" fill="#141311">${xmlEscape(row.label)}</text>
  ${nestedQr(url, x, y, cell, brand.accent)}
</g>`
    }).join("")
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fbf7ef"/>
  <rect width="${w}" height="6" fill="${xmlEscape(brand.accent)}"/>
  <text x="12" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="600" fill="#141311">${xmlEscape(brand.name)} · table QRs</text>
  <text x="12" y="30" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4" fill="#6b645b">Each code opens /${xmlEscape(brand.slug)}/menu with that table locked. Test before print.</text>
  ${blocks}
</svg>`
}

export function buildFoodPrintCsv(input: { origin: string; slug: string; tables: FoodPrintTable[] }): string {
    const lines = ["table,zone,seats,code,url"]
    for (const row of input.tables) {
        const url = menuUrl(input.origin, input.slug, row.code)
        const zone = (row.zone || "").replace(/,/g, " ")
        const seats = row.seats == null ? "" : String(row.seats)
        lines.push([row.label.replace(/,/g, " "), zone, seats, row.code, url].join(","))
    }
    return `${lines.join("\n")}\n`
}

function readme(brand: FoodPrintBrand): string {
    return [
        `${brand.name} food print kit`,
        "",
        "Vector QR (SVG) with a 4-module quiet zone. Download from the restaurant floor desk, then test each code before print.",
        `Raster fallback size is ${PRINT_DPI} DPI for A6 (${paperPixels("A6").width}×${paperPixels("A6").height} px).`,
        `Bleed: ${PRINT_BLEED_MM} mm recommended.`,
        `Scan destination is /${brand.slug}/menu?t={code} so table labels can move without reprinting when you rotate a code.`,
        "mapping.csv is table → zone → seats → code → URL.",
        brand.logoUrl ? `Logo: ${brand.logoUrl}` : "No logo on file — wordmark only.",
        `Accent: ${brand.accent}`,
        "",
        "Templates: table card (A6), table tent + counter stand (A5), A4 menu QR sheet.",
        `Guest print preview: /${brand.slug}/print`,
    ].join("\n")
}

function fileSafe(value: string) {
    return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "table"
}

export function buildFoodPrintPackage(brand: FoodPrintBrand): { zip: Uint8Array; filename: string; csv: string } {
    const origin = brand.origin.replace(/\/$/, "")
    const tables = brand.tables
    const csv = buildFoodPrintCsv({ origin, slug: brand.slug, tables })
    const entries: { name: string; data: Uint8Array }[] = []
    const utf8 = new TextEncoder()
    entries.push({ name: "mapping.csv", data: utf8.encode(csv) })
    entries.push({ name: "README.txt", data: utf8.encode(readme({ ...brand, origin })) })

    const propertyUrl = menuUrl(origin, brand.slug)
    const propertyCheck = validateFoodPrintQr({ url: propertyUrl, quietModules: QR_QUIET_ZONE_MODULES, slug: brand.slug })
    if (!propertyCheck.ok) throw new Error(propertyCheck.reason || "Menu QR is not print-ready")
    entries.push({ name: "qrs/menu.svg", data: utf8.encode(qrSvg(propertyUrl, { dark: "#141311", light: "#fffdf8" })) })
    entries.push({
        name: "templates/counter-stand.svg",
        data: utf8.encode(sheet({
            paper: "A5",
            name: brand.name,
            accent: brand.accent,
            logoUrl: brand.logoUrl,
            title: brand.name,
            kicker: "Counter stand",
            subtitle: "Scan for the live menu — no app required",
            url: propertyUrl,
        })),
    })
    entries.push({
        name: "templates/menu-qr-sheet.svg",
        data: utf8.encode(sheet({
            paper: "A4",
            name: brand.name,
            accent: brand.accent,
            logoUrl: brand.logoUrl,
            title: "Scan the menu",
            kicker: "Menu QR",
            subtitle: "Order at the table or takeaway",
            url: propertyUrl,
        })),
    })

    for (const table of tables) {
        const url = menuUrl(origin, brand.slug, table.code)
        const check = validateFoodPrintQr({ url, quietModules: QR_QUIET_ZONE_MODULES, slug: brand.slug })
        if (!check.ok) throw new Error(check.reason || "Table QR is not print-ready")
        const stem = fileSafe(table.label)
        entries.push({ name: `qrs/${stem}.svg`, data: utf8.encode(qrSvg(url, { dark: "#141311", light: "#fffdf8" })) })
        entries.push({
            name: `templates/table-card-${stem}.svg`,
            data: utf8.encode(sheet({
                paper: "A6",
                name: brand.name,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: table.label,
                kicker: "Table card",
                subtitle: "Scan to open this table's menu",
                url,
            })),
        })
        entries.push({
            name: `templates/table-tent-${stem}.svg`,
            data: utf8.encode(sheet({
                paper: "A5",
                name: brand.name,
                accent: brand.accent,
                logoUrl: brand.logoUrl,
                title: table.label,
                kicker: "Table tent",
                subtitle: "Ask anything. Order from your seat.",
                url,
            })),
        })
    }

    if (tables.length) {
        entries.push({
            name: "templates/a4-table-sheet.svg",
            data: utf8.encode(a4TableSheet({ ...brand, origin }, tables)),
        })
    }

    return {
        zip: zipStore(entries),
        filename: `${fileSafe(brand.slug)}-print-kit.zip`,
        csv,
    }
}
