import { appointmentApi } from "@/lib/appointments/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return appointmentApi.getDeposit(id, request)
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return appointmentApi.requireDeposit(id, request)
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { id } = await params
    return appointmentApi.transitionDeposit(id, request)
}
