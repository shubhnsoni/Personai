import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const dest = "C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/public/uploads/skydine-ar"
fs.mkdirSync(dest, { recursive: true })
const out = path.join(process.env.TEMP || ".", "pl-meshy")
const shot = async (page, name) => {
    await page.screenshot({ path: path.join(out, name), fullPage: false })
    console.log("shot", name, page.url())
}

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
let page = context.pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
await page.keyboard.press("Escape").catch(() => {})
await page.waitForTimeout(400)

const got = []
const saveDownload = async (d) => {
    const name = (d.suggestedFilename() || `model-${Date.now()}.glb`).replace(/[^\w.-]+/g, "-")
    const file = path.join(dest, name)
    await d.saveAs(file)
    got.push(name)
    console.log("SAVED", name, fs.statSync(file).size)
}

context.on("download", (d) => { saveDownload(d).catch((e) => console.log("dl err", e.message)) })
page.on("download", (d) => { saveDownload(d).catch((e) => console.log("dl err", e.message)) })

// 3D viewer / workspace page
await page.goto("https://www.meshy.ai/workspace", { waitUntil: "domcontentloaded", timeout: 60000 })
await page.waitForTimeout(3500)
await shot(page, "workspace-3d.png")

// Ensure Models library is visible
await page.getByText("Models", { exact: true }).last().click().catch(() => {})
await page.waitForTimeout(800)
await shot(page, "workspace-models.png")

console.log("url", page.url())
console.log("body", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500))

// Click first food-looking tile in the right library by mouse in the models grid.
const modelsTab = page.getByText("Models", { exact: true }).last()
const box = await modelsTab.boundingBox()
console.log("models tab", box)

if (box) {
    // panel is below/left of the tab. First tile is roughly under the search row.
    const clicks = []
    const startX = box.x - 180
    const startY = box.y + 70
    const stepX = 95
    const stepY = 95
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
            clicks.push({ x: startX + c * stepX, y: startY + r * stepY })
        }
    }
    for (let i = 0; i < 10; i++) {
        const p = clicks[i]
        console.log("click tile", i, p)
        await page.mouse.click(p.x, p.y)
        await page.waitForTimeout(2500)
        await shot(page, `viewer-${i}.png`)

        // Hover center of the 3D viewport
        await page.mouse.move(700, 420)
        await page.waitForTimeout(600)

        const dl = page.getByRole("button", { name: /download/i })
        const n = await dl.count()
        console.log("download buttons", n)
        if (n) {
            await dl.last().click({ force: true })
            await page.waitForTimeout(800)
            const glb = page.getByText(/^GLB$/i).or(page.getByRole("menuitem", { name: /GLB/i }))
            if (await glb.count()) {
                const [download] = await Promise.all([
                    page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
                    glb.last().click({ force: true }),
                ])
                if (download) await saveDownload(download)
            } else {
                const [download] = await Promise.all([
                    page.waitForEvent("download", { timeout: 12000 }).catch(() => null),
                    Promise.resolve(),
                ])
                if (download) await saveDownload(download)
            }
        }
        await page.waitForTimeout(500)
    }
}

console.log("got", got)
console.log("dir", fs.readdirSync(dest))
await shot(page, "viewer-done.png")
