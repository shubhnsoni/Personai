import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

const src = process.argv[2] || "public/uploads/skydine-ar/chicken-burger.ar.usdz"
const buf = readFileSync(src)
const outDir = path.resolve("tmp-usdz-dump")
mkdirSync(outDir, { recursive: true })

let off = 0
while (off + 4 <= buf.length) {
    const sig = buf.readUInt32LE(off)
    if (sig !== 0x04034b50) break
    const method = buf.readUInt16LE(off + 8)
    const compSize = buf.readUInt32LE(off + 18)
    const nameLen = buf.readUInt16LE(off + 26)
    const extraLen = buf.readUInt16LE(off + 28)
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString("latin1")
    const dataOff = off + 30 + nameLen + extraLen
    const data = buf.subarray(dataOff, dataOff + compSize)
    const dest = path.join(outDir, name.replaceAll("/", "_"))
    writeFileSync(dest, data)
    const head = data.subarray(0, 8)
    console.log({ name, method, size: data.length, magic: [...head], dest })
    off = dataOff + compSize
}
