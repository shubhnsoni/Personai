import { blueprintPreviewApi } from "@/lib/business-os/preview-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ blueprintId: string }> }

/**
 * GET only, and read-only. Resolving a preview writes nothing: no installed-blueprint record exists to
 * write, and this handler has no path to one.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { blueprintId } = await params
    return blueprintPreviewApi.preview(blueprintId, request)
}
