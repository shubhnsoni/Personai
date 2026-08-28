import { appointmentApi } from "@/lib/appointments/runtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { params: Promise<{ entryId: string }> }

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
    const { entryId } = await params
    return appointmentApi.cancelWaitlist(entryId, request)
}
