"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatInrPaise, mgToGrams, rupeesToPaise } from "@/lib/metal/math"
import { metalCashflow, takeMetalPayment } from "@/app/actions/metal-bills"

type Flow = NonNullable<Awaited<ReturnType<typeof metalCashflow>>>
type Row = Flow["overdue"][number]

function BillRows({
    rows,
    action,
    pending,
    pay,
    setPay,
    run,
    upiId,
}: {
    rows: Row[]
    action: "Collect" | "Pay"
    pending: boolean
    pay: Record<string, string>
    setPay: (next: Record<string, string> | ((c: Record<string, string>) => Record<string, string>)) => void
    run: (fn: () => Promise<void>) => void
    upiId?: string | null
}) {
    return (
        <div className="studio-panel divide-y divide-white/8 rounded-2xl">
            {rows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2 px-3 py-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{row.name}</p>
                        <p className="text-[12px] text-muted-foreground">
                            {formatInrPaise(row.duePaise)} · {row.daysOverdue}d overdue
                            {action === "Collect" && upiId ? ` · UPI ${upiId}` : ""}
                        </p>
                    </div>
                    <Input
                        className="h-9 w-24"
                        inputMode="decimal"
                        placeholder="₹"
                        value={pay[row.id] || ""}
                        onChange={(e) => setPay((c) => ({ ...c, [row.id]: e.target.value }))}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-full"
                        disabled={pending}
                        onClick={() => run(async () => {
                            try {
                                await takeMetalPayment({
                                    partyId: row.partyId,
                                    paise: rupeesToPaise(Number(pay[row.id]) || row.duePaise / 100),
                                    method: "UPI",
                                    billIds: [row.id],
                                })
                                toast.success(action === "Collect" ? "Payment in" : "Paid out")
                            } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not record")
                            }
                        })}
                    >
                        {action}
                    </Button>
                    {row.chase ? (
                        <a href={row.chase} target="_blank" rel="noreferrer" className="h-9 rounded-full bg-[#25D366] px-3 text-xs font-medium leading-9 text-zinc-950">
                            WhatsApp
                        </a>
                    ) : null}
                </div>
            ))}
        </div>
    )
}

export function UdharBoard({ upiId }: { upiId?: string | null }) {
    const [flow, setFlow] = useState<Flow | null>(null)
    const [pending, start] = useTransition()
    const [pay, setPay] = useState<Record<string, string>>({})

    function reload() {
        void metalCashflow().then(setFlow)
    }

    useEffect(() => { reload() }, [])

    if (!flow) return null

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                    ["Shops owe you", flow.shopsOwe],
                    ["You owe", flow.weOwe],
                    ["Metal on hand", flow.metalOnHandPaise],
                    ["Stock", null],
                ].map(([label, value]) => (
                    <div key={String(label)} className="studio-panel rounded-2xl px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                            {label === "Stock" ? `${mgToGrams(flow.remainingMg)} g` : formatInrPaise(Number(value) || 0)}
                        </p>
                    </div>
                ))}
            </div>
            {flow.overdue.length ? (
                <BillRows
                    rows={flow.overdue}
                    action="Collect"
                    pending={pending}
                    pay={pay}
                    setPay={setPay}
                    run={(fn) => start(async () => { await fn(); reload() })}
                    upiId={upiId}
                />
            ) : (
                <p className="text-sm text-muted-foreground">No open shop bills.</p>
            )}
            {flow.payables.length ? (
                <BillRows
                    rows={flow.payables}
                    action="Pay"
                    pending={pending}
                    pay={pay}
                    setPay={setPay}
                    run={(fn) => start(async () => { await fn(); reload() })}
                />
            ) : null}
        </div>
    )
}
