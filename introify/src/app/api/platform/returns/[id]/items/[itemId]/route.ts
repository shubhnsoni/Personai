import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; itemId: string }> }

/** Decides what happened to one returned line: back on the shelf, or written off. */
export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id, itemId } = await params
    return commerceApi.settleReturnItem(id, itemId, request)
}
