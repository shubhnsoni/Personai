"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
    BROWSER_ALERTS_DISMISSED_KEY,
    browserNotificationOptions,
    nextStaffAlertState,
    shouldPromptBrowserPermission,
    type StaffAlert,
    type StaffAlertCursor,
} from "@/lib/staff-browser-alerts"

function currentPermission(): NotificationPermission | "unsupported" {
    if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported"
    return Notification.permission
}

function showStaffNotification(alert: StaffAlert, onOpen: (href: string) => void) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return
    const opts = browserNotificationOptions(alert)
    const note = new Notification(opts.title, {
        body: opts.body,
        tag: opts.tag,
        requireInteraction: opts.requireInteraction,
    })
    note.onclick = () => {
        window.focus()
        onOpen(alert.href)
        note.close()
    }
}

export function StaffBrowserNotifications() {
    const router = useRouter()
    const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "unknown">("unknown")
    const [dismissed, setDismissed] = useState(false)
    const cursor = useRef<StaffAlertCursor>({ primed: false, seenIds: [] })

    useEffect(() => {
        setPermission(currentPermission())
        try {
            setDismissed(window.localStorage.getItem(BROWSER_ALERTS_DISMISSED_KEY) === "1")
        } catch {
            setDismissed(false)
        }
    }, [])

    useEffect(() => {
        if (permission !== "granted") return
        let alive = true
        const load = async () => {
            try {
                const res = await fetch("/api/staff/alerts", { credentials: "include" })
                if (!res.ok) return
                const data = await res.json() as { alerts?: StaffAlert[] }
                if (!alive || !Array.isArray(data.alerts)) return
                const next = nextStaffAlertState(cursor.current, data.alerts)
                cursor.current = { primed: next.primed, seenIds: next.seenIds }
                for (const alert of next.toNotify) {
                    showStaffNotification(alert, (href) => router.push(href))
                }
            } catch {
                // ignore poll failures; the next tick retries
            }
        }
        void load()
        const tick = window.setInterval(load, 4000)
        return () => {
            alive = false
            window.clearInterval(tick)
        }
    }, [permission, router])

    const prompt = permission !== "unknown" && shouldPromptBrowserPermission({
        supported: permission !== "unsupported",
        permission: permission === "unsupported" ? "denied" : permission,
        dismissed,
    })

    if (!prompt) return null

    const rememberDismissed = () => {
        try {
            window.localStorage.setItem(BROWSER_ALERTS_DISMISSED_KEY, "1")
        } catch {
            // private mode can block storage; still hide for this visit
        }
        setDismissed(true)
    }

    const enable = async () => {
        if (typeof Notification === "undefined") return
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== "granted") rememberDismissed()
    }

    return (
        <div
            role="status"
            className="flex shrink-0 items-center gap-2 border-b border-white/8 bg-background/80 px-3 py-2 md:px-5 lg:px-8"
        >
            <p className="min-w-0 flex-1 text-sm text-zinc-100">
                Turn on browser alerts for live chat and hotel requests.
            </p>
            <button
                type="button"
                onClick={rememberDismissed}
                className="min-h-11 rounded-full px-3 text-xs text-muted-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
            >
                Not now
            </button>
            <button
                type="button"
                onClick={() => void enable()}
                className="inline-flex min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-sm font-medium text-[#061018] transition-[transform,background-color] duration-150 ease-out hover:bg-[#5ee7ff] active:scale-[0.96]"
            >
                Enable
            </button>
        </div>
    )
}
