import { fieldJobApi } from "@/lib/fieldjobs/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
    return fieldJobApi.listInspections(request)
}

export async function POST(request: Request): Promise<Response> {
    return fieldJobApi.createInspection(request)
}
