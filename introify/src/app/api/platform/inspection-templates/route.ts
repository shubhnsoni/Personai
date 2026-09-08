import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
    return fieldJobApi.listTemplates(request)
}

export async function POST(request: Request): Promise<Response> {
    return fieldJobApi.createTemplate(request)
}
