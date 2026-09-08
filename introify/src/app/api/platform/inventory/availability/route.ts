import { inventoryApi } from "@/lib/inventory/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Availability for one product across every location that stocks it. A static segment
 * beside `[id]`, so Next resolves it first; the id route only ever sees a stock record id.
 */
export function GET(request: Request): Promise<Response> {
    return inventoryApi.availability(request)
}
