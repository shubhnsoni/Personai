import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
    return fieldJobApi.listJobs(request)
}

export async function POST(request: Request): Promise<Response> {
    return fieldJobApi.createJob(request)
}