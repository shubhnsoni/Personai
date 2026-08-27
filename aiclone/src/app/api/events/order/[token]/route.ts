import { prisma } from "@/lib/prisma"
import { subscribeToOrder, type OrderStreamEvent } from "@/lib/realtime"
import { eventStreamResponse, parseLastEventId } from "@/lib/sse-stream"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REPLAY_LIMIT = 200

/**
 * Guest order stream, scoped to exactly one order by its unguessable
 * `publicToken`. It deliberately accepts no profile id, so a token can never be
 * widened into another order or a whole restaurant's feed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const publicToken = token?.trim()
    if (!publicToken) return new Response("Not found", { status: 404 })

    const order = await prisma.order.findUnique({
        where: { publicToken },
        select: { id: true, number: true },
    })
    if (!order) return new Response("Not found", { status: 404 })

    const url = new URL(request.url)
    const after = parseLastEventId(
        request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId"),
    )

    return eventStreamResponse({
        signal: request.signal,
        replay: async () => {
            if (after === null) return []
            const rows = await prisma.orderEvent.findMany({
                where: { seq: { gt: after }, orderId: order.id },
                orderBy: { seq: "asc" },
                take: REPLAY_LIMIT,
                select: {
                    seq: true,
                    orderLineId: true,
                    kind: true,
                    from: true,
                    to: true,
                    at: true,
                },
            })
            return rows.map<OrderStreamEvent>((row) => ({
                seq: row.seq.toString(),
                orderId: order.id,
                orderNumber: order.number,
                kind: row.kind,
                from: row.from,
                to: row.to,
                at: row.at.toISOString(),
                orderLineId: row.orderLineId,
            }))
        },
        subscribe: (push) => subscribeToOrder(order.id, push),
    })
}
