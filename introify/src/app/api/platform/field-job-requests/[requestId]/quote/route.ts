import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ requestId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { requestId } = await params
    return fieldJobApi.quoteRequest(requestId, request)
}
