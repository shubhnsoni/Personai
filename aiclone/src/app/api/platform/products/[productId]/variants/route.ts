import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ productId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { productId } = await params
    return commerceApi.listVariants(productId, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { productId } = await params
    return commerceApi.createVariant(productId, request)
}
