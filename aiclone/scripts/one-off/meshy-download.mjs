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
const page = context.pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
await page.bringToFront()

const glbs = []
page.on("response", async (res) => {
    const url = res.url()
    if (!/\.glb(\?|$)/i.test(url) && !/model\.glb/i.test(url)) return
    try {
        const buf = Buffer.from(await res.body())
        if (buf.length < 1000) return
        const i = glbs.length
        const file = path.join(dest, `meshy-${String(i + 1).padStart(2, "0")}.glb`)
        fs.writeFileSync(file, buf)
        glbs.push({ file, bytes: buf.length, url: url.slice(0, 140) })
        console.log("saved", file, buf.length)
    } catch (e) {
        console.log("glb fail", e.message)
    }
})

const created = page.getByText("Created 3D model", { exact: false }).first()
if (await created.count()) {
    await created.click()
    await page.waitForTimeout(2500)
}
await page.screenshot({ path: path.join(out, "created-3d.png"), fullPage: false })
console.log("after created click", page.url())

const myAssets = page.getByRole("link", { name: /My Assets/i }).or(page.getByText("My Assets"))
if (await myAssets.count()) {
    await myAssets.first().click()
    await page.waitForTimeout(3000)
}
await page.screenshot({ path: path.join(out, "my-assets.png"), fullPage: false })
console.log("assets url", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 900))

const downloads = page.getByRole("button", { name: /download/i })
console.log("download buttons", await downloads.count())
const n = Math.min(await downloads.count(), 12)
for (let i = 0; i < n; i++) {
    await downloads.nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(800)
}

const glbMenu = page.getByText(/GLB/i)
console.log("GLB labels", await glbMenu.count())
for (let i = 0; i < Math.min(await glbMenu.count(), 12); i++) {
    await glbMenu.nth(i).click({ force: true }).catch(() => {})
    await page.waitForTimeout(600)
}

await page.waitForTimeout(8000)
console.log("captured", glbs.length, glbs)
await page.screenshot({ path: path.join(out, "after-download.png"), fullPage: false })
