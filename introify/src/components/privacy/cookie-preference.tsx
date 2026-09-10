"use client"

import { useEffect, useState } from "react"
import Link from "@/components/navigation/transition-link"
import {
    analyticsAllowed,
    readAnalyticsConsent,
    writeAnalyticsConsent,
    type AnalyticsConsent,
} from "@/lib/analytics-consent"
import { cn } from "@/lib/utils"

function browserStore(): Storage | null {
    try { return window.localStorage } catch { return null }
}

function persistChoice(choice: AnalyticsConsent) {
    const storage = browserStore()
    if (!storage) return
    writeAnalyticsConsent(storage, choice)
    document.cookie = `pl_analytics=${choice}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
    window.dispatchEvent(new Event("introify-analytics-consent"))
}

export function CookiePreferenceBar() {
    const [choice, setChoice] = useState<AnalyticsConsent | null | "pending">("pending")
    useEffect(() => {
        const storage = browserStore()
        setChoice(storage ? readAnalyticsConsent(storage) : null)
    }, [])
    if (choice === "pending" || choice) return null
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    Analytics cookies are off until you allow them.{" "}
                    <Link href="/cookie-policy" className="underline underline-offset-4">Cookie policy</Link>
                </p>
                <div className="flex shrink-0 gap-2">
                    <button type="button" className="h-9 rounded-full px-3 text-sm text-muted-foreground" onClick={() => { persistChoice("denied"); setChoice("denied") }}>Essential only</button>
                    <button type="button" className="h-9 rounded-full bg-foreground px-3 text-sm text-background" onClick={() => { persistChoice("granted"); setChoice("granted") }}>Allow analytics</button>
                </div>
            </div>
        </div>
    )
}

export function CookiePreferenceManager({ className }: { className?: string }) {
    const [choice, setChoice] = useState<AnalyticsConsent | null>(null)
    useEffect(() => {
        const storage = browserStore()
        if (storage) setChoice(readAnalyticsConsent(storage))
    }, [])
    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            <button
                type="button"
                className={cn("h-9 rounded-full border px-3 text-sm", choice === "denied" ? "border-foreground" : "border-border")}
                onClick={() => { persistChoice("denied"); setChoice("denied") }}
            >
                Essential only
            </button>
            <button
                type="button"
                className={cn("h-9 rounded-full border px-3 text-sm", analyticsAllowed(choice) ? "border-foreground" : "border-border")}
                onClick={() => { persistChoice("granted"); setChoice("granted") }}
            >
                Allow analytics
            </button>
        </div>
    )
}
