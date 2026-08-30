import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ templateId: string; itemId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { templateId, itemId } = await params
    return fieldJobApi.updateTemplateItem(templateId, itemId, request)
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
    const { templateId, itemId } = await params
    return fieldJobApi.removeTemplateItem(templateId, itemId, request)
}
