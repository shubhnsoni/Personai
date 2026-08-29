import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ jobId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { jobId } = await params
    return fieldJobApi.timeline(jobId, request)
}
