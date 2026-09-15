import { http404Response } from "@/lib/http-404"

export const dynamic = "force-dynamic"

export function GET() {
    return http404Response("GET")
}

export function HEAD() {
    return http404Response("HEAD")
}
