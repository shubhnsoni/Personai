import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const dest = "C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/public/uploads/skydine-ar"
fs.mkdirSync(dest, { recursive: true })
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
await page.keyboard.press("Escape").catch(() => {})
await page.waitForTimeout(500)

const got = []
async function saveDownload(d) {
    const name = (d.suggestedFilename() || `model-${Date.now()}.glb`).replace(/[^\w.-]+/g, "-")
    const file = path.join(dest, name)
    await d.saveAs(file)
    got.push(name)
    console.log("SAVED", name, fs.statSync(file).size)
}
page.on("download", (d) => { saveDownload(d).catch((e) => console.log(e.message)) })

const models = page.getByAltText("3D Model")
const n = await models.count()
console.log("3D Model alts", n)

for (let i = 0; i < Math.min(n, 12); i++) {
    const el = models.nth(i)
    await el.scrollIntoViewIfNeeded().catch(() => {})
    await el.hover({ force: true })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(out, `hover-${i}.png`), fullPage: false })
    console.log("hovered", i)

    await el.click({ force: true })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: path.join(out, `clicked-3d-${i}.png`), fullPage: false })

    const dl = page.getByRole("button", { name: /download/i })
    console.log("  download btns", await dl.count(), "url", page.url())
    if (await dl.count()) {
        await dl.last().click({ force: true })
        await page.waitForTimeout(700)
        const glb = page.getByText(/^GLB$/).or(page.getByRole("menuitem", { name: /GLB/i }))
        const waiter = page.waitForEvent("download", { timeout: 18000 }).catch(() => null)
        if (await glb.count()) await glb.last().click({ force: true })
        const d = await waiter
        if (d) await saveDownload(d)
    }
    await page.keyboard.press("Escape").catch(() => {})
    await page.waitForTimeout(400)
}

console.log("got", got)
console.log("dir", fs.readdirSync(dest))
