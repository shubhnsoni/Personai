import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ templateId: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { templateId } = await params
    return fieldJobApi.addTemplateItem(templateId, request)
}
