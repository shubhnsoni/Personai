import pkg from "file:///C:/Users/shubh/AppData/Local/Temp/pw-core/node_modules/playwright-core/index.js"
const { chromium } = pkg
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const outDir = "C:\\Users\\shubh\\AppData\\Local\\Temp\\grok-edge-onboard\\shots"
mkdirSync(outDir, { recursive: true })

const browser = await chromium.connectOverCDP("http://127.0.0.1:9226")
const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = context.pages()[0] || await context.newPage()
await page.setViewportSize({ width: 390, height: 844 })

async function shot(name) {
    const path = join(outDir, `${name}.png`)
    await page.screenshot({ path, fullPage: true })
    console.log("SHOT", name, page.url())
    const h1 = await page.locator("h1").first().textContent().catch(() => "")
    console.log("H1", h1)
    return h1
}

await page.goto("http://127.0.0.1:3000/qa/onboard?need=page", { waitUntil: "domcontentloaded", timeout: 30000 })
await page.waitForTimeout(1500)
const s1 = await shot("01-who")

const name = page.locator('input').first()
if (await name.count()) {
    await name.fill("Shubh QA")
}
const continueBtn = page.getByRole("button", { name: /continue/i }).first()
await continueBtn.click()
await page.waitForTimeout(500)
const s2 = await shot("02-bot")

const cards = await page.locator("button").evaluateAll((els) =>
    els.map((el) => ({
        text: (el.innerText || "").replace(/\s+/g, " ").trim(),
        width: Math.round(el.getBoundingClientRect().width),
        className: el.className,
    })).filter((x) => /just a page|sell things|restaurant/i.test(x.text))
)
console.log("NEED_CARDS", JSON.stringify(cards, null, 2))

const just = page.getByRole("button", { name: /just a page/i }).first()
if (await just.count()) await just.click()
await continueBtn.click()
await page.waitForTimeout(500)
const s3 = await shot("03-setup")

await continueBtn.click()
await page.waitForTimeout(900)
const s4 = await shot("04-face")

const blobTile = page.getByRole("button", { name: /blob/i }).first()
console.log("BLOB_TILE", await blobTile.count())
const customise = page.getByRole("button", { name: /customise blob/i })
console.log("CUSTOMISE", await customise.count())
if (await customise.count()) {
    await customise.click()
    await page.waitForTimeout(700)
    await shot("05-customise")
    const sections = await page.locator("p.text-xs.font-medium").allTextContents()
    console.log("CUSTOMISER_SECTIONS", sections)
}

console.log("SUMMARY", { s1, s2, s3, s4, url: page.url() })
await browser.disconnect()
