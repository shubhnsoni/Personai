import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const out = path.join(process.env.TEMP || ".", "pl-meshy")
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
const page = context.pages().find((p) => /meshy\.ai\/agent/i.test(p.url())) || context.pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()
await page.waitForTimeout(25000)
const file = path.join(out, "agent-progress.png")
await page.screenshot({ path: file, fullPage: false })
const text = (await page.locator("body").innerText()).replace(/\s+/g, " ")
console.log("url", page.url())
console.log("shot", file)
console.log(text.slice(0, 2000))
const thinking = /thinking/i.test(text)
console.log("thinking", thinking)
