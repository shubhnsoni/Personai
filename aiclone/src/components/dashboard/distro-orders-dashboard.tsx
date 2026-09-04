"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    DISTRO_LOCATIONS,
    DISTRO_SALESMEN,
    distroTab,
    type DistroAccounts,
    type DistroApproval,
    type DistroWarehouse,
} from "@/lib/distribute/meta"
import {
    listDistroCatalog,
    listDistroOrders,
    placeDistroOrder,
    setDistroAccounts,
    setDistroApproval,
    setDistroWarehouse,
} from "@/app/actions/distribute"

type Tab = "pending" | "approved" | "dispatch" | "billed"

type OrderRow = Awaited<ReturnType<typeof listDistroOrders>>[number]
type CatalogRow = Awaited<ReturnType<typeof listDistroCatalog>>[number]

function rupees(paise: number) {
    return `₹${(paise / 100).toLocaleString("en-IN")}`
}

export function DistroOrdersDashboard({ profileId }: { profileId: string }) {
    const [tab, setTab] = useState<Tab>("pending")
    const [orders, setOrders] = useState<OrderRow[]>([])
    const [catalog, setCatalog] = useState<CatalogRow[]>([])
    const [pending, start] = useTransition()
    const [dealer, setDealer] = useState("Sharma Traders")
    const [location, setLocation] = useState<string>(DISTRO_LOCATIONS[0])
    const [salesman, setSalesman] = useState<string>(DISTRO_SALESMEN[0])
    const [qty, setQty] = useState<Record<string, number>>({})
    const [price, setPrice] = useState<Record<string, number>>({})

    function reload() {
        start(async () => {
            try {
                const [o, c] = await Promise.all([listDistroOrders(profileId), listDistroCatalog(profileId)])
                setOrders(o)
                setCatalog(c)
                setPrice((cur) => {
                    const next = { ...cur }
                    for (const row of c) if (next[row.id] == null) next[row.id] = row.priceCents
                    return next
                })
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not load orders")
            }
        })
    }

    useEffect(() => {
        reload()
        // First load only — tab changes refetch via the action buttons.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId])

    const shown = useMemo(() => orders.filter((o) => distroTab(o.meta) === tab), [orders, tab])

    function place() {
        const lines = catalog
            .map((p) => ({ productId: p.id, qty: qty[p.id] || 0, unitPaise: price[p.id] ?? p.priceCents }))
            .filter((l) => l.qty > 0)
        start(async () => {
            try {
                const placed = await placeDistroOrder({ profileId, dealer, location, salesman, lines })
                toast.success(`Order #${placed.number} is in pending approval`)
                setQty({})
                setTab("pending")
                reload()
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not place order")
            }
        })
    }

    return (
        <div className="flex-1 space-y-5">
            <div>
                <p className="text-sm font-medium">B2B dealer orders</p>
                <p className="text-[12px] text-muted-foreground">Book a dealer, approve, dispatch, then bill — one real distributor desk.</p>
            </div>

            <div className="studio-panel space-y-3 rounded-2xl p-4">
                <p className="text-sm font-medium">New order</p>
                <div className="grid gap-2 sm:grid-cols-3">
                    <Input value={dealer} onChange={(e) => setDealer(e.target.value)} placeholder="Dealer" />
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={location} onChange={(e) => setLocation(e.target.value)}>
                        {DISTRO_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={salesman} onChange={(e) => setSalesman(e.target.value)}>
                        {DISTRO_SALESMEN.map((l) => <option key={l}>{l}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    {catalog.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">{p.title}<span className="text-muted-foreground"> · {p.category}</span></span>
                            <Input
                                className="h-9 w-24"
                                type="number"
                                min={0}
                                value={Math.round((price[p.id] ?? p.priceCents) / 100)}
                                onChange={(e) => setPrice((cur) => ({ ...cur, [p.id]: Math.max(0, Number(e.target.value) || 0) * 100 }))}
                            />
                            <Input
                                className="h-9 w-16"
                                type="number"
                                min={0}
                                value={qty[p.id] || ""}
                                onChange={(e) => setQty((cur) => ({ ...cur, [p.id]: Math.max(0, Number(e.target.value) || 0) }))}
                            />
                        </div>
                    ))}
                </div>
                <Button className="rounded-full" disabled={pending} onClick={place}>Place order</Button>
            </div>

            <div className="flex gap-1 overflow-x-auto">
                {([
                    ["pending", "Pending approval"],
                    ["approved", "Approved"],
                    ["dispatch", "Dispatch"],
                    ["billed", "Billed"],
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn("rounded-full px-3 py-1.5 text-[12px]", tab === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {shown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing in this slice.</p>
                ) : shown.map((order) => (
                    <div key={order.id} className="studio-panel space-y-2 rounded-2xl p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium">#{order.number} · {order.meta.dealer}</p>
                            <p className="text-sm">{rupees(order.totalPaise)}</p>
                        </div>
                        <p className="text-[12px] text-muted-foreground">{order.meta.location} · {order.meta.salesman}</p>
                        <ul className="text-sm">
                            {order.lines.map((l) => (
                                <li key={l.id}>{l.qty} × {l.title} @ {rupees(l.unitPaise)}</li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {tab === "pending" ? (
                                <>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "APPROVED" as DistroApproval).then(reload))} disabled={pending}>Approve</Tiny>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "ON_HOLD" as DistroApproval).then(reload))} disabled={pending}>Hold</Tiny>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "NOT_APPROVED" as DistroApproval).then(reload))} disabled={pending}>Reject</Tiny>
                                </>
                            ) : null}
                            {tab === "approved" ? (
                                <>
                                    <Tiny onClick={() => start(() => setDistroWarehouse(profileId, order.id, "DISPATCHED" as DistroWarehouse).then(reload))} disabled={pending}>Dispatch</Tiny>
                                    <Tiny onClick={() => start(() => setDistroWarehouse(profileId, order.id, "NO_STOCK" as DistroWarehouse).then(reload))} disabled={pending}>No stock</Tiny>
                                </>
                            ) : null}
                            {tab === "dispatch" || tab === "approved" ? (
                                <Tiny onClick={() => start(() => setDistroAccounts(profileId, order.id, "BILLED" as DistroAccounts, `INV-${order.number}`).then(reload))} disabled={pending}>
                                    Bill INV-{order.number}
                                </Tiny>
                            ) : null}
                            {order.meta.invoice ? <span className="text-[12px] text-muted-foreground">{order.meta.invoice}</span> : null}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function Tiny({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
    return (
        <button type="button" disabled={disabled} onClick={onClick} className="rounded-full border border-border/70 px-3 py-1 text-[12px] disabled:opacity-50">
            {children}
        </button>
    )
}
