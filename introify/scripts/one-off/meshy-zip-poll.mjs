import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
await page.bringToFront()
await page.waitForTimeout(25000)
await page.screenshot({ path: path.join(out, "zip-reply.png"), fullPage: false })
const text = (await page.locator("body").innerText()).replace(/\s+/g, " ")
console.log(text.slice(-2000))
console.log("zip?", /zip|cannot|can't pack|don't support|download each/i.test(text.slice(-800)))
