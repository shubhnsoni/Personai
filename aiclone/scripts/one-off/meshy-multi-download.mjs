import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const dest = "C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/public/uploads/skydine-ar"
fs.mkdirSync(dest, { recursive: true })
const out = path.join(process.env.TEMP || ".", "pl-meshy")
const shot = async (page, name) => {
    const file = path.join(out, name)
    await page.screenshot({ path: file, fullPage: false })
    console.log("shot", name)
}

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
const page = context.pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
page.setDefaultTimeout(12000)

const got = []
context.on("download", async (d) => {
    const name = d.suggestedFilename() || `meshy-${Date.now()}`
    const file = path.join(dest, name)
    await d.saveAs(file)
    got.push({ name, file })
    console.log("saved download", name)
})

// Close lightbox if open
const close = page.locator('[aria-label="Close"], button:has-text("×")').first()
if (await close.count()) await close.click({ force: true }).catch(() => {})
await page.keyboard.press("Escape").catch(() => {})
await page.waitForTimeout(500)

const modelsTab = page.getByText("Models", { exact: true }).first()
if (await modelsTab.count()) await modelsTab.click()
await page.waitForTimeout(800)

// Selection toggle in the assets toolbar (checkbox square)
console.log("trying select mode")
const toolbarBtns = page.locator("text=Search Mo").locator("xpath=ancestor::div[1]/button")
console.log("toolbar near search", await toolbarBtns.count())

await page.getByRole("button", { name: /select|multi/i }).click({ timeout: 3000 }).catch(() => {})

// Click the rightmost small icon in the models panel header
const panel = page.locator("text=Search Mo…").or(page.getByPlaceholder(/Search/i)).first()
if (await panel.count()) {
    const header = panel.locator("xpath=ancestor::div[contains(@class,'')][2]")
    const btns = header.locator("button")
    const n = await btns.count()
    console.log("header buttons", n)
    if (n > 0) await btns.last().click({ force: true }).catch(() => {})
}

await shot(page, "select-mode.png")

// Click first 10 model tiles in the right-side Models grid
console.log("imgs", await page.locator("img").count())

// Click the 10 food tiles in the right panel by going through visible model cards
const cards = page.locator("[class*='cursor-pointer'] img, [class*='asset'] img")
console.log("cards", await cards.count())

for (let i = 0; i < Math.min(10, await cards.count()); i++) {
    await cards.nth(i).click({ force: true, modifiers: ["Control"] }).catch(() => {})
    await page.waitForTimeout(200)
}

await shot(page, "selected.png")

const exportBtn = page.getByRole("button", { name: /download|export|zip/i })
console.log("export buttons", await exportBtn.count(), await exportBtn.allTextContents().catch(() => []))
if (await exportBtn.count()) await exportBtn.first().click()

await page.getByText(/Download selected|Export|ZIP|GLB/i).first().click({ timeout: 4000 }).catch(() => {})
await page.waitForTimeout(4000)
await shot(page, "after-export.png")
console.log("got", got)
console.log("body tail", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(-600))
