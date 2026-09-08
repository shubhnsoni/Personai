import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string; membershipId: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id, membershipId } = await params
    return cohortApi.progress(id, membershipId, request)
}
