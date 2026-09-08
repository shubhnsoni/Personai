import { createRequire } from "module"
import fs from "fs"
import path from "path"

const require = createRequire(import.meta.url)
const { chromium } = require("C:/Users/shubh/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core")

const out = path.join(process.env.TEMP || ".", "pl-meshy")
fs.mkdirSync(out, { recursive: true })
const shot = async (page, name) => {
    const file = path.join(out, name)
    await page.screenshot({ path: file, fullPage: false })
    console.log("shot", file, page.url())
}

const PROMPT = `Generate all 10 of these as finished photorealistic 3D food models in one batch, ready to download as GLB for a restaurant AR menu. Isolated objects, no studio clutter, real cafe food, PBR textures.

1. Chicken burger with bun, lettuce, tomato, grilled patty
2. Margherita pizza on a plate
3. Cappuccino in a ceramic cup with foam
4. Nutella milkshake in a tall glass
5. Caesar salad in a bowl
6. Avocado toast on rustic bread
7. Chocolate brownie square
8. Pancake stack with syrup
9. Vegetable steamed momos (dumplings) in a bamboo basket
10. Garlic bread slices

Do not stop at concept images. Convert every item into a 3D model I can download as GLB. Keep a consistent realistic food style across the set.`

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
let page = context.pages().find((p) => /meshy\.ai/i.test(p.url())) || context.pages().at(-1)
page.setDefaultTimeout(20000)
await page.bringToFront()

const agentNav = page.locator("nav, aside, header").getByText("Agent", { exact: true }).first()
const topAgent = page.getByRole("button", { name: /^Agent$/i }).or(page.getByRole("link", { name: /^Agent$/i }))
if (await page.locator("aside").getByText("Agent").count()) {
    await page.locator("aside").getByText("Agent").first().click()
} else if (await topAgent.count()) {
    await topAgent.first().click()
} else if (await agentNav.count()) {
    await agentNav.click()
} else {
    await page.goto("https://www.meshy.ai/agent", { waitUntil: "domcontentloaded" }).catch(() => {})
}
await page.waitForTimeout(2500)
await shot(page, "agent-home.png")
console.log("agent url", page.url())

const composer = page.locator("textarea, [contenteditable='true'], [role='textbox']").last()
if (await composer.count()) {
    await composer.click()
    await composer.fill(PROMPT)
    await shot(page, "agent-prompt.png")
    const send = page.getByRole("button", { name: /send|submit|generate/i }).last()
    if (await send.count()) await send.click()
    else await composer.press("Enter")
} else {
    console.log("no composer, body:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 800))
}

await page.waitForTimeout(8000)
await shot(page, "agent-sent.png")
console.log("after send", page.url())
console.log((await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 1200))
