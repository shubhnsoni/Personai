import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ variantId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { variantId } = await params
    return commerceApi.getVariant(variantId, request)
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { variantId } = await params
    return commerceApi.updateVariant(variantId, request)
}
