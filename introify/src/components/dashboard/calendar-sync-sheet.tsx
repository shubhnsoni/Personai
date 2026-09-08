"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { appleSubscribeUrl, googleSubscribeUrl, outlookSubscribeUrl } from "@/lib/ics"
import { rotateCalendarToken } from "@/app/actions/calendar-sync"
import { toast } from "sonner"

export function CalendarSyncSheet({
    open,
    onClose,
    icsUrl,
}: {
    open: boolean
    onClose: () => void
    icsUrl: string
}) {
    const [url, setUrl] = useState(icsUrl)
    const [pending, startTransition] = useTransition()
    const apple = appleSubscribeUrl(url)
    const google = googleSubscribeUrl(url)
    const outlook = outlookSubscribeUrl(url)

    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(`${label} link copied`)
        } catch {
            toast.error(value)
        }
    }

    return (
        <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
            <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetHeader>
                    <SheetTitle>Sync calendar</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 px-4 pb-4">
                    <p className="text-sm text-muted-foreground">
                        Subscribe once. New bookings show up in Apple, Google, and Outlook when those apps refresh.
                    </p>

                    <SyncRow
                        name="Apple Calendar"
                        hint="Opens Calendar and asks to subscribe"
                        href={apple}
                        onCopy={() => copy(apple, "Apple")}
                    />
                    <SyncRow
                        name="Google Calendar"
                        hint="Adds this feed as a calendar"
                        href={google}
                        onCopy={() => copy(url, "Google")}
                    />
                    <SyncRow
                        name="Outlook"
                        hint="Subscribe from the web"
                        href={outlook}
                        onCopy={() => copy(url, "Outlook")}
                    />

                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Secret feed</p>
                        <p className="mt-1 break-all text-xs">{url}</p>
                        <div className="mt-3 flex gap-2">
                            <Button className="flex-1 rounded-full" variant="outline" onClick={() => copy(url, "Feed")}>
                                Copy URL
                            </Button>
                            <Button className="flex-1 rounded-full" variant="outline" asChild>
                                <a href={url}>Download .ics</a>
                            </Button>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="text-xs text-muted-foreground underline"
                        disabled={pending}
                        onClick={() => {
                            startTransition(async () => {
                                const next = await rotateCalendarToken()
                                const nextUrl = url.replace(/\/api\/calendar\/[^/?]+/, `/api/calendar/${next}`)
                                setUrl(nextUrl)
                                toast.success("Old subscribe links stopped working")
                            })
                        }}
                    >
                        Reset link
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function SyncRow({
    name,
    hint,
    href,
    onCopy,
}: {
    name: string
    hint: string
    href: string
    onCopy: () => void
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            </div>
            <Button variant="outline" className="h-8 shrink-0 rounded-full px-3 text-xs" asChild>
                <a href={href} target="_blank" rel="noreferrer">Open</a>
            </Button>
            <Button variant="ghost" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={onCopy}>
                Copy
            </Button>
        </div>
    )
}
