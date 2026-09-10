"use client"

import { useEffect } from "react"
import { analyticsAllowed, readAnalyticsConsent } from "@/lib/analytics-consent"

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

export function SessionProbe({ slug }: { slug: string }) {
    useEffect(() => {
        if (typeof window === "undefined") return
        try { if (!analyticsAllowed(readAnalyticsConsent(window.localStorage))) return } catch { return }
        if (document.referrer.includes("/dashboard") || document.referrer.includes("/admin")) return
        const visitor = vid()
        if (visitor) document.cookie = `pl_vid=${visitor}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
        const params = new URLSearchParams(window.location.search)
        const state = { sessionId: "", pageviewId: "" }

        const body = (extra: Record<string, unknown> = {}) => JSON.stringify({
            slug,
            path: window.location.pathname.slice(0, 180),
            ref: params.get("ref") || "",
            referrer: document.referrer.slice(0, 180),
            utmSource: params.get("utm_source") || "",
            utmMedium: params.get("utm_medium") || "",
            utmCampaign: params.get("utm_campaign") || "",
            sessionId: state.sessionId || undefined,
            pageviewId: state.pageviewId || undefined,
            ...extra,
        })

        const beat = (leave = false) => {
            const payload = body(leave ? { leave: true } : {})
            const send = () => fetch("/api/events/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: leave,
            }).then(async (res) => {
                if (!res.ok || leave) return
                const data = await res.json().catch(() => null)
                if (data?.sessionId) state.sessionId = data.sessionId
                if (data?.pageviewId) state.pageviewId = data.pageviewId
            }).catch(() => {})
            send()
        }

        beat()
        const tick = window.setInterval(() => beat(), 15000)
        const onHide = () => beat(true)
        window.addEventListener("pagehide", onHide)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") onHide()
        })
        return () => {
            window.clearInterval(tick)
            window.removeEventListener("pagehide", onHide)
            beat(true)
        }
    }, [slug])
    return null
}
