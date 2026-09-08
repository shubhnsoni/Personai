import { reservationService } from "@/lib/reservations/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request): Promise<Response> {
    return reservationService.list(request)
}

export function POST(request: Request): Promise<Response> {
    return reservationService.create(request)
}
