import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
await page.keyboard.press("Escape").catch(() => {})

const ws = page.getByRole("button", { name: /Workspace/i }).or(page.getByRole("link", { name: /Workspace/i }))
if (await ws.count()) {
    await ws.first().click()
    await page.waitForTimeout(2500)
} else {
    await page.goto("https://www.meshy.ai/workspace", { waitUntil: "domcontentloaded", timeout: 60000 })
    await page.waitForTimeout(3000)
}
await page.screenshot({ path: path.join(out, "viewer-page.png"), fullPage: false })
console.log("url", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800))
const links = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.href).filter((h) => /view|workspace|model/i.test(h)).slice(0, 20))
console.log("links", links)
