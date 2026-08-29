import { inventoryApi } from "@/lib/inventory/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return inventoryApi.list(request)
}

export function POST(request: Request): Promise<Response> {
    return inventoryApi.create(request)
}
