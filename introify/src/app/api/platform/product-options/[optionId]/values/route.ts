import { commerceApi } from "@/lib/commerce/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ optionId: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { optionId } = await params
    return commerceApi.addOptionValue(optionId, request)
}
