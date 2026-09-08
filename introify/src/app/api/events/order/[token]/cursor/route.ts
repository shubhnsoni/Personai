import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Change cursor for a single guest order, scoped by `publicToken` only.
 * Used when a buffering hop prevents the event stream from delivering frames.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const publicToken = token?.trim()
    if (!publicToken) return new Response("Not found", { status: 404 })

    const order = await prisma.order.findUnique({
        where: { publicToken },
        select: { id: true, status: true, payStatus: true },
    })
    if (!order) return new Response("Not found", { status: 404 })

    const latest = await prisma.orderEvent.aggregate({
        where: { orderId: order.id },
        _max: { seq: true },
        _count: { _all: true },
    })

    return Response.json(
        {
            seq: latest._max.seq?.toString() ?? "0",
            count: latest._count._all,
            status: order.status,
            payStatus: order.payStatus,
        },
        { headers: { "Cache-Control": "no-store" } },
    )
}
