import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
await page.keyboard.press("Escape")
await page.waitForTimeout(400)
const x = page.locator('[aria-label="Close"]').or(page.getByRole("button", { name: "Close" }))
if (await x.count()) await x.first().click({ force: true }).catch(() => {})
await page.waitForTimeout(400)

await page.getByRole("button", { name: /Models/i }).click().catch(() => {})
await page.getByText("Models", { exact: true }).click().catch(() => {})
await page.waitForTimeout(500)

// Right-side library: click the burger tile (often 5th in the first page of models)
const modelsHeader = page.getByText("Models", { exact: true }).last()
const box = await modelsHeader.boundingBox()
console.log("models header box", box)

// Click roughly into the models grid: header is top-right panel
if (box) {
    await page.mouse.click(box.x + 40, box.y + 90)
    await page.waitForTimeout(2000)
}
await page.screenshot({ path: path.join(out, "opened-model.png"), fullPage: false })
console.log("url", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 700))
const dls = await page.getByRole("button").allTextContents()
console.log("buttons", dls.filter((t) => t).slice(0, 40))
