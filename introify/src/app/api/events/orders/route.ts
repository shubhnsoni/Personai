import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"
import { subscribeToProfiles, type OrderStreamEvent } from "@/lib/realtime"
import { eventStreamResponse, parseLastEventId } from "@/lib/sse-stream"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REPLAY_LIMIT = 200

/**
 * Staff order stream. Authenticated through Clerk and scoped to the profiles
 * the caller owns; it never accepts a profile id from the client.
 */
export async function GET(request: Request) {
    const user = await syncUser()
    const profileIds = user?.profiles.map((profile) => profile.id) ?? []
    if (!user || profileIds.length === 0) {
        return new Response("Unauthorized", { status: 401 })
    }

    const url = new URL(request.url)
    const after = parseLastEventId(
        request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId"),
    )

    return eventStreamResponse({
        signal: request.signal,
        replay: async () => {
            if (after === null) return []
            const rows = await prisma.orderEvent.findMany({
                where: { seq: { gt: after }, order: { profileId: { in: profileIds } } },
                orderBy: { seq: "asc" },
                take: REPLAY_LIMIT,
                select: {
                    seq: true,
                    orderId: true,
                    orderLineId: true,
                    kind: true,
                    from: true,
                    to: true,
                    at: true,
                    order: { select: { number: true } },
                },
            })
            return rows.map<OrderStreamEvent>((row) => ({
                seq: row.seq.toString(),
                orderId: row.orderId,
                orderNumber: row.order.number,
                kind: row.kind,
                from: row.from,
                to: row.to,
                at: row.at.toISOString(),
                orderLineId: row.orderLineId,
            }))
        },
        subscribe: (push) => subscribeToProfiles(profileIds, push),
    })
}
