import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
if (!page) throw new Error("Meshy agent tab not found")
await page.bringToFront()
await page.waitForTimeout(800)

const composer = page.locator("textarea, [contenteditable='true']").last()
await composer.click()
await composer.fill("Please pack all 10 finished 3D models into one ZIP file of GLB downloads and give me that zip now. I need chicken burger, margherita pizza, cappuccino, nutella shake, caesar salad, avocado toast, chocolate brownie, pancake stack, vegetable momos, and garlic bread.")
await page.keyboard.press("Enter")
await page.waitForTimeout(6000)
await page.screenshot({ path: path.join(out, "ask-zip.png"), fullPage: false })
console.log("url", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(-1800))
