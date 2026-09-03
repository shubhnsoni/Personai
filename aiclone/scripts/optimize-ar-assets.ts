import { readdir, readFile, stat, writeFile } from "fs/promises"
import path from "path"
import { optimizeGlb, glbToUsdz } from "../src/lib/optimize-glb"
import { arSizeFor } from "../src/lib/ar-scale"

const dir = path.resolve(process.cwd(), "public/uploads/skydine-ar")

async function main() {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".glb") && !f.endsWith("-ar.glb")).sort()
    let before = 0
    let after = 0
    for (const file of files) {
        const stem = file.replace(/\.glb$/i, "")
        const webSrc = path.join(dir, file)
        const arSrc = path.join(dir, `${stem}-ar.glb`)
        const usdzSrc = path.join(dir, `${stem}.usdz`)
        const webBefore = (await stat(webSrc)).size
        const arBefore = await stat(arSrc).then((s) => s.size).catch(() => 0)
        const usdzBefore = await stat(usdzSrc).then((s) => s.size).catch(() => 0)
        before += webBefore + arBefore + usdzBefore

        const source = await readFile(arBefore ? arSrc : webSrc)
        const webOrig = await readFile(webSrc)
        const arOrig = arBefore ? await readFile(arSrc) : source
        const web = await optimizeGlb(source, "web")
        const ar = await optimizeGlb(source, "ar")
        await writeFile(webSrc, web.length < webOrig.length ? web : webOrig)
        await writeFile(arSrc, ar.length < arOrig.length ? ar : arOrig)
        let usdzAfter = usdzBefore
        try {
            const usdz = await glbToUsdz(ar, arSizeFor(stem))
            await writeFile(usdzSrc, usdz)
            usdzAfter = usdz.length
        } catch (err) {
            console.warn("usdz skip", stem, err instanceof Error ? err.message : err)
        }
        after += web.length + ar.length + usdzAfter
        console.log(
            `${stem.padEnd(22)} web ${(webBefore / 1024).toFixed(0)}→${(web.length / 1024).toFixed(0)} KB   ar ${(arBefore / 1024).toFixed(0)}→${(ar.length / 1024).toFixed(0)} KB   usdz ${(usdzBefore / 1024).toFixed(0)}→${(usdzAfter / 1024).toFixed(0)} KB`,
        )
    }
    console.log(`\ntotal ${(before / 1024 / 1024).toFixed(2)} MB → ${(after / 1024 / 1024).toFixed(2)} MB`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
