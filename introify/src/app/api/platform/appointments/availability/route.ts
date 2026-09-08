import { appointmentApi } from "@/lib/appointments/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return appointmentApi.availability(request)
}
