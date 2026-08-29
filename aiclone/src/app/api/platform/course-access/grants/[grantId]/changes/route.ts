import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ grantId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { grantId } = await params
    return cohortApi.listAccessChanges(grantId, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { grantId } = await params
    return cohortApi.requestAccessChange(grantId, request)
}
