import { caseApi } from "@/lib/cases/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ intakeId: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { intakeId } = await params
    return caseApi.convertIntake(intakeId, request)
}
