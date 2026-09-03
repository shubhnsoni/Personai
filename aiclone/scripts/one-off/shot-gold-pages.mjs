import { createRequire } from "module"
import fs from "fs"
import path from "path"
import { spawn } from "child_process"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const userData = path.join(process.env.TEMP || ".", "edge-pl-gold-verify")
const out = path.join("C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/scripts/one-off/shots")
fs.mkdirSync(out, { recursive: true })
fs.mkdirSync(userData, { recursive: true })

const port = 9333
const child = spawn(edge, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--window-size=390,844",
    "about:blank",
], { detached: true, stdio: "ignore" })
child.unref()

async function waitCdp(ms = 20000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`)
            if (res.ok) return await res.json()
        } catch {}
        await new Promise((r) => setTimeout(r, 400))
    }
    throw new Error("CDP not up")
}

const version = await waitCdp()
console.log("cdp", version.Browser)
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
const context = browser.contexts()[0] || (await browser.newContext())
const page = context.pages()[0] || (await context.newPage())
page.setDefaultTimeout(45000)
await page.setViewportSize({ width: 390, height: 844 })

const pages = [
    ["wholesale-home", "http://127.0.0.1:3000/try-gold-wholesale"],
    ["wholesale-shop", "http://127.0.0.1:3000/try-gold-wholesale/shop"],
    ["wholesale-pdp", "http://127.0.0.1:3000/try-gold-wholesale/shop"],
    ["retail-shop", "http://127.0.0.1:3000/try-jewelry-retail/shop"],
    ["lift", "http://127.0.0.1:3000/try-gold-wholesale/lift/zJ4C7QYkLw9Y"],
    ["dashboard-products", "http://127.0.0.1:3000/dashboard/products"],
]

const report = []
for (const [name, url] of pages) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })
    await page.waitForTimeout(2500)
    if (name === "wholesale-pdp") {
        const href = await page.locator("a[href*='/shop/']").first().getAttribute("href").catch(() => null)
        if (href) {
            await page.goto(new URL(href, "http://127.0.0.1:3000").toString(), { waitUntil: "domcontentloaded" })
            await page.waitForTimeout(2000)
        }
    }
    const file = path.join(out, `${name}.png`)
    await page.screenshot({ path: file, fullPage: true })
    const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 700)
    report.push({ name, url: page.url(), title: await page.title(), text })
    console.log("saved", file)
}

fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
process.exit(0)
