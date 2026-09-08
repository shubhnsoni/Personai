import { prisma } from "@/lib/prisma"
import { syncUser } from "@/lib/auth-sync"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Cheap change cursor for the staff board.
 *
 * Exists because some hops (notably Cloudflare quick tunnels) buffer streaming
 * responses, so `EventSource` never delivers a frame. Polling this is a single
 * indexed aggregate, which is far cheaper than re-rendering the board on a timer.
 */
export async function GET() {
    const user = await syncUser()
    const profileIds = user?.profiles.map((profile) => profile.id) ?? []
    if (!user || profileIds.length === 0) {
        return new Response("Unauthorized", { status: 401 })
    }

    const latest = await prisma.orderEvent.aggregate({
        where: { order: { profileId: { in: profileIds } } },
        _max: { seq: true },
        _count: { _all: true },
    })

    return Response.json(
        {
            seq: latest._max.seq?.toString() ?? "0",
            count: latest._count._all,
        },
        { headers: { "Cache-Control": "no-store" } },
    )
}
