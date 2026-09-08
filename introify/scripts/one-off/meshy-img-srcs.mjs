import { createRequire } from "module"
const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai\/agent/i.test(p.url()))
await page.bringToFront()
const data = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")].map((el) => ({
        src: (el.currentSrc || el.src || "").slice(0, 220),
        alt: el.alt || "",
        w: el.naturalWidth,
        h: el.naturalHeight,
    })).filter((x) => x.src && !/webapp-build-assets|sidebar-|woff/.test(x.src))
    const ids = [...new Set((document.documentElement.innerHTML.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []))]
    return { imgs: imgs.slice(0, 40), ids: ids.slice(0, 30) }
})
console.log(JSON.stringify(data, null, 2))
