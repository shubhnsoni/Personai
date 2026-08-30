import { dueWorkApi } from "@/lib/operations/due-work-runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET only, and structurally so. Requesting a plan writes nothing and executes nothing, so there is no
 * write verb to export - a caller attempting POST, PATCH or DELETE gets Next.js's own 405 rather than
 * reaching a handler that would have to refuse. Adding one would be the first step from "preview" to
 * "trigger", which is exactly what this surface is forbidden to become.
 */
export async function GET(request: Request): Promise<Response> {
    return dueWorkApi.preview(request)
}
