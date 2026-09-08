import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ inspectionId: string; itemId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { inspectionId, itemId } = await params
    return fieldJobApi.recordInspectionItem(inspectionId, itemId, request)
}
