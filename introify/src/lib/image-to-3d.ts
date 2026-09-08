function dataUrlToBuffer(dataUrl: string) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) throw new Error("Need a photo")
    return { mime: m[1], buf: Buffer.from(m[2], "base64"), ext: m[1].includes("png") ? "png" : "jpg" }
}

async function gradioUpload(base: string, buf: Buffer, name: string, mime: string) {
    const form = new FormData()
    form.append("files", new Blob([new Uint8Array(buf)], { type: mime }), name)
    const res = await fetch(`${base}/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`Upload ${res.status}`)
    const json = await res.json() as string[] | { path?: string }
    if (Array.isArray(json) && json[0]) return json[0]
    if (!Array.isArray(json) && json && typeof json === "object" && json.path) return json.path
    throw new Error("Upload failed")
}

async function gradioCall(base: string, endpoint: string, data: unknown[]) {
    const start = await fetch(`${base}/call/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(20000),
    })
    if (!start.ok) throw new Error(`Space busy (${start.status})`)
    const { event_id } = await start.json() as { event_id?: string }
    if (!event_id) throw new Error("No job id")
    const stream = await fetch(`${base}/call/${endpoint}/${event_id}`, { signal: AbortSignal.timeout(120000) })
    if (!stream.ok) throw new Error(`Job failed (${stream.status})`)
    const text = await stream.text()
    const lines = text.split("\n")
    let payload: unknown = null
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("event: complete") || lines[i].startsWith("event: generating")) {
            const next = lines[i + 1] || ""
            if (next.startsWith("data: ")) {
                try { payload = JSON.parse(next.slice(6)) } catch { /* keep looking */ }
            }
        }
        if (lines[i].startsWith("data: ") && lines[i].includes("path")) {
            try { payload = JSON.parse(lines[i].slice(6)) } catch { /* ignore */ }
        }
    }
    if (!payload) throw new Error("No 3D came back")
    return payload
}

function findFile(payload: unknown): { url?: string; path?: string } | null {
    const walk = (node: unknown): { url?: string; path?: string } | null => {
        if (!node) return null
        if (Array.isArray(node)) {
            for (const n of node) {
                const hit = walk(n)
                if (hit) return hit
            }
            return null
        }
        if (typeof node === "object") {
            const o = node as { url?: string; path?: string; orig_name?: string }
            const name = `${o.path || ""} ${o.url || ""} ${o.orig_name || ""}`.toLowerCase()
            if ((o.url || o.path) && /\.(glb|gltf|obj)(\?|$)/.test(name)) return o
            for (const v of Object.values(o)) {
                const hit = walk(v)
                if (hit) return hit
            }
        }
        return null
    }
    return walk(payload)
}

async function fetchModel(file: { url?: string; path?: string }, base: string) {
    const url = file.url
        ? (file.url.startsWith("http") ? file.url : `${base}/file=${file.url}`)
        : `${base}/file=${file.path}`
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error("Could not download 3D")
    return Buffer.from(await res.arrayBuffer())
}

export async function imageTo3dGlb(dataUrl: string): Promise<Buffer> {
    const { mime, buf, ext } = dataUrlToBuffer(dataUrl)
    const name = `dish.${ext}`
    const spaces = [
        { host: "https://stabilityai-stable-fast-3d.hf.space", endpoint: "run_button", extra: [0.9, "None", -1, 1024] },
        { host: "https://stabilityai-triposr.hf.space", endpoint: "generate", extra: [256] as unknown[] },
    ]

    let last = "3D service unavailable"
    for (const space of spaces) {
        try {
            const path = await gradioUpload(space.host, buf, name, mime)
            const fileData = {
                path,
                meta: { _type: "gradio.FileData" },
                orig_name: name,
                mime_type: mime,
            }
            let payload: unknown
            if (space.endpoint === "generate") {
                const pre = await gradioCall(space.host, "preprocess", [fileData, true, 0.85])
                const processed = Array.isArray(pre) ? pre[0] : pre
                payload = await gradioCall(space.host, "generate", [processed, 256])
            } else {
                payload = await gradioCall(space.host, space.endpoint, [fileData, ...space.extra])
            }
            const file = findFile(payload)
            if (!file) continue
            const model = await fetchModel(file, space.host)
            if (model.length > 200) return model
        } catch (e) {
            last = e instanceof Error ? e.message : "3D service failed"
        }
    }
    throw new Error(last)
}
