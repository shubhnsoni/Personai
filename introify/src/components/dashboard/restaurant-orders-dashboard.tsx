import Link from "next/link"
import { headers } from "next/headers"
import { formatDistanceToNow } from "date-fns"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { RestaurantOrderControls } from "@/components/dashboard/restaurant-order-controls"
import { OrderStreamIndicator } from "@/components/dashboard/order-stream-indicator"
import { TableQrStudio } from "@/components/dashboard/table-qr-studio"
import { FloorKitchenTabs } from "@/components/dashboard/floor-kitchen-tabs"
import { tablesForProfile } from "@/lib/restaurant-tables"
import { reservationLabel } from "@/lib/menu"
import { ensureProfilePaymentQr } from "@/app/actions/payment-qr"

function money(cents: number, currency: string) {
    try {
        return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100)
    } catch {
        return `${currency} ${(cents / 100).toFixed(2)}`
    }
}

function revenueLabel(orders: Array<{ totalCents: number; currency: string }>) {
    const totals = new Map<string, number>()
    for (const order of orders) totals.set(order.currency, (totals.get(order.currency) || 0) + order.totalCents)
    if (!totals.size) return "—"
    return [...totals.entries()].map(([currency, cents]) => money(cents, currency)).join(" + ")
}

export async function RestaurantOrdersDashboard({ profileId, slug }: { profileId: string; slug: string }) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = `${proto}://${host}`

    await ensureProfilePaymentQr(profileId).catch(() => null)
    const [orders, tables, bookings, dueRows] = await Promise.all([
        prisma.order.findMany({
            where: { profileId },
            include: {
                lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
            },
            orderBy: { placedAt: "desc" },
            take: 200,
        }),
        tablesForProfile(profileId).catch((err) => {
            console.error("restaurant tables", err)
            return []
        }),
        prisma.booking.findMany({
            where: {
                profileId,
                status: { not: "CANCELLED" },
                startTime: { gte: start, lt: end },
            },
            include: { serviceOffering: true },
            orderBy: { startTime: "asc" },
        }),
        prisma.$queryRaw<Array<{ id: string; dueAt: Date | null; staffNote: string | null }>>`
            SELECT id, "dueAt", "staffNote" FROM "Order" WHERE "profileId" = ${profileId}
        `.catch(() => []),
    ])
    const dueById = new Map(dueRows.map((row) => [row.id, row]))
    const paidOrders = orders.filter((order) => order.status === "PAID" && order.payStatus === "PAID")
    const itemsSold = paidOrders.reduce(
        (sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.qty, 0),
        0,
    )
    const openOrders = orders.filter((order) => order.status !== "PAID" && order.status !== "CANCELLED").length
    const averageTicket = paidOrders.length
        ? Math.round(paidOrders.reduce((sum, order) => sum + order.totalCents, 0) / paidOrders.length)
        : 0
    const averageCurrency = paidOrders[0]?.currency || orders[0]?.currency || "USD"

    const stats = [
        { label: "Paid", value: revenueLabel(paidOrders) },
        { label: "Open", value: String(openOrders) },
        { label: "Sold", value: String(itemsSold) },
        { label: "Avg ticket", value: paidOrders.length ? money(averageTicket, averageCurrency) : "—" },
    ]

    return (
        <div className="flex-1 space-y-5">
            <FloorKitchenTabs
                openOrders={openOrders}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/calendar" className="text-[12px] text-muted-foreground underline">Reservations</Link>
                        <Link href="/dashboard/profile" className="text-[12px] text-muted-foreground underline">Payment QR</Link>
                        <OrderStreamIndicator />
                    </div>
                }
                floor={
                    <TableQrStudio
                        slug={slug}
                        origin={origin}
                        bookings={bookings.map((booking) => ({
                            id: booking.id,
                            name: booking.visitorName,
                            detail: reservationLabel(booking.metadata, booking.serviceOffering.name),
                            time: booking.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        }))}
                        tables={tables.map((table) => ({
                            id: table.id,
                            label: table.label,
                            seats: table.seats,
                            zone: table.zone,
                            code: table.code,
                            isActive: table.isActive,
                            isReserved: Boolean((table as { isReserved?: boolean }).isReserved),
                        }))}
                    />
                }
                kitchen={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 divide-x divide-border/60 overflow-hidden rounded-2xl border border-border/60">
                            {stats.map((stat) => (
                                <div key={stat.label} className="min-w-0 px-3 py-3">
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                                    <p className="mt-1 truncate text-[1.05rem] font-semibold tabular-nums sm:text-lg">{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {orders.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">No restaurant orders yet</p>
                        ) : (
                            <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60">
                                {orders.map((order) => (
                                    <article key={order.id} className="px-4 py-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold">#{order.number}</p>
                                                    <Badge variant={order.status === "PAID" ? "default" : order.status === "CANCELLED" ? "destructive" : "secondary"}>
                                                        {order.status}
                                                    </Badge>
                                                    {order.payStatus !== "UNPAID" ? <Badge variant="outline">{order.payStatus}</Badge> : null}
                                                </div>
                                                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                                    {order.guestName || "Guest"}
                                                    {order.tableLabel ? ` · ${order.tableLabel}` : " · Takeaway"}
                                                    {" · "}
                                                    {formatDistanceToNow(order.placedAt, { addSuffix: true })}
                                                </p>
                                                <p className="mt-1 text-sm">
                                                    {order.lines.map((line) => `${line.qty}× ${line.titleSnapshot}`).join(" · ")}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="font-semibold tabular-nums">{money(order.totalCents, order.currency)}</p>
                                                <Link href={`/dashboard/orders/${order.id}/receipt`} className="text-[11px] text-muted-foreground underline">
                                                    Receipt
                                                </Link>
                                            </div>
                                        </div>
                                        {order.cancelReason ? <p className="mt-1 text-xs text-rose-600">Cancelled: {order.cancelReason}</p> : null}
                                        <RestaurantOrderControls
                                            orderId={order.id}
                                            status={order.status}
                                            guestPaid={order.paymentRef === "guest-confirmed"}
                                            dueAt={dueById.get(order.id)?.dueAt?.toISOString() || null}
                                            staffNote={dueById.get(order.id)?.staffNote || null}
                                        />
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                }
            />
        </div>
    )
}
