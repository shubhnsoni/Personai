"use client"

import { useEffect } from "react"

function vid() {
    try {
        const key = "pl_vid"
        let id = localStorage.getItem(key)
        if (!id) {
            id = crypto.randomUUID()
            localStorage.setItem(key, id)
        }
        return id
    } catch {
        return ""
    }
}

function refFrom() {
    try {
        const q = new URLSearchParams(window.location.search).get("ref")
        if (q) return q.slice(0, 40)
        const m = document.cookie.match(/(?:^|; )pl_ref=([^;]+)/)
        return m ? decodeURIComponent(m[1]).slice(0, 40) : ""
    } catch {
        return ""
    }
}

export function track(slug: string, name: string, meta?: Record<string, unknown>) {
    if (typeof window === "undefined") return
    if (document.referrer.includes("/dashboard")) return
    const body = {
        slug,
        name,
        path: window.location.pathname.slice(0, 180),
        ref: refFrom(),
        meta,
    }
    const json = JSON.stringify(body)
    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/events", new Blob([json], { type: "application/json" }))
            return
        }
    } catch { /* fall through */ }
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {})
}

export function Tracker({ slug, name = "visit" }: { slug: string; name?: string }) {
    useEffect(() => {
        try {
            const id = vid()
            if (id) document.cookie = `pl_vid=${id}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
            const q = new URLSearchParams(window.location.search).get("ref")
            if (q) document.cookie = `pl_ref=${encodeURIComponent(q.slice(0, 40))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
        } catch { /* ignore */ }
        track(slug, name)
    }, [slug, name])
    return null
}
