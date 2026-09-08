import { inventoryApi } from "@/lib/inventory/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return inventoryApi.listReservations(id, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return inventoryApi.reserve(id, request)
}
