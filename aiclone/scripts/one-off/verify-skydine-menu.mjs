import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const out = path.join(process.env.TEMP || ".", "pl-skydine")
fs.mkdirSync(out, { recursive: true })
const base = "http://127.0.0.1:3000"

const menuHtml = await (await fetch(`${base}/skydine-cafe/menu`, { cache: "no-store" })).text()
const chatHtml = await (await fetch(`${base}/skydine-cafe`, { cache: "no-store" })).text()
const menuOk = /Search in SkyDine Cafe/.test(menuHtml)
const chips = ["Veg", "Non-Veg", "Bestsellers", "Ratings 4.0+"].filter((c) => menuHtml.includes(c))
const logo = /blu-cafe\/logo|shopLogoUrl|SkyDine/.test(menuHtml)
const menuChipCount = (chatHtml.match(/>Menu</g) || []).length
console.log(JSON.stringify({ menuOk, chips, logo, menuLen: menuHtml.length, chatMenuChips: menuChipCount, compileError: /PersonaLink hit a snag|Application error/.test(menuHtml) }, null, 2))

const browser = await chromium.launch({ channel: "msedge", headless: true })
async function shot(name, url, { width, height, dark, clickMenu, waitText } = {}) {
    const page = await browser.newPage({
        viewport: { width: width || 390, height: height || 844 },
        extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
    })
    if (dark) {
        await page.addInitScript(() => {
            localStorage.setItem("pl-theme", "dark")
            document.documentElement.classList.add("dark")
        })
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })
    await page.locator("text=Compiling").waitFor({ state: "hidden", timeout: 45000 }).catch(() => {})
    if (waitText) await page.getByText(waitText).first().waitFor({ timeout: 20000 })
    else await page.waitForTimeout(2500)
    const logs = []
    page.on("pageerror", (e) => logs.push(String(e)))
    page.on("console", (m) => { if (m.type() === "error") logs.push(m.text()) })
    if (clickMenu) {
        await page.getByRole("button", { name: /^MENU$/i }).click({ timeout: 10000 })
        await page.getByText("Todays Offers").first().waitFor({ timeout: 8000 })
        await page.getByText("Starters & Snacks").first().waitFor({ timeout: 8000 }).catch(() => {})
    }
    if (logs.length) console.log("errors", name, logs.slice(0, 8))
    const file = path.join(out, name)
    await page.screenshot({ path: file, fullPage: false })
    await page.close()
    console.log("shot", file)
}

await shot("menu-mobile.png", `${base}/skydine-cafe/menu`, { waitText: "Order Again" })
await shot("menu-dark.png", `${base}/skydine-cafe/menu`, { dark: true, waitText: "Order Again" })
await shot("menu-panel.png", `${base}/skydine-cafe/menu`, { waitText: "Order Again", clickMenu: true })
await browser.close()
console.log("done", out)
