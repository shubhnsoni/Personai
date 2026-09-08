import { appointmentApi } from "@/lib/appointments/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return appointmentApi.listWaitlist(request)
}

export function POST(request: Request): Promise<Response> {
    return appointmentApi.joinWaitlist(request)
}
