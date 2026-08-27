import type { OrderStreamEvent } from "@/lib/realtime"

/**
 * Server-sent events plumbing shared by the staff and guest order streams.
 *
 * The 25s heartbeat is below the common 30s idle-proxy cut, and
 * `X-Accel-Buffering: no` plus `no-transform` stop intermediaries from
 * buffering or recompressing the stream, which is what makes it survive a
 * Cloudflare tunnel.
 */

const HEARTBEAT_MS = 25_000
const CLIENT_RETRY_MS = 3_000

/**
 * Some intermediaries hold a response until an internal buffer fills before
 * forwarding anything, which stalls an otherwise correct event stream. A one-off
 * comment padding block pushes past that threshold immediately. Comments are
 * ignored by `EventSource`, so this costs one payload per connection and nothing
 * afterwards.
 */
const PADDING_FRAME = `: ${"padding".repeat(586)}\n\n`

export function eventStreamResponse(options: {
    signal: AbortSignal
    /** Events missed while disconnected, resolved from Last-Event-ID. */
    replay: () => Promise<OrderStreamEvent[]>
    subscribe: (push: (event: OrderStreamEvent) => void) => () => void
}) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            // Held together in one object so `teardown` can be defined before
            // the heartbeat and subscription exist.
            const state: {
                open: boolean
                heartbeat?: ReturnType<typeof setInterval>
                unsubscribe?: () => void
            } = { open: true }

            const teardown = () => {
                if (!state.open) return
                state.open = false
                if (state.heartbeat) clearInterval(state.heartbeat)
                options.signal.removeEventListener("abort", teardown)
                try {
                    state.unsubscribe?.()
                } catch {
                    // Nothing useful to do while closing.
                }
                try {
                    controller.close()
                } catch {
                    // Already closed by the runtime.
                }
            }

            const send = (chunk: string) => {
                if (!state.open) return
                try {
                    controller.enqueue(encoder.encode(chunk))
                } catch {
                    // The client vanished between checks.
                    teardown()
                }
            }

            const sendEvent = (event: OrderStreamEvent) => {
                send(`id: ${event.seq}\nevent: order\ndata: ${JSON.stringify(event)}\n\n`)
            }

            if (options.signal.aborted) {
                teardown()
                return
            }
            options.signal.addEventListener("abort", teardown)

            send(`retry: ${CLIENT_RETRY_MS}\n\n`)
            send(PADDING_FRAME)
            send(": connected\n\n")

            try {
                for (const event of await options.replay()) sendEvent(event)
            } catch {
                // A failed replay must not kill the live stream; the client's
                // refresh fallback reconciles anything missed.
                send(": replay-unavailable\n\n")
            }

            if (!state.open) return

            state.unsubscribe = options.subscribe(sendEvent)
            state.heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS)
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, no-transform, must-revalidate",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}

export function parseLastEventId(raw: string | null): bigint | null {
    const value = raw?.trim()
    if (!value || !/^\d{1,19}$/u.test(value)) return null
    try {
        const parsed = BigInt(value)
        return parsed >= BigInt(0) ? parsed : null
    } catch {
        return null
    }
}
