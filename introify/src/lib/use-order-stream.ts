"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { OrderStreamEvent } from "@/lib/realtime"

const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 15_000
const REFRESH_DEBOUNCE_MS = 200
const CURSOR_POLL_MS = 2_000
const HARD_REFRESH_MS = 10_000

/**
 * Subscribes to an order event stream and refreshes the server component tree
 * when something changes.
 *
 * Reconnection is managed here rather than left to `EventSource` so the backoff
 * is bounded and the resume point is passed explicitly as `lastEventId`, which
 * survives proxies that drop the `Last-Event-ID` request header.
 *
 * Some hops buffer streaming responses outright — a Cloudflare quick tunnel
 * delivers zero frames — so `EventSource` can sit in CONNECTING forever without
 * erroring. While the stream is not open, a 2s cursor poll drives refreshes and
 * a 10s unconditional refresh backs it up. `degraded` lets the UI admit it is
 * polling rather than presenting stale data as live.
 */
export function useOrderStream(path: string, cursorPath?: string) {
    const router = useRouter()
    const [connected, setConnected] = useState(false)
    const [lastEventAt, setLastEventAt] = useState<number | null>(null)
    const lastSeq = useRef<string | null>(null)

    useEffect(() => {
        let cancelled = false
        let source: EventSource | null = null
        let attempt = 0
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined
        let refreshTimer: ReturnType<typeof setTimeout> | undefined
        let cursor: string | null = null

        const isOpen = () => source !== null && source.readyState === EventSource.OPEN

        const scheduleRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer)
            // Coalesce bursts: several lines can change in one action.
            refreshTimer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
        }

        const connect = () => {
            if (cancelled) return

            const url = new URL(path, window.location.origin)
            if (lastSeq.current) url.searchParams.set("lastEventId", lastSeq.current)
            const stream = new EventSource(url.toString())
            source = stream

            stream.onopen = () => {
                if (cancelled) return
                attempt = 0
                setConnected(true)
            }

            stream.addEventListener("order", (event) => {
                if (cancelled) return
                const message = event as MessageEvent<string>
                if (message.lastEventId) lastSeq.current = message.lastEventId
                try {
                    const parsed = JSON.parse(message.data) as OrderStreamEvent
                    if (parsed.seq) lastSeq.current = parsed.seq
                } catch {
                    // Keep the id from the frame; the refresh still reconciles.
                }
                setLastEventAt(Date.now())
                scheduleRefresh()
            })

            stream.onerror = () => {
                if (cancelled) return
                setConnected(false)
                stream.close()
                attempt += 1
                const wait = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS)
                reconnectTimer = setTimeout(connect, wait + Math.floor(Math.random() * 250))
            }
        }

        connect()

        const cursorPoll = cursorPath
            ? setInterval(async () => {
                if (cancelled || isOpen()) return
                try {
                    const response = await fetch(cursorPath, { cache: "no-store" })
                    if (!response.ok) return
                    const next = (await response.json()) as { seq?: string }
                    if (typeof next.seq !== "string") return
                    if (cursor !== null && next.seq !== cursor) {
                        setLastEventAt(Date.now())
                        scheduleRefresh()
                    }
                    cursor = next.seq
                } catch {
                    // Offline or blocked; the hard refresh below still runs.
                }
            }, CURSOR_POLL_MS)
            : undefined

        const hardRefresh = setInterval(() => {
            if (cancelled || isOpen()) return
            router.refresh()
        }, HARD_REFRESH_MS)

        return () => {
            cancelled = true
            if (cursorPoll) clearInterval(cursorPoll)
            clearInterval(hardRefresh)
            if (reconnectTimer) clearTimeout(reconnectTimer)
            if (refreshTimer) clearTimeout(refreshTimer)
            source?.close()
        }
    }, [path, cursorPath, router])

    return { degraded: !connected, lastEventAt }
}
