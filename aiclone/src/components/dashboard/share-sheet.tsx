"use client"

import { useState } from "react"
import { Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QrCard } from "@/components/profile/qr-card"

export function ShareSheet({
    slug,
    name,
    baseUrl,
}: {
    slug: string
    name?: string
    baseUrl: string
}) {
    const [open, setOpen] = useState(false)
    const url = typeof window !== "undefined"
        ? `${window.location.origin}/${slug}`
        : `${baseUrl.replace(/\/$/, "")}/${slug}`

    return (
        <>
            <Button type="button" size="sm" pill className="shrink-0" onClick={() => setOpen(true)}>
                <Share2 className="mr-1 h-3.5 w-3.5" /> Share
            </Button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                    <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-medium">Share your page</p>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-muted-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mb-3 truncate text-xs text-muted-foreground">{url}</p>
                        <QrCard name={name || slug} slug={slug} compact />
                    </div>
                </div>
            )}
        </>
    )
}
