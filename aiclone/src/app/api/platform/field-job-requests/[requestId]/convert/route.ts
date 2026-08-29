import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ requestId: string }> }

/** Conversion is the only way a request becomes CONVERTED; there is no status route for it. */
export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { requestId } = await params
    return fieldJobApi.convertRequest(requestId, request)
}
