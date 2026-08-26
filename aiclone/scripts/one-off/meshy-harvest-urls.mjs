import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const dest = "C:/Users/shubh/Desktop/Projects/personal projects/personai/aiclone/public/uploads/skydine-ar"
fs.mkdirSync(dest, { recursive: true })

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const page = browser.contexts()[0].pages().find((p) => /meshy\.ai/i.test(p.url()))
await page.bringToFront()

const urls = await page.evaluate(() => {
    const fromPerf = performance.getEntriesByType("resource").map((e) => e.name)
    const fromDom = [...document.querySelectorAll("a, img, source, video")].map((el) => el.href || el.src || "")
    const fromHtml = document.documentElement.innerHTML.match(/https:[^"'\\\s]+/g) || []
    return [...new Set([...fromPerf, ...fromDom, ...fromHtml])].filter((u) => /meshy\.ai|assets\.meshy/i.test(u))
})
const interesting = urls.filter((u) => /glb|task|model|thumbnail|asset/i.test(u))
console.log("interesting", interesting.length)
for (const u of interesting.slice(0, 80)) console.log(u.slice(0, 200))

const glbUrls = interesting.filter((u) => /\.glb/i.test(u))
console.log("glb urls", glbUrls.length)
let i = 0
for (const u of glbUrls) {
    try {
        const res = await page.request.get(u)
        const buf = Buffer.from(await res.body())
        if (buf.length < 5000) continue
        i += 1
        const file = path.join(dest, `meshy-${String(i).padStart(2, "0")}.glb`)
        fs.writeFileSync(file, buf)
        console.log("wrote", path.basename(file), buf.length)
    } catch (e) {
        console.log("fail", e.message)
    }
}
console.log("files", fs.readdirSync(dest))
