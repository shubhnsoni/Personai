const wsUrl = process.argv[2]
const expr = process.argv[3]
const shot = process.argv[4]
const go = process.argv[5]
const ws = new WebSocket(wsUrl)
let id = 0
const pending = new Map()
function send(method, params = {}) {
    const next = ++id
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 20000)
        pending.set(next, { resolve, reject, t })
        ws.send(JSON.stringify({ id: next, method, params }))
    })
}
ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, t } = pending.get(msg.id)
        clearTimeout(t)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
    }
})
ws.addEventListener("open", async () => {
    try {
        await send("Runtime.enable")
        await send("Page.enable")
        if (go) {
            await send("Page.navigate", { url: go })
            await new Promise((r) => setTimeout(r, 3500))
        }
        if (expr) {
            const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
            console.log(JSON.stringify(r.result?.value ?? r, null, 2))
        }
        if (shot) {
            const pic = await send("Page.captureScreenshot", { format: "png" })
            const fs = await import("node:fs")
            fs.writeFileSync(shot, Buffer.from(pic.data, "base64"))
            console.log("saved", shot)
        }
        ws.close()
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
})
