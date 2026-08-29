import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return commerceApi.getReturn(id, request)
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return commerceApi.transitionReturn(id, request)
}
