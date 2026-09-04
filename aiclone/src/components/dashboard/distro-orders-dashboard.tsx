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
    DISTRO_ASSIGNABLE_DESKS,
    type DistroAssignableDesk,
    type DistroDesk,
} from "@/lib/distribute/desks"
import {
    assignDistroDesk,
    getDistroSeat,
    listDistroCatalog,
    listDistroOrders,
    placeDistroOrder,
    setDistroAccounts,
    setDistroApproval,
    setDistroWarehouse,
} from "@/app/actions/distribute"
import { ReceiptPrinter } from "@/components/shop/receipt-printer"
import type { ReceiptData } from "@/lib/receipt"
import { gstReceiptLines } from "@/lib/billing/gst"
import { ReceiptPrinter } from "@/components/shop/receipt-printer"
import type { ReceiptData } from "@/lib/receipt"
import { gstReceiptLines } from "@/lib/billing/gst"

type Tab = "pending" | "approved" | "dispatch" | "billed"

type OrderRow = Awaited<ReturnType<typeof listDistroOrders>>[number]
type CatalogRow = Awaited<ReturnType<typeof listDistroCatalog>>[number]
type Seat = Awaited<ReturnType<typeof getDistroSeat>>

const DESK_LABEL: Record<DistroDesk, string> = {
    admin: "Admin",
    sales: "Sales",
    warehouse: "Warehouse",
    accounts: "Accounts",
}

function rupees(paise: number) {
    return `₹${(paise / 100).toLocaleString("en-IN")}`
}

function distroReceiptData(order: OrderRow, shopName = "Invoice"): ReceiptData {
    const meta = order.meta
    const gstLines = meta.gstMode
        ? gstReceiptLines({
            mode: meta.gstMode,
            rateBps: meta.gstRateBps,
            gstPaise: meta.gstPaise,
            cgstPaise: meta.cgstPaise,
            sgstPaise: meta.sgstPaise,
            igstPaise: meta.igstPaise,
        }).map((g) => ({ label: g.label, amount: rupees(g.paise) }))
        : []
    return {
        shopName,
        gstin: meta.gstin || null,
        invoice: meta.invoice || null,
        number: order.number,
        tableLabel: meta.location,
        guestName: meta.dealer,
        status: meta.accounts === "BILLED" ? "PAID" : "PLACED",
        payStatus: meta.accounts === "BILLED" ? "PAID" : "UNPAID",
        payMethod: meta.invoice || "Bill",
        placedAt: new Date(order.placedAt).toLocaleString(),
        lines: order.lines.map((l) => ({
            qty: l.qty,
            title: l.title,
            lineTotal: rupees(l.linePaise),
        })),
        subtotal: rupees(meta.taxablePaise > 0 ? meta.taxablePaise : order.totalPaise),
        taxable: meta.taxablePaise > 0 ? rupees(meta.taxablePaise) : null,
        gstLines,
        tax: meta.gstPaise > 0 && gstLines.length === 0 ? rupees(meta.gstPaise) : null,
        total: rupees(order.totalPaise),
    }
}

export function DistroOrdersDashboard({ profileId }: { profileId: string }) {
    const [seat, setSeat] = useState<Seat | null>(null)
    const [tab, setTab] = useState<Tab>("pending")
    const [orders, setOrders] = useState<OrderRow[]>([])
    const [catalog, setCatalog] = useState<CatalogRow[]>([])
    const [pending, start] = useTransition()
    const [dealer, setDealer] = useState("Sharma Traders")
    const [location, setLocation] = useState<string>(DISTRO_LOCATIONS[0])
    const [salesman, setSalesman] = useState<string>(DISTRO_SALESMEN[0])
    const [qty, setQty] = useState<Record<string, number>>({})
    const [price, setPrice] = useState<Record<string, number>>({})
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteDesk, setInviteDesk] = useState<DistroAssignableDesk>("sales")
    const [receipt, setReceipt] = useState<ReceiptData | null>(null)

    function reload() {
        start(async () => {
            try {
                const [o, c, s] = await Promise.all([
                    listDistroOrders(profileId),
                    listDistroCatalog(profileId),
                    getDistroSeat(profileId),
                ])
                setOrders(o)
                setCatalog(c)
                setSeat(s)
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

    function invite() {
        start(async () => {
            try {
                const res = await assignDistroDesk(profileId, inviteEmail, inviteDesk)
                toast.success(`Assigned ${DESK_LABEL[res.desk]} desk`)
                setInviteEmail("")
                reload()
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not assign desk")
            }
        })
    }

    const canCreate = !!seat?.canCreate
    const canApprove = !!seat?.canApprove
    const canWarehouse = !!seat?.canWarehouse
    const canAccounts = !!seat?.canAccounts
    const canInvite = !!seat?.canInvite

    return (
        <div className="flex-1 space-y-5">
            <div>
                <p className="text-sm font-medium">Dealer orders</p>
                <p className="text-[12px] text-muted-foreground">
                    Salesman books the dealer, admin approves, warehouse dispatches, accounts bills.
                </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <p className="text-sm font-medium">
                    {seat?.desk ? `${DESK_LABEL[seat.desk]} desk` : "No desk seat"}
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">via membership · {seat?.role ?? "…"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                    Actions follow your Membership role. Wrong desks cannot approve, dispatch, or bill.
                </p>
            </div>

            {canInvite ? (
                <div className="studio-panel space-y-3 rounded-2xl p-4">
                    <p className="text-sm font-medium">Team desks</p>
                    <p className="text-[12px] text-muted-foreground">Assign a Membership desk by email. They must have signed in once.</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@email.com" />
                        <select
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={inviteDesk}
                            onChange={(e) => setInviteDesk(e.target.value as DistroAssignableDesk)}
                        >
                            {DISTRO_ASSIGNABLE_DESKS.map((d) => (
                                <option key={d} value={d}>{DESK_LABEL[d]}</option>
                            ))}
                        </select>
                        <Button className="rounded-full" disabled={pending} onClick={invite}>Assign</Button>
                    </div>
                    {(seat?.members?.length ?? 0) > 0 ? (
                        <ul className="space-y-1 text-[12px] text-muted-foreground">
                            {seat!.members.map((m) => (
                                <li key={m.id}>
                                    {m.name || m.email || m.userId}
                                    {m.email && m.name ? ` · ${m.email}` : ""}
                                    {" · "}
                                    {m.desk ? DESK_LABEL[m.desk] : m.role}
                                    {m.role === "OWNER" ? " (owner)" : ""}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {canCreate ? (
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
            ) : (
                <p className="text-[12px] text-muted-foreground">
                    {seat ? "Your membership seat cannot create orders. Sales or admin desk required." : "Loading seat…"}
                </p>
            )}

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
                            {canApprove && tab === "pending" ? (
                                <>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "APPROVED" as DistroApproval).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>Approve</Tiny>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "ON_HOLD" as DistroApproval).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>Hold</Tiny>
                                    <Tiny onClick={() => start(() => setDistroApproval(profileId, order.id, "NOT_APPROVED" as DistroApproval).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>Reject</Tiny>
                                </>
                            ) : null}
                            {canWarehouse && tab === "approved" ? (
                                <>
                                    <Tiny onClick={() => start(() => setDistroWarehouse(profileId, order.id, "DISPATCHED" as DistroWarehouse).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>Dispatch</Tiny>
                                    <Tiny onClick={() => start(() => setDistroWarehouse(profileId, order.id, "NO_STOCK" as DistroWarehouse).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>No stock</Tiny>
                                </>
                            ) : null}
                            {canAccounts && (tab === "dispatch" || tab === "approved") ? (
                                <Tiny onClick={() => start(() => setDistroAccounts(profileId, order.id, "BILLED" as DistroAccounts, `INV-${order.number}`).then(reload).catch((e) => toast.error(e instanceof Error ? e.message : "Denied")))} disabled={pending}>
                                    Bill INV-{order.number}
                                </Tiny>
                            ) : null}
                            {order.meta.invoice ? <span className="text-[12px] text-muted-foreground">{order.meta.invoice}</span> : null}
                            {order.meta.accounts === "BILLED" && order.meta.gstin ? (
                                <span className="text-[12px] text-muted-foreground">GSTIN {order.meta.gstin}</span>
                            ) : null}
                            {order.meta.accounts === "BILLED" && order.meta.taxablePaise > 0 ? (
                                <span className="text-[12px] text-muted-foreground">
                                    Taxable {rupees(order.meta.taxablePaise)}
                                    {order.meta.gstPaise > 0 ? ` · GST ${rupees(order.meta.gstPaise)}` : ""}
                                </span>
                            ) : null}
                            {order.meta.accounts === "BILLED" ? (
                                <Tiny onClick={() => setReceipt(distroReceiptData(order))} disabled={pending}>Receipt</Tiny>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
            {receipt ? <ReceiptPrinter data={receipt} onClose={() => setReceipt(null)} /> : null}
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
