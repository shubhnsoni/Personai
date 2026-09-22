import { describe, expect, it } from "vitest"
import { encodeQr } from "@/lib/qr-encode"
import { unzipStore } from "@/lib/hotels/zip-store"
import {
    FOOD_PRINT_TEMPLATES,
    PRINT_DPI,
    QR_QUIET_ZONE_MODULES,
    buildFoodPrintCsv,
    buildFoodPrintPackage,
    menuUrl,
    paperPixels,
    qrSvg,
    validateFoodPrintQr,
} from "@/lib/restaurants/print-kit"

describe("restaurant print kit", () => {
    it("ships table tent, table card, counter stand, and menu QR sheet", () => {
        const ids = FOOD_PRINT_TEMPLATES.map((row) => row.id)
        expect(ids).toEqual(expect.arrayContaining([
            "table_tent",
            "table_card",
            "counter_stand",
            "menu_qr_sheet",
        ]))
        expect(FOOD_PRINT_TEMPLATES.every((row) => ["A4", "A5", "A6"].includes(row.paper))).toBe(true)
        expect(PRINT_DPI).toBe(300)
        expect(paperPixels("A6")).toEqual({ width: 1240, height: 1748 })
    })

    it("encodes vector QR with quiet zone and requires /{slug}/menu destinations", () => {
        const url = "https://introify.com/skydine-cafe/menu?t=tableCode1"
        const svg = qrSvg(url, { quietModules: QR_QUIET_ZONE_MODULES })
        expect(svg).toContain("<svg")
        expect(svg).toContain("shape-rendering=\"crispEdges\"")
        expect(validateFoodPrintQr({ url, quietModules: QR_QUIET_ZONE_MODULES, slug: "skydine-cafe" }).ok).toBe(true)
        expect(validateFoodPrintQr({ url, quietModules: 3, slug: "skydine-cafe" }).ok).toBe(false)
        expect(validateFoodPrintQr({ url: "https://introify.com/q/abc", quietModules: 4, slug: "skydine-cafe" }).ok).toBe(false)
        const modules = encodeQr(url)
        expect(svg).toContain(`viewBox="0 0 ${modules.size + 8} ${modules.size + 8}"`)
        expect(menuUrl("https://introify.com", "skydine-cafe", "t1")).toBe("https://introify.com/skydine-cafe/menu?t=t1")
    })

    it("builds ZIP + CSV mapping tables to menu?t= URLs", () => {
        const pack = buildFoodPrintPackage({
            slug: "skydine-cafe",
            name: "SkyDine Cafe",
            origin: "https://introify.com",
            accent: "#00D7FF",
            logoUrl: null,
            tables: [
                { code: "tA1", label: "Table 1", seats: 4, zone: "Ground" },
                { code: "tA2", label: "Table 2", seats: 2, zone: "Terrace" },
            ],
        })
        const files = unzipStore(pack.zip)
        const names = Object.keys(files)
        expect(names).toEqual(expect.arrayContaining([
            "mapping.csv",
            "README.txt",
            "qrs/menu.svg",
            "qrs/table-1.svg",
            "templates/table-card-table-1.svg",
            "templates/table-tent-table-1.svg",
            "templates/counter-stand.svg",
            "templates/menu-qr-sheet.svg",
            "templates/a4-table-sheet.svg",
        ]))
        const csv = new TextDecoder().decode(files["mapping.csv"])
        expect(csv).toMatch(/^table,zone,seats,code,url/m)
        expect(csv).toContain("Table 1,Ground,4,tA1,https://introify.com/skydine-cafe/menu?t=tA1")
        const mapping = buildFoodPrintCsv({
            origin: "https://introify.com",
            slug: "skydine-cafe",
            tables: [{ code: "tA1", label: "Table 1", seats: 4, zone: "Ground" }],
        })
        expect(mapping).toContain("/skydine-cafe/menu?t=tA1")
        const card = new TextDecoder().decode(files["templates/table-card-table-1.svg"])
        expect(card).toContain("SkyDine Cafe")
        expect(card).toContain("#00D7FF")
        expect(card).toContain("Table 1")
        expect(card).toContain("105mm")
        const readme = new TextDecoder().decode(files["README.txt"]).toLowerCase()
        expect(readme).toMatch(/300 dpi/)
        expect(readme).toMatch(/quiet zone/)
        expect(readme).toMatch(/guest print/)
        expect(pack.filename).toMatch(/skydine-cafe.*print/i)
    })
})
