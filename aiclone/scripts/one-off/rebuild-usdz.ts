import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { glbToUsdz } from "../../src/lib/optimize-glb"
import { arSizeFor } from "../../src/lib/ar-scale"

const dir = path.resolve(process.cwd(), "public/uploads/skydine-ar")

async function main() {
    const files = (await readdir(dir)).filter((f) => f.endsWith("-ar.glb")).sort()
    for (const file of files) {
        const stem = file.replace(/-ar\.glb$/i, "")
        const ar = await readFile(path.join(dir, file))
        const usdz = await glbToUsdz(ar, arSizeFor(stem))
        await writeFile(path.join(dir, `${stem}.usdz`), usdz)
        await writeFile(path.join(dir, `${stem}.ar.usdz`), usdz)
        await writeFile(path.join(dir, `${stem}.ql.usdz`), usdz)
        console.log(`${stem.padEnd(22)} ${(usdz.length / 1024).toFixed(0)} KB`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
