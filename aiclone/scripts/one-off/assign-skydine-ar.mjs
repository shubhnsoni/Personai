// Points SkyDine's AR dishes at the compressed Meshy models.
//
// Three artefacts per dish, because each AR runtime accepts a different one:
//   <name>.glb      meshopt-compressed  -> the in-page three.js viewer
//   <name>-ar.glb   plain glTF, real scale -> Android Scene Viewer (ARCore)
//   <name>.usdz     real scale          -> iOS AR Quick Look (ARKit)
//
// Only the first two live in the DB (arModelUrl / arUsdzUrl); the Scene Viewer
// twin is derived from arModelUrl by the /[slug]/ar page, which also checks it
// exists on disk before offering that path.
//
// Generate them with:
//   scripts/one-off/optimize-ar-glbs.ps1   (raw Meshy export -> <name>.glb)
//   /dev-ar-export page driven by Playwright (-> -ar.glb and .usdz)

import { PrismaClient } from "@prisma/client"
import { existsSync, statSync } from "node:fs"
import path from "node:path"

const p = new PrismaClient()
const PUBLIC = path.join(process.cwd(), "public")

const MAP = [
    ["Chicken Burger", "chicken-burger"],
    ["Margherita Pizza", "margherita-pizza"],
    ["Cappuccino", "cappuccino"],
    ["Nutella Shake", "nutella-shake"],
    ["Caesar Salad Veg", "caesar-salad"],
    ["Avocado Toast", "avocado-toast"],
    ["Chocolate Brownie", "chocolate-brownie"],
    ["Veg Steam Momo", "veg-momos"],
    ["Garlic Bread", "garlic-bread"],
    // no pancake dish on the menu; the stack reads as a breakfast plate
    ["Avocado Toast Combo", "pancake-stack"],
]

const profile = await p.profile.findFirst({ where: { slug: "skydine-cafe" } })
if (!profile) throw new Error("SkyDine profile missing")

function asset(url) {
    const file = path.join(PUBLIC, url.replace(/^\//, ""))
    if (!existsSync(file)) return null
    return { url, mb: statSync(file).size / 1024 / 1024 }
}

let ok = 0
for (const [title, base] of MAP) {
    const glb = asset(`/uploads/skydine-ar/${base}.glb`)
    const sceneViewer = asset(`/uploads/skydine-ar/${base}-ar.glb`)
    const usdz = asset(`/uploads/skydine-ar/${base}.usdz`)

    if (!glb) {
        console.log(`SKIP  ${title.padEnd(22)} missing ${base}.glb`)
        continue
    }
    if (glb.mb > 12) {
        console.log(`SKIP  ${title.padEnd(22)} ${base}.glb is ${glb.mb.toFixed(1)} MB — compress it first`)
        continue
    }

    const r = await p.digitalProduct.updateMany({
        where: { profileId: profile.id, title },
        data: { arModelUrl: glb.url, arUsdzUrl: usdz?.url ?? null },
    })
    if (r.count === 0) {
        console.log(`MISS  ${title.padEnd(22)} no such dish on the menu`)
        continue
    }
    ok += r.count
    console.log(
        `ok    ${title.padEnd(22)} viewer ${glb.mb.toFixed(2)}MB` +
            `  scene-viewer ${sceneViewer ? `${sceneViewer.mb.toFixed(2)}MB` : "MISSING"}` +
            `  quick-look ${usdz ? `${usdz.mb.toFixed(2)}MB` : "MISSING"}`,
    )
}

const stale = await p.digitalProduct.count({
    where: { profileId: profile.id, arModelUrl: { contains: "/uploads/blu-cafe/" } },
})

console.log(`\n${ok} dishes now have AR models`)
if (stale) console.log(`${stale} dish(es) still point at blu-cafe placeholders`)
await p.$disconnect()
