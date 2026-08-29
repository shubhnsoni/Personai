import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ inspectionId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { inspectionId } = await params
    return fieldJobApi.setInspectionHandoff(inspectionId, request)
}
