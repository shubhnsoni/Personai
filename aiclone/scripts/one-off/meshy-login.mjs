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
    console.log("shot", file, "url", page.url())
}

const browser = await chromium.connectOverCDP("http://127.0.0.1:9224")
const context = browser.contexts()[0]
let page = context.pages().find((p) => /meshy\.ai/i.test(p.url())) || context.pages().at(-1)
if (!page) page = await context.newPage()
page.setDefaultTimeout(25000)

if (!/meshy\.ai/i.test(page.url())) {
    await page.goto("https://www.meshy.ai/workspace", { waitUntil: "domcontentloaded", timeout: 60000 })
}
await page.waitForTimeout(1500)
await shot(page, "before-login.png")

const loggedIn = await page.locator("text=Sign Up Free").count() === 0 && await page.locator("text=Log In").count() === 0
console.log("loggedInGuess", loggedIn, "url", page.url())

if (!loggedIn) {
    const popupPromise = context.waitForEvent("page", { timeout: 20000 }).catch(() => null)
    const login = page.getByRole("link", { name: /log in/i }).or(page.getByRole("button", { name: /log in/i }))
    if (await login.count()) await login.first().click()
    else await page.goto("https://www.meshy.ai/auth/login", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(2000)
    await shot(page, "login-page.png")

    const google = page.getByRole("button", { name: /google/i }).or(page.getByRole("link", { name: /google/i })).or(page.locator("text=/Continue with Google|Sign in with Google/i"))
    let authPage = page
    if (await google.count()) {
        await google.first().click()
        const popup = await popupPromise
        if (popup) {
            authPage = popup
            await authPage.waitForLoadState("domcontentloaded").catch(() => {})
        }
        await page.waitForTimeout(2500)
        await shot(authPage, "google-picker.png")
    }

    // Which Google account to pick in the consent screen. Kept out of the file
    // because this repo is public: export MESHY_GOOGLE_EMAIL before running.
    const account = process.env.MESHY_GOOGLE_EMAIL
    if (!account) {
        console.error("set MESHY_GOOGLE_EMAIL to the Google account to sign in with")
        process.exit(1)
    }

    const emailBtn = authPage.getByText(account, { exact: false })
    if (await emailBtn.count()) {
        await emailBtn.first().click()
        await authPage.waitForTimeout(2500)
        await shot(authPage, "after-email.png")
    } else {
        const acc = authPage.locator(`[data-identifier='${account}'], [data-email='${account}']`)
        if (await acc.count()) await acc.first().click()
        const emails = await authPage.locator("div, span, li, button").filter({ hasText: /@gmail\.com/ }).allTextContents()
        console.log("gmail candidates", emails.slice(0, 12))
        await shot(authPage, "no-email-match.png")
    }

    const useBtn = authPage.getByRole("button", { name: /^(Continue|Next|Allow|Yes)$/i })
    if (await useBtn.count()) await useBtn.first().click().catch(() => {})
    await page.waitForTimeout(4000)
}

await page.bringToFront().catch(() => {})
await page.waitForTimeout(2000)
if (!/meshy\.ai/i.test(page.url())) {
    page = context.pages().find((p) => /meshy\.ai/i.test(p.url())) || page
}
await shot(page, "after-login.png")
console.log("final", page.url(), await page.title())
const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 900)
console.log("body", body)
