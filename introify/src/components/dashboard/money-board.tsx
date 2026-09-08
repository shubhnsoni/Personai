"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ResendLibraryLink } from "@/components/dashboard/resend-library-link"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ShoppingBag } from "lucide-react"
import { ConfirmOrderButton } from "@/components/dashboard/confirm-order-button"
import Link from "next/link"
import { useMoney } from "@/components/pricing-provider"

export type MoneyItem = {
    id: string
    kind: "product" | "course" | "event" | "room" | "call"
    title: string
    status: string
    amountCents: number
    at: string
    receiptHref?: string
    canConfirm?: boolean
}

export type MoneyPerson = {
    email: string
    name: string
    items: MoneyItem[]
}

const KIND_LABEL: Record<MoneyItem["kind"], string> = {
    product: "Product",
    course: "Course",
    event: "Event",
    room: "Community",
    call: "Service",
}

export function MoneyBoard({
    people,
    stats,
}: {
    people: MoneyPerson[]
    stats: { revenueCents: number; products: number; courses: number; events: number; members: number }
}) {
    const money = useMoney()
    const [openEmail, setOpenEmail] = useState<string | null>(null)
    const active = people.find((p) => p.email === openEmail) || null

    const rows = useMemo(
        () =>
            people
                .map((p) => ({
                    ...p,
                    total: p.items.reduce((s, i) => s + i.amountCents, 0),
                    lastAt: Math.max(0, ...p.items.map((i) => +new Date(i.at))),
                }))
                .sort((a, b) => b.lastAt - a.lastAt),
        [people]
    )

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/70 bg-card sm:grid-cols-3 lg:grid-cols-5">
                {[
                    { t: "Revenue", v: money(stats.revenueCents) },
                    { t: "Products", v: stats.products },
                    { t: "Courses", v: stats.courses },
                    { t: "Events", v: stats.events },
                    { t: "Members", v: stats.members },
                ].map((cell) => (
                    <div key={cell.t} className="border-b border-r border-border/60 px-3 py-2.5 last:border-r-0">
                        <p className="text-[11px] text-muted-foreground">{cell.t}</p>
                        <p className="text-lg font-semibold tabular-nums">{cell.v}</p>
                    </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">Customers — tap someone to see what they bought</p>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                {rows.length === 0 ? (
                    <EmptyState
                        icon={<ShoppingBag />}
                        title="No sales yet"
                        description="When someone buys a file, course, or seat, they land here."
                    />
                ) : (
                    rows.map((p) => (
                        <button
                            key={p.email}
                            type="button"
                            onClick={() => setOpenEmail(p.email)}
                            className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-3 text-left last:border-b-0 hover:bg-muted/40"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{p.name || p.email}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {p.email} · {p.items.length} item{p.items.length === 1 ? "" : "s"}
                                </p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums">{money(p.total)}</span>
                        </button>
                    ))
                )}
            </div>

            <Sheet open={!!active} onOpenChange={(o) => !o && setOpenEmail(null)}>
                <SheetContent side="bottom" className="max-h-[85dvh] overflow-auto rounded-t-2xl sm:max-w-none">
                    {active && (
                        <>
                            <SheetHeader>
                                <SheetTitle>{active.name || active.email}</SheetTitle>
                                <SheetDescription>{active.email}</SheetDescription>
                            </SheetHeader>
                            <div className="space-y-2 px-4 pb-6">
                                <ResendLibraryLink email={active.email} />
                                {active.items
                                    .slice()
                                    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{item.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {KIND_LABEL[item.kind]} · {item.status.toLowerCase()} ·{" "}
                                                    {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="block text-sm tabular-nums text-muted-foreground">
                                                    {money(item.amountCents)}
                                                </span>
                                                {item.canConfirm ? <ConfirmOrderButton purchaseId={item.id} /> : null}
                                                {item.receiptHref ? (
                                                    <Link href={item.receiptHref} className="mt-1 block text-[11px] text-muted-foreground underline">
                                                        Receipt
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
