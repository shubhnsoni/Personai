"use client"

import { useState } from "react"
import { Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QrCard } from "@/components/profile/qr-card"

export function ShareSheet({
    slug,
    name,
}: {
    slug: string
    name?: string
    baseUrl: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button type="button" size="sm" pill className="shrink-0" onClick={() => setOpen(true)}>
                <Share2 className="mr-1 h-3.5 w-3.5" /> Share
            </Button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                    <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_-32px_rgba(15,23,42,0.28)] dark:border-white/10 dark:shadow-[0_-24px_80px_-32px_rgba(0,215,255,0.35)] sm:max-w-sm sm:rounded-[1.6rem]">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300/80">Share your page</p>
                            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <QrCard name={name || slug} slug={slug} compact />
                    </div>
                </div>
            )}
        </>
    )
}
