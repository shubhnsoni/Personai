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
await page.keyboard.press("Escape").catch(() => {})

const got = []
page.on("download", async (d) => {
    try {
        const name = (d.suggestedFilename() || `model-${Date.now()}.glb`).replace(/[^\w.-]+/g, "-")
        const file = path.join(dest, name)
        await d.saveAs(file)
        got.push(name)
        console.log("DOWNLOAD", name, fs.statSync(file).size)
    } catch (e) {
        console.log("save fail", e.message)
    }
})

// Left-rail 3D thumbs sit under "Created 3D model"
const label = page.getByText("Created 3D model", { exact: false }).first()
if (await label.count()) {
    await label.scrollIntoViewIfNeeded().catch(() => {})
}

const thumbs = page.locator("img").filter({ has: page.locator("xpath=ancestor::div") })
// Prefer images in the chat column
const chatImgs = page.locator("div").filter({ hasText: "Created 3D model" }).locator("img")
const n = await chatImgs.count()
console.log("chat 3d thumbs", n)

const count = n > 0 ? n : 10
for (let i = 0; i < Math.min(count, 10); i++) {
    const img = n > 0 ? chatImgs.nth(i) : page.locator("img").nth(i)
    await img.click({ force: true })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: path.join(out, `view-${i}.png`), fullPage: false })

    const dl = page.getByRole("button", { name: /download/i })
    console.log("i", i, "download btns", await dl.count())
    if (await dl.count()) {
        const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
            dl.first().click({ force: true }),
        ])
        if (download) {
            const name = (download.suggestedFilename() || `model-${i}.glb`).replace(/[^\w.-]+/g, "-")
            const file = path.join(dest, name)
            await download.saveAs(file)
            got.push(name)
            console.log("got", name)
        } else {
            const glb = page.getByText(/^GLB$/).or(page.getByRole("menuitem", { name: /GLB/i }))
            if (await glb.count()) {
                const [d2] = await Promise.all([
                    page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
                    glb.first().click({ force: true }),
                ])
                if (d2) {
                    const name = (d2.suggestedFilename() || `model-${i}.glb`).replace(/[^\w.-]+/g, "-")
                    await d2.saveAs(path.join(dest, name))
                    got.push(name)
                    console.log("got glb menu", name)
                }
            }
        }
    }
    await page.waitForTimeout(600)
}

console.log("all", got)
console.log("dir", fs.readdirSync(dest))
await page.screenshot({ path: path.join(out, "after-manual.png"), fullPage: false })
