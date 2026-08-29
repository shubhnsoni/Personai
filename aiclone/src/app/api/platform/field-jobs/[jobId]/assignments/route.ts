import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ jobId: string }> }

/**
 * Assignment only. No technician is notified by this route or any other - the job card is created
 * and the event records notified: false.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { jobId } = await params
    return fieldJobApi.listAssignments(jobId, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { jobId } = await params
    return fieldJobApi.assign(jobId, request)
}
