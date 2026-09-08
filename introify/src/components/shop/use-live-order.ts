"use client"

import { useEffect, useState } from "react"
import { dropLiveOrderToken, isLiveKitchenStatus, readLiveOrderTokens } from "@/lib/live-order"

export type LiveOrder = {
    token: string
    number: number
    status: string
    tableLabel?: string | null
    dueAt?: string | null
    titles?: string[]
}

export function useLiveOrders(slug: string) {
    const [orders, setOrders] = useState<LiveOrder[]>([])

    useEffect(() => {
        let stop = false
        async function pull() {
            const tokens = readLiveOrderTokens(slug)
            if (!tokens.length) {
                if (!stop) setOrders([])
                return
            }
            const rows = await Promise.all(tokens.map(async (token) => {
                try {
                    const res = await fetch(`/api/o/${token}`, { cache: "no-store" })
                    if (!res.ok) {
                        dropLiveOrderToken(slug, token)
                        return null
                    }
                    const next = await res.json() as LiveOrder & { lines?: Array<{ title: string }> }
                    if (!isLiveKitchenStatus(next.status)) return null
                    return {
                        token: next.token,
                        number: next.number,
                        status: next.status,
                        tableLabel: next.tableLabel || null,
                        dueAt: next.dueAt || null,
                        titles: (next.lines || []).map((line) => line.title).slice(0, 3),
                    }
                } catch {
                    return null
                }
            }))
            if (stop) return
            const live = rows.filter((row): row is LiveOrder => Boolean(row))
                .sort((a, b) => b.number - a.number)
            for (const token of tokens) {
                if (!live.some((row) => row.token === token)) dropLiveOrderToken(slug, token)
            }
            setOrders(live)
        }
        void pull()
        const id = window.setInterval(pull, 8000)
        return () => {
            stop = true
            window.clearInterval(id)
        }
    }, [slug])

    return orders
}

export function useLiveOrder(slug: string) {
    return useLiveOrders(slug)[0] || null
}
