import { NextResponse } from "next/server"
import { serveUploadFile } from "@/lib/upload-file-response"
import { confidentialUploadsEnabled } from "@/lib/private-upload-policy"
import { privateUploadsDirectory, verifyPrivateUpload } from "@/lib/private-uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UploadContext = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: UploadContext) {
    if (!confidentialUploadsEnabled()) return new NextResponse(null, { status: 404 })
    const secret = process.env.PRIVATE_UPLOADS_SECRET
    if (!secret) return new NextResponse(null, { status: 503 })
    const { path } = await context.params
    const token = new URL(request.url).searchParams.get("token") || ""
    if (!verifyPrivateUpload({ token, path, secret })) return new NextResponse(null, { status: 404 })
    return serveUploadFile(request, path, privateUploadsDirectory())
}

export async function HEAD(request: Request, context: UploadContext) {
    return GET(request, context)
}
