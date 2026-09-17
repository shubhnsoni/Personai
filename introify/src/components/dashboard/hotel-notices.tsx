"use client"

import { useTransition } from "react"
import { readAllHotelNotices, readHotelNotice } from "@/app/actions/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"
import { cn } from "@/lib/utils"

type Notice = {
    id: string
    kind: string
    title: string
    body: string
    readAt: string | null
    createdAt: string
}

export function HotelNotices({ notices }: { notices: Notice[] }) {
    const [pending, start] = useTransition()
    if (!notices.length) return null
    const unread = notices.filter((row) => !row.readAt).length
    return (
        <StudioPanel className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">
                    Notifications{unread ? ` · ${unread}` : ""}
                </p>
                {unread ? (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(async () => { await readAllHotelNotices() })}
                        className="min-h-11 rounded-full px-3 text-xs text-muted-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                        Mark all read
                    </button>
                ) : null}
            </div>
            <div className="space-y-2">
                {notices.slice(0, 8).map((row) => (
                    <button
                        key={row.id}
                        type="button"
                        disabled={pending || Boolean(row.readAt)}
                        onClick={() => start(async () => { await readHotelNotice(row.id) })}
                        className={cn(
                            "flex min-h-11 w-full rounded-xl px-3 py-2 text-left transition-transform duration-150 ease-out active:scale-[0.96]",
                            row.kind === "EMERGENCY" ? "bg-red-400/10" : "bg-white/4",
                            !row.readAt && "shadow-[0px_0px_0px_1px_oklch(0.8_0.15_210_/_0.35)]",
                        )}
                    >
                        <span className="min-w-0">
                            <span className="block text-sm font-medium">{row.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{row.body}</span>
                        </span>
                    </button>
                ))}
            </div>
        </StudioPanel>
    )
}
