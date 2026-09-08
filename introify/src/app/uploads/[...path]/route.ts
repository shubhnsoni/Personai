import { resolve } from "node:path"
import { serveUploadFile } from "@/lib/upload-file-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadContext = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: UploadContext): Promise<Response> {
    const { path } = await context.params
    return serveUploadFile(request, path, resolve(process.cwd(), "public", "uploads"))
}

export async function HEAD(request: Request, context: UploadContext): Promise<Response> {
    return GET(request, context)
}
