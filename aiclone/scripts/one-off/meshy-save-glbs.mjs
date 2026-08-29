import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const dest = "C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/public/uploads/skydine-ar"
fs.mkdirSync(dest, { recursive: true })
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
const page = context.pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()

const saved = []
const seen = new Set()
const onResp = async (res) => {
    const url = res.url()
    if (!/glb/i.test(url)) return
    if (seen.has(url.split("?")[0])) return
    try {
        const buf = Buffer.from(await res.body())
        if (buf.length < 5000) return
        seen.add(url.split("?")[0])
        const file = path.join(dest, `food-${String(saved.length + 1).padStart(2, "0")}.glb`)
        fs.writeFileSync(file, buf)
        saved.push({ file: path.basename(file), bytes: buf.length })
        console.log("glb", path.basename(file), buf.length)
    } catch { /* ignore */ }
}
page.on("response", onResp)
context.on("page", (p) => p.on("response", onResp))

page.on("download", async (d) => {
    const file = path.join(dest, d.suggestedFilename() || `dl-${Date.now()}.glb`)
    await d.saveAs(file)
    console.log("download event", file)
})

const hrefs = await page.evaluate(() => {
    return [...document.querySelectorAll("a, button, [role='button']")]
        .slice(0, 80)
        .map((el) => ({ tag: el.tagName, text: (el.innerText || el.getAttribute("aria-label") || "").slice(0, 60), href: el.href || "" }))
        .filter((x) => /download|glb|asset/i.test(x.text + x.href))
})
console.log("controls", JSON.stringify(hrefs.slice(0, 30), null, 2))

const assets = page.locator("text=Models").first()
if (await assets.count()) await assets.click().catch(() => {})
await page.waitForTimeout(800)

console.log("imgs", await page.locator("img").count())

const names = ["burger", "pizza", "cappuccino", "shake", "salad", "avocado", "brownie", "pancake", "momo", "garlic", "steamer", "bread"]
for (const name of names) {
    const tile = page.getByRole("img", { name: new RegExp(name, "i") }).first()
    if (await tile.count()) {
        await tile.click({ force: true }).catch(() => {})
        await page.waitForTimeout(1200)
    }
}

const count = await page.locator("aside img, [class*='library'] img, [class*='asset'] img").count()
console.log("library imgs", count)

await page.screenshot({ path: path.join(out, "before-click-model.png"), fullPage: false })

const panelImgs = page.locator("img[src*='meshy'], img[src*='asset']")
console.log("meshy imgs", await panelImgs.count())

for (let i = 0; i < Math.min(12, await panelImgs.count()); i++) {
    await panelImgs.nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(1500)
    const dl = page.getByRole("button", { name: /download/i }).first()
    if (await dl.count()) {
        await dl.click({ force: true }).catch(() => {})
        await page.waitForTimeout(600)
        const glb = page.getByText(/^GLB$/i).first()
        if (await glb.count()) await glb.click({ force: true }).catch(() => {})
        await page.waitForTimeout(1500)
    }
}

await page.waitForTimeout(4000)
console.log("saved so far", saved)
await page.screenshot({ path: path.join(out, "save-pass.png"), fullPage: false })
