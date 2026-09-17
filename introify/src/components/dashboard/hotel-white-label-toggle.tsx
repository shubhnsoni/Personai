"use client"

import { useState, useTransition } from "react"
import { saveHotelWhiteLabel } from "@/app/actions/hotels"
import { StudioPanel } from "@/components/dashboard/studio-ui"

export function HotelWhiteLabelToggle({ entitled, enabled }: { entitled: boolean; enabled: boolean }) {
    const [on, setOn] = useState(enabled && entitled)
    const [pending, start] = useTransition()
    return (
        <StudioPanel className="p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">White label</p>
                    <p className="mt-1 text-sm font-medium">Hide Introify chrome on the guest concierge</p>
                    <p className="text-xs text-muted-foreground">
                        {entitled
                            ? "Room and stay QR URLs stay the same. concierge. host comes later."
                            : "Paid custom branding unlocks this. Guest QR URLs already work."}
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={!entitled || pending}
                    onClick={() => {
                        const next = !on
                        setOn(next)
                        start(async () => { await saveHotelWhiteLabel(next) })
                    }}
                    className="inline-flex h-11 min-h-11 min-w-11 items-center rounded-full border border-white/10 px-4 text-sm transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
                >
                    {on ? "On" : "Off"}
                </button>
            </div>
        </StudioPanel>
    )
}
