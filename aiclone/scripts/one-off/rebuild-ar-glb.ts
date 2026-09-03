import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { optimizeGlb } from "../../src/lib/optimize-glb"
import { arSizeFor } from "../../src/lib/ar-scale"

const dir = path.resolve(process.cwd(), "public/uploads/skydine-ar")

async function main() {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".glb") && !f.endsWith("-ar.glb") && !f.endsWith("-sv.glb")).sort()
    for (const file of files) {
        const stem = file.replace(/\.glb$/i, "")
        const source = await readFile(path.join(dir, file))
        const ar = await optimizeGlb(source, "ar", arSizeFor(stem))
        await writeFile(path.join(dir, `${stem}-ar.glb`), ar)
        await writeFile(path.join(dir, `${stem}-sv.glb`), ar)
        console.log(`${stem.padEnd(22)} ${(ar.length / 1024).toFixed(0)} KB`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
