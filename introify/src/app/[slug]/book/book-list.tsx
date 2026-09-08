"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReserveSheet, type ReserveConfirmLabel } from "@/components/booking/reserve-sheet"
import { useMoney } from "@/components/pricing-provider"

type Service = {
    id: string
    name: string
    description: string | null
    priceCents: number
    isFree: boolean
    durationMinutes: number
    isActive: boolean
    kind?: string | null
    covers?: number | null
}

function sessionSheetProps(role?: string | null, durationMinutes?: number): {
    hideParty?: boolean
    partyLabel?: string
    confirmLabel: ReserveConfirmLabel
} {
    switch (role) {
        case "CA":
            return { hideParty: true, confirmLabel: "Book consult" }
        case "SALON_SPA":
            return {
                confirmLabel: "Book treatment",
                partyLabel: durationMinutes ? `${durationMinutes} min` : "Duration",
            }
        case "FIELD_SERVICE":
            return { confirmLabel: "Request visit" }
        default:
            return { confirmLabel: "Book session", partyLabel: "Attendees" }
    }
}

export function BookList({
    profile,
    services,
    restaurant,
    roleTemplate,
}: {
    profile: { id: string; displayName: string; whatsapp?: string | null; roleTemplate?: string | null }
    services: Service[]
    restaurant?: boolean
    roleTemplate?: string | null
}) {
    const [open, setOpen] = useState(false)
    const [serviceId, setServiceId] = useState<string | null>(null)
    const money = useMoney()
    const tables = services.filter((s) => s.kind === "TABLE")
    const sessions = services.filter((s) => s.kind !== "TABLE")
    const tableOnly = restaurant || (tables.length > 0 && sessions.length === 0)
    const table = tables[0] || null
    const role = roleTemplate ?? profile.roleTemplate
    const selectedSession = sessions.find((s) => s.id === serviceId) || sessions[0] || null

    if (tableOnly && table) {
        return (
            <>
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
                        <p className="text-sm text-zinc-400">Dine-in at</p>
                        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
                        <p className="mt-2 text-sm text-zinc-400">
                            Pick a party size and time. We hold the table. Phone so we can reach you.
                        </p>
                        <Button
                            className="mt-4 h-11 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            onClick={() => setOpen(true)}
                        >
                            Reserve a table
                        </Button>
                    </div>
                </div>
                <ReserveSheet
                    open={open}
                    onClose={() => setOpen(false)}
                    profile={profile}
                    service={table}
                />
            </>
        )
    }

    return (
        <>
            <div className="space-y-3">
                {tables.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                        <p className="font-medium">Reserve a table</p>
                        <p className="mt-1 text-sm text-zinc-400">Party size, tonight or later.</p>
                        <Button
                            className="mt-3 h-10 w-full rounded-full bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                            onClick={() => {
                                setServiceId(tables[0].id)
                                setOpen(true)
                            }}
                        >
                            Reserve
                        </Button>
                    </div>
                ) : null}
                {sessions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-medium">{s.name}</p>
                                {s.description && (
                                    <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{s.description}</p>
                                )}
                                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                                    <Clock className="h-3.5 w-3.5" />
                                    {s.durationMinutes} min
                                </p>
                            </div>
                            <p className="shrink-0 text-lg font-semibold tabular-nums">{money(s.priceCents)}</p>
                        </div>
                        <Button
                            className="mt-3 h-10 w-full rounded-full bg-brand text-brand-foreground"
                            onClick={() => {
                                setServiceId(s.id)
                                setOpen(true)
                            }}
                        >
                            Book
                        </Button>
                    </div>
                ))}
            </div>
            {table && serviceId === table.id ? (
                <ReserveSheet
                    open={open}
                    onClose={() => setOpen(false)}
                    profile={profile}
                    service={table}
                />
            ) : (
                <ReserveSheet
                    open={open}
                    onClose={() => setOpen(false)}
                    profile={profile}
                    service={selectedSession}
                    mode="session"
                    {...sessionSheetProps(role, selectedSession?.durationMinutes)}
                />
            )}
        </>
    )
}
