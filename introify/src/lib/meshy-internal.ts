/**
 * Internal 3D provider. Do not import from client components.
 * Public copy must never mention this vendor.
 */

const BASE = "https://api.meshy.ai/openapi/v1"
export const STANDARD_3D_RECIPE = "standard-meshy6-2k-v1"

/** A rejected POST is different from a timeout after the supplier may have accepted it. */
export class TaskRejectedError extends Error {}

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
    const rejection = (code: string) => init?.method === "POST" ? new TaskRejectedError(code) : new Error(code)
    if (res.status === 401 || res.status === 403) throw rejection("studio_offline")
    if (res.status === 402) throw rejection("studio_full")
    if (res.status === 429) throw rejection("studio_busy")
    if (!res.ok) {
        const text = await res.text().catch(() => "")
        if (res.status === 400 || res.status === 422) throw rejection("bad_photo")
        throw new Error(text.slice(0, 80) || `studio_${res.status}`)
    }
    return res.json()
}

export async function createImageTo3dTask(imageUrl: string, recipe = STANDARD_3D_RECIPE) {
    if (recipe !== STANDARD_3D_RECIPE) throw new TaskRejectedError("studio_recipe_unavailable")
    const json = await meshy("/image-to-3d", {
        method: "POST",
        body: JSON.stringify({
            image_url: imageUrl,
            should_texture: true,
            // Pin the standard recipe rather than changing cost/quality with "latest".
            // https://docs.meshy.ai/en/api/image-to-3d
            ai_model: "meshy-6",
            model_type: "standard",
            texture_resolution: "2k",
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
    const destination = new URL(url)
    if (destination.protocol !== "https:" || destination.username || destination.password || !["meshy.ai", "amazonaws.com", "cloudfront.net"].some(host => destination.hostname === host || destination.hostname.endsWith(`.${host}`))) throw new Error("studio_asset_unavailable")
    const res = await fetch(destination, { signal: AbortSignal.timeout(120000), redirect: "error" })
    if (!res.ok) throw new Error("studio_failed")
    const maximum = 100 * 1024 * 1024
    if (Number(res.headers.get("content-length") || 0) > maximum || !res.body) throw new Error("studio_asset_too_large")
    const reader = res.body.getReader()
    const chunks: Buffer[] = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        if (total > maximum) { await reader.cancel(); throw new Error("studio_asset_too_large") }
        chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, total)
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
