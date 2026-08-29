import { cohortApi } from "@/lib/cohorts/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ changeId: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { changeId } = await params
    return cohortApi.applyAccessChange(changeId, request)
}
