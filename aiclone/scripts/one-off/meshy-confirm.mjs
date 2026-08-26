import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const out = path.join(process.env.TEMP || ".", "pl-meshy")
const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
await page.bringToFront()

const yes = page.getByText("Yes, proceed with all 10", { exact: false }).first()
await yes.click()
await page.waitForTimeout(500)
const next = page.getByRole("button", { name: /^Next/i }).first()
if (await next.count()) await next.click()
await page.waitForTimeout(4000)
await page.screenshot({ path: path.join(out, "agent-q2.png"), fullPage: false })
console.log("after yes", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1800))

const yes2 = page.getByText(/Yes, proceed|Generate the remaining|convert all 10/i).first()
if (await yes2.count() && await yes2.isVisible().catch(() => false)) {
    await yes2.click().catch(() => {})
}
const next2 = page.getByRole("button", { name: /^Next/i }).first()
if (await next2.count() && await next2.isEnabled().catch(() => false)) await next2.click().catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: path.join(out, "agent-confirmed.png"), fullPage: false })
console.log("confirmed", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1500))
