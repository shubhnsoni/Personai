/**
 * Internal 3D provider. Do not import from client components.
 * Public copy must never mention this vendor.
 */

const BASE = "https://api.meshy.ai/openapi/v1"

function key() {
    const k = process.env.MESHY_API_KEY?.trim()
    if (!k) throw new Error("studio_offline")
    return k
}

export function meshyConfigured() {
    return Boolean(process.env.MESHY_API_KEY?.trim())
}

export type MeshyTask = {
    id: string
    status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED" | string
    progress?: number
    consumed_credits?: number
    model_urls?: { glb?: string; usdz?: string }
    task_error?: { message?: string }
}

async function meshy(path: string, init?: RequestInit) {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${key()}`,
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
        signal: init?.signal ?? AbortSignal.timeout(30000),
    })
    if (res.status === 401 || res.status === 403) throw new Error("studio_offline")
    if (res.status === 402) throw new Error("studio_full")
    if (res.status === 429) throw new Error("studio_busy")
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        if (res.status === 400) throw new Error("bad_photo")
        throw new Error(text.slice(0, 80) || `studio_${res.status}`)
    }
    return res.json()
}

export async function createImageTo3dTask(imageUrl: string) {
    const json = await meshy("/image-to-3d", {
        method: "POST",
        body: JSON.stringify({
            image_url: imageUrl,
            should_texture: true,
            ai_model: "latest",
            auto_size: true,
            image_enhancement: true,
            target_formats: ["glb", "usdz"],
        }),
    }) as { result?: string }
    if (!json.result) throw new Error("studio_failed")
    return json.result
}

export async function getImageTo3dTask(id: string) {
    return meshy(`/image-to-3d/${encodeURIComponent(id)}`) as Promise<MeshyTask>
}

export async function downloadAsset(url: string) {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) })
    if (!res.ok) throw new Error("studio_failed")
    return Buffer.from(await res.arrayBuffer())
}

export function publicError(code: string) {
    switch (code) {
        case "studio_offline":
            return "3D studio isn’t connected yet."
        case "studio_full":
            return "The 3D studio is at capacity. Try again in a bit."
        case "studio_busy":
            return "The 3D studio is busy. Wait a moment and retry."
        case "bad_photo":
            return "That photo didn’t work. Use a clear shot of one item on a plain background."
        case "need_photo":
            return "Add a photo first."
        default:
            return "Couldn’t build 3D for this item."
    }
}
