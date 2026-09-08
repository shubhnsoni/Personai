// Validates .usdz files against what AR Quick Look actually requires.
//
// A USDZ is a zip with hard constraints, and Safari fails silently — "Object
// could not be opened" or nothing at all — when they are not met:
//
//   1. every entry STORED, never deflated
//   2. each file's data offset aligned to 64 bytes
//   3. the first entry is the .usdc/.usda layer
//   4. no encryption, no zip64
//
// Usage: node scripts/one-off/check-usdz.mjs [dir]

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const dir = process.argv[2] || "public/uploads/skydine-ar"
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".usdz")).sort()

if (files.length === 0) {
    console.log(`no .usdz files in ${dir}`)
    process.exit(0)
}

let bad = 0

for (const name of files) {
    const buf = readFileSync(path.join(dir, name))
    const problems = []
    const entries = []

    let off = 0
    while (off + 4 <= buf.length) {
        const sig = buf.readUInt32LE(off)
        if (sig !== 0x04034b50) break // end of local headers

        const flags = buf.readUInt16LE(off + 6)
        const method = buf.readUInt16LE(off + 8)
        const compSize = buf.readUInt32LE(off + 18)
        const nameLen = buf.readUInt16LE(off + 26)
        const extraLen = buf.readUInt16LE(off + 28)
        const entryName = buf.subarray(off + 30, off + 30 + nameLen).toString("latin1")
        const dataOffset = off + 30 + nameLen + extraLen

        if (method !== 0) problems.push(`${entryName}: compressed (method ${method}), must be stored`)
        if (flags & 0x1) problems.push(`${entryName}: encrypted`)
        if (dataOffset % 64 !== 0) problems.push(`${entryName}: data at ${dataOffset}, not 64-byte aligned`)

        entries.push({ name: entryName, dataOffset, size: compSize })
        off = dataOffset + compSize
    }

    if (entries.length === 0) problems.push("no zip entries found — not a usdz")
    else if (!/\.usd[ac]?$/i.test(entries[0].name)) {
        problems.push(`first entry is ${entries[0].name}, expected the .usda/.usdc layer`)
    }

    const status = problems.length === 0 ? "OK  " : "FAIL"
    if (problems.length) bad++
    console.log(
        `${status} ${name.padEnd(24)} ${(buf.length / 1024 / 1024).toFixed(2)} MB  ` +
            `${entries.length} entries  first=${entries[0]?.name ?? "-"}`,
    )
    for (const p of problems) console.log(`       ! ${p}`)
}

console.log(`\n${files.length - bad}/${files.length} valid for AR Quick Look`)
process.exit(bad ? 1 : 0)
