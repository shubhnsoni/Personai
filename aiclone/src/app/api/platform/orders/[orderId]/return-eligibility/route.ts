import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ orderId: string }> }

/** What each line could still be returned, derived from what actually shipped. */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { orderId } = await params
    return commerceApi.eligibility(orderId, request)
}
