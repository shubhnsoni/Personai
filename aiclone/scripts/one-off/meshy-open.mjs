import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const out = path.join(process.env.TEMP || ".", "pl-meshy")
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0] || (await browser.newContext())
const page = await context.newPage()
page.setDefaultTimeout(45000)
await page.goto("https://www.meshy.ai/workspace", { waitUntil: "domcontentloaded", timeout: 60000 })
await page.waitForTimeout(3500)
await page.screenshot({ path: path.join(out, "workspace.png"), fullPage: false })
const url = page.url()
const title = await page.title()
const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 1500)
console.log(JSON.stringify({ url, title, text: text.replace(/\s+/g, " ").slice(0, 800) }, null, 2))
console.log("shot", path.join(out, "workspace.png"))
// keep the tab open — do not close browser (shared Edge)
