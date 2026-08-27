import { PrismaClient } from "@prisma/client"
import { publish, realtimeStats, subscribeToOrder, subscribeToProfiles } from "../../src/lib/realtime"
import type { OrderStreamEvent } from "../../src/lib/realtime"

/**
 * Phase 1 live transport checks.
 *
 * Fan-out is exercised in-process because `publish` is per-process by design.
 * Transport is exercised over real HTTP so it can be pointed at a tunnel:
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     scripts/one-off/check-order-stream.ts --base=https://<host> --idle-seconds=330
 *
 * Either transport is acceptable, and the report says which one carried the
 * updates: a live event stream, or the cursor poll used when a hop buffers
 * streaming responses. The run fails only if neither works. Database access is
 * restricted to a rehearsal copy.
 */

const SCRATCH_DATABASE_PATTERN = /^personalink_phase0_rehearsal_\d{8}_\d{6}$/u
const HEARTBEAT_MS = 25_000
const CURSOR_BUDGET_MS = 3_000

type Options = { base: string; idleSeconds: number; minSeconds: number }

const report: Record<string, unknown> = {}

function parseOptions(args: string[]): Options {
    let base = "http://127.0.0.1:3000"
    let idleSeconds = 330
    let minSeconds = 300
    for (const arg of args) {
        if (arg.startsWith("--base=")) {
            base = arg.slice("--base=".length).replace(/\/+$/u, "")
            continue
        }
        if (arg.startsWith("--idle-seconds=")) {
            idleSeconds = Number(arg.slice("--idle-seconds=".length))
            if (!Number.isFinite(idleSeconds) || idleSeconds < 0) throw new Error("--idle-seconds must be >= 0")
            continue
        }
        if (arg.startsWith("--min-seconds=")) {
            minSeconds = Number(arg.slice("--min-seconds=".length))
            if (!Number.isFinite(minSeconds) || minSeconds < 0) throw new Error("--min-seconds must be >= 0")
            continue
        }
        throw new Error(`Unknown argument: ${arg}`)
    }
    return { base, idleSeconds, minSeconds }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function scratchDatabaseName() {
    const raw = process.env.DATABASE_URL
    if (!raw) throw new Error("DATABASE_URL is required.")
    const name = decodeURIComponent(new URL(raw).pathname.replace(/^\//u, ""))
    if (!SCRATCH_DATABASE_PATTERN.test(name)) {
        throw new Error(`Refusing to run against non-rehearsal database: ${name || "<empty>"}.`)
    }
    return name
}

type StreamReader = {
    frames: string[]
    comments: string[]
    events: OrderStreamEvent[]
    ids: string[]
    closed: boolean
    error: string | null
    done: Promise<void>
}

/** Reads an SSE response incrementally, splitting on the blank-line delimiter. */
async function openStream(url: string, signal: AbortSignal): Promise<StreamReader> {
    const reader: StreamReader = {
        frames: [],
        comments: [],
        events: [],
        ids: [],
        closed: false,
        error: null,
        done: Promise.resolve(),
    }

    const response = await fetch(url, {
        signal,
        headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
    })
    assert(response.ok, `Stream returned HTTP ${response.status}`)
    assert(
        (response.headers.get("content-type") || "").includes("text/event-stream"),
        `Stream content-type was ${response.headers.get("content-type")}`,
    )
    assert(response.body, "Stream had no body")

    reader.done = (async () => {
        const decoder = new TextDecoder()
        let buffer = ""
        try {
            for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
                buffer += decoder.decode(chunk, { stream: true })
                let split = buffer.indexOf("\n\n")
                while (split !== -1) {
                    const frame = buffer.slice(0, split)
                    buffer = buffer.slice(split + 2)
                    reader.frames.push(frame)
                    if (frame.startsWith(":")) reader.comments.push(frame)
                    const lines = frame.split("\n")
                    const idLine = lines.find((line) => line.startsWith("id: "))
                    const dataLine = lines.find((line) => line.startsWith("data: "))
                    if (idLine) reader.ids.push(idLine.slice(4).trim())
                    if (dataLine) {
                        try {
                            reader.events.push(JSON.parse(dataLine.slice(6)) as OrderStreamEvent)
                        } catch {
                            reader.error = "Unparseable data frame"
                        }
                    }
                    split = buffer.indexOf("\n\n")
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!/abort/iu.test(message)) reader.error = message
        } finally {
            reader.closed = true
        }
    })()

    return reader
}

async function main() {
    const options = parseOptions(process.argv.slice(2))
    const database = scratchDatabaseName()
    const db = new PrismaClient()
    report.base = options.base
    report.database = database
    const syntheticSeqs: bigint[] = []
    let orderId: string | null = null
    let streamCarried = false
    let cursorCarried = false

    try {
        // 1. Fan-out semantics, in-process.
        const seen: Record<string, OrderStreamEvent[]> = { profile: [], order: [], foreign: [] }
        const sample: OrderStreamEvent = {
            seq: "999999999",
            orderId: "order-under-test",
            orderNumber: 7,
            kind: "ORDER_STATUS",
            from: "PLACED",
            to: "ACCEPTED",
            at: new Date().toISOString(),
            orderLineId: null,
        }
        const offProfile = subscribeToProfiles(["profile-under-test"], (event) => seen.profile.push(event))
        const offOrder = subscribeToOrder("order-under-test", (event) => seen.order.push(event))
        const offForeign = subscribeToProfiles(["someone-else"], (event) => seen.foreign.push(event))
        publish("profile-under-test", sample)
        const statsWhileSubscribed = realtimeStats()
        offProfile()
        offOrder()
        offForeign()
        publish("profile-under-test", sample)

        assert(seen.profile.length === 1, "Profile subscriber did not receive exactly one event")
        assert(seen.order.length === 1, "Order subscriber did not receive exactly one event")
        assert(seen.foreign.length === 0, "An unrelated profile received another profile's event")
        assert(realtimeStats().profileSubscribers === 0, "Unsubscribe left profile subscribers behind")
        assert(realtimeStats().orderSubscribers === 0, "Unsubscribe left order subscribers behind")
        report.fanOut = {
            profileDelivered: seen.profile.length,
            orderDelivered: seen.order.length,
            foreignDelivered: seen.foreign.length,
            subscribersWhileActive: statsWhileSubscribed,
            subscribersAfterTeardown: realtimeStats(),
            deliveredAfterUnsubscribe: false,
        }

        // 2. Authorization and scoping over HTTP.
        const staff = await fetch(`${options.base}/api/events/orders`, {
            headers: { Accept: "text/event-stream" },
        })
        assert(staff.status === 401, `Unauthenticated staff stream returned ${staff.status}, expected 401`)
        void staff.body?.cancel()

        const staffCursor = await fetch(`${options.base}/api/events/orders/cursor`)
        assert(staffCursor.status === 401, `Unauthenticated staff cursor returned ${staffCursor.status}, expected 401`)
        void staffCursor.body?.cancel()

        const bogus = await fetch(`${options.base}/api/events/order/not-a-real-token`, {
            headers: { Accept: "text/event-stream" },
        })
        assert(bogus.status === 404, `Unknown order token returned ${bogus.status}, expected 404`)
        void bogus.body?.cancel()

        const bogusCursor = await fetch(`${options.base}/api/events/order/not-a-real-token/cursor`)
        assert(bogusCursor.status === 404, `Unknown order cursor returned ${bogusCursor.status}, expected 404`)
        void bogusCursor.body?.cancel()

        report.authorization = {
            staffStreamWithoutAuth: staff.status,
            staffCursorWithoutAuth: staffCursor.status,
            unknownTokenStream: bogus.status,
            unknownTokenCursor: bogusCursor.status,
        }

        // 3. A real order to observe.
        const order = await db.order.findFirst({
            select: { id: true, publicToken: true, profileId: true, number: true },
            orderBy: { placedAt: "asc" },
        })
        assert(order, "No order exists in the rehearsal database to stream")
        orderId = order.id
        const baseline = await db.orderEvent.aggregate({ where: { orderId: order.id }, _max: { seq: true } })
        const baselineSeq = baseline._max.seq
        assert(baselineSeq !== null, "Order under test has no events")

        // 4. Event stream: does it deliver, and for how long?
        const controller = new AbortController()
        const live = await openStream(
            `${options.base}/api/events/order/${order.publicToken}`,
            controller.signal,
        )
        const connectedAt = Date.now()
        const deadline = connectedAt + options.idleSeconds * 1000
        // Stop early once a buffering hop is obvious: nothing at all after 30s.
        const bufferedProbeMs = 30_000
        while (Date.now() < deadline && !live.closed) {
            if (Date.now() - connectedAt > bufferedProbeMs && live.frames.length === 0) break
            await new Promise((resolve) => setTimeout(resolve, 1_000))
        }
        const heldMs = Date.now() - connectedAt
        const pings = live.comments.filter((line) => line.startsWith(": ping")).length
        const delivered = live.frames.length > 0
        streamCarried = delivered && heldMs / 1000 >= options.minSeconds

        report.eventStream = {
            requestedSeconds: options.idleSeconds,
            requiredSeconds: options.minSeconds,
            heldSeconds: Number((heldMs / 1000).toFixed(1)),
            framesReceived: live.frames.length,
            heartbeats: pings,
            minimumExpectedHeartbeats: delivered
                ? Math.max(0, Math.floor(Math.min(heldMs / 1000, options.idleSeconds) / (HEARTBEAT_MS / 1000)) - 1)
                : 0,
            sawConnectedPreamble: live.comments.some((line) => line.startsWith(": connected")),
            closedBeforeDeadline: live.closed,
            streamError: live.error,
            verdict: delivered
                ? (streamCarried ? "delivered" : "delivered-but-cut-early")
                : "buffered-by-intermediary",
            diagnosis: delivered
                ? null
                : "A hop between this client and the origin buffered the response body: the " +
                  "connection stayed open but not one frame arrived. Cloudflare quick tunnels do " +
                  "this. The cursor poll below is what keeps such a client current.",
        }
        controller.abort()
        await live.done

        if (delivered) {
            assert(
                report.eventStream && (report.eventStream as { sawConnectedPreamble: boolean }).sawConnectedPreamble,
                "Stream delivered frames but never sent its connected preamble",
            )
        }

        // 5. Last-Event-ID replay, and 6. cursor latency. Both need a committed
        //    event; a synthetic one stands in for a staff action because publish
        //    only reaches the server's own process.
        const cursorUrl = `${options.base}/api/events/order/${order.publicToken}/cursor`
        const before = await fetch(cursorUrl, { cache: "no-store" })
        assert(before.ok, `Cursor returned HTTP ${before.status}`)
        const beforeBody = (await before.json()) as { seq: string; count: number }

        const synthetic = await db.orderEvent.create({
            data: {
                orderId: order.id,
                kind: "ORDER_STATUS",
                from: "PLACED",
                to: "ACCEPTED",
                actor: "SYSTEM",
                metadata: { source: "check-order-stream", synthetic: true },
            },
            select: { seq: true },
        })
        syntheticSeqs.push(synthetic.seq)

        const pollStart = Date.now()
        let observedSeq = beforeBody.seq
        while (Date.now() - pollStart < CURSOR_BUDGET_MS && observedSeq === beforeBody.seq) {
            const response = await fetch(cursorUrl, { cache: "no-store" })
            if (response.ok) observedSeq = ((await response.json()) as { seq: string }).seq
            if (observedSeq === beforeBody.seq) await new Promise((resolve) => setTimeout(resolve, 150))
        }
        const cursorLatencyMs = Date.now() - pollStart
        cursorCarried = observedSeq === synthetic.seq.toString()

        report.cursorFallback = {
            url: `/api/events/order/<token>/cursor`,
            seqBefore: beforeBody.seq,
            seqAfter: observedSeq,
            expectedSeq: synthetic.seq.toString(),
            observedWithinMs: cursorLatencyMs,
            budgetMs: CURSOR_BUDGET_MS,
            reflectedNewEvent: cursorCarried,
        }
        assert(cursorCarried, `Cursor did not reflect the new event within ${CURSOR_BUDGET_MS}ms`)

        if (delivered) {
            const replayController = new AbortController()
            const replayed = await openStream(
                `${options.base}/api/events/order/${order.publicToken}?lastEventId=${baselineSeq.toString()}`,
                replayController.signal,
            )
            const replayDeadline = Date.now() + 10_000
            while (Date.now() < replayDeadline && replayed.events.length === 0 && !replayed.closed) {
                await new Promise((resolve) => setTimeout(resolve, 200))
            }
            replayController.abort()
            await replayed.done

            assert(replayed.events.length >= 1, "Reconnect with Last-Event-ID replayed nothing")
            assert(
                replayed.events.map((event) => event.seq).includes(synthetic.seq.toString()),
                `Replay did not include the missed event ${synthetic.seq.toString()}`,
            )
            assert(
                replayed.events.every((event) => event.orderId === order.id),
                "Replay leaked an event from another order",
            )
            assert(
                replayed.ids.includes(synthetic.seq.toString()),
                "Replayed frames did not carry the SSE id needed to resume again",
            )
            report.replay = {
                resumedFrom: baselineSeq.toString(),
                replayedCount: replayed.events.length,
                includedMissedEvent: true,
                allFramesScopedToOrder: true,
                carriedResumableIds: true,
            }
        } else {
            report.replay = { skipped: "the event stream is buffered on this route, so there is nothing to resume" }
        }

        report.verdict = {
            eventStreamViable: streamCarried,
            cursorFallbackViable: cursorCarried,
            liveUpdatesPossible: streamCarried || cursorCarried,
        }
        assert(streamCarried || cursorCarried, "Neither the event stream nor the cursor fallback works on this route")
    } finally {
        if (orderId && syntheticSeqs.length > 0) {
            await db.orderEvent.deleteMany({ where: { orderId, seq: { in: syntheticSeqs } } })
        }
        await db.$disconnect()
        report.cleanup = { syntheticEventsRemoved: syntheticSeqs.length }
    }

    console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    console.error("--- diagnostics ---")
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 1
})
