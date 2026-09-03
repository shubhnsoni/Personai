import fs from "node:fs"

function inspect(p) {
    const b = fs.readFileSync(p)
    const jsonLen = b.readUInt32LE(12)
    const json = b.subarray(20, 20 + jsonLen).toString("utf8").replace(/\0+$/, "")
    const j = JSON.parse(json)
    const name = p.split(/[/\\]/).pop()
    console.log(JSON.stringify({
        name,
        bytes: b.length,
        magic: b.subarray(0, 4).toString(),
        extUsed: j.extensionsUsed || [],
        extReq: j.extensionsRequired || [],
        images: (j.images || []).map((i) => i.mimeType || i.uri || "?"),
        meshes: (j.meshes || []).length,
        extras: j.asset?.extras || null,
        generator: j.asset?.generator || null,
    }))
}

const dir = "public/uploads/skydine-ar"
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".glb")).sort()) {
    inspect(`${dir}/${f}`)
}
