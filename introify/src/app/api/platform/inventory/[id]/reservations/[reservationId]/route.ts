import { inventoryApi } from "@/lib/inventory/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; reservationId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, reservationId } = await params
    return inventoryApi.settleReservation(id, reservationId, request)
}
