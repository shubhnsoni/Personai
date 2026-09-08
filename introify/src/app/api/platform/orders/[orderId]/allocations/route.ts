import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ orderId: string }> }

/** How much of each order line is still shippable, and how much has actually shipped. */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { orderId } = await params
    return commerceApi.allocations(orderId, request)
}
