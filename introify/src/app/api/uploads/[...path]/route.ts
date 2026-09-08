import { serveUploadFile } from "@/lib/upload-file-response"
import { uploadReadDirectories } from "@/lib/uploads-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadContext = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: UploadContext): Promise<Response> {
    const { path } = await context.params
    return serveUploadFile(request, path, uploadReadDirectories())
}

export async function HEAD(request: Request, context: UploadContext): Promise<Response> {
    return GET(request, context)
}
