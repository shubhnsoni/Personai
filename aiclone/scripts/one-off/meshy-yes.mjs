import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")
const out = path.join(process.env.TEMP || ".", "pl-meshy")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
await page.bringToFront()
await page.screenshot({ path: path.join(out, "agent-now.png"), fullPage: false })
console.log("url", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1600))

const radios = page.locator('[role="radio"], input[type="radio"]')
console.log("radios", await radios.count())
if (await radios.count()) {
    await radios.first().click({ force: true })
    console.log("clicked first radio")
}

const next = page.getByRole("button", { name: /Next/i })
console.log("next", await next.count())
if (await next.count()) await next.first().click({ force: true }).catch((e) => console.log("next fail", e.message))

const box = page.getByRole("radio", { name: /Yes, proceed/i })
if (await box.count()) await box.first().click({ force: true })

const composer = page.locator("textarea, [contenteditable='true']").last()
if (await composer.count()) {
    await composer.click({ force: true })
    await composer.fill("Yes, proceed with all 10. Generate the remaining 9 concept images in this exact style, then convert all 10 to 3D GLB models now.")
    await page.keyboard.press("Enter")
    console.log("typed yes")
}
await page.waitForTimeout(4000)
await page.screenshot({ path: path.join(out, "agent-yes.png"), fullPage: false })
console.log("after", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1200))
