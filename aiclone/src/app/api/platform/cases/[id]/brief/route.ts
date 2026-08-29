import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return caseApi.getBrief(id, request)
}

export async function PUT(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return caseApi.putBrief(id, request)
}
