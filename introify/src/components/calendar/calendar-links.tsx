"use client"

import { CalendarDays } from "lucide-react"
import { googleTemplateUrl, outlookTemplateUrl, type CalEvent } from "@/lib/ics"
import { cn } from "@/lib/utils"

export function CalendarLinks({
    event,
    icsHref,
    className,
}: {
    event: CalEvent
    icsHref: string
    className?: string
}) {
    const item = "flex h-9 flex-1 items-center justify-center rounded-full border border-border/70 text-xs font-medium hover:bg-muted"
    return (
        <div className={cn("flex gap-1.5", className)}>
            <a className={item} href={googleTemplateUrl(event)} target="_blank" rel="noreferrer">
                Google
            </a>
            <a className={item} href={icsHref}>
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                Apple
            </a>
            <a className={item} href={outlookTemplateUrl(event)} target="_blank" rel="noreferrer">
                Outlook
            </a>
        </div>
    )
}
