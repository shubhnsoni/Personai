import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { CircleDollarSign, Clock3, Package, ReceiptText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RestaurantOrderControls } from "@/components/dashboard/restaurant-order-controls"
import { OrderStreamIndicator } from "@/components/dashboard/order-stream-indicator"

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

export async function RestaurantOrdersDashboard({ profileId }: { profileId: string }) {
    const orders = await prisma.order.findMany({
        where: { profileId },
        include: {
            lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        },
        orderBy: { placedAt: "desc" },
        take: 200,
    })
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

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Restaurant orders — grouped by guest checkout</p>
                <OrderStreamIndicator />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid revenue</CardTitle>
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{revenueLabel(paidOrders)}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open orders</CardTitle>
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{openOrders}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Items sold</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{itemsSold}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average ticket</CardTitle>
                        <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold">{paidOrders.length ? money(averageTicket, averageCurrency) : "—"}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Restaurant orders</CardTitle></CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground">No restaurant orders yet</p>
                    ) : (
                        <div className="space-y-4">
                            {orders.map((order) => (
                                <article key={order.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold">Order #{order.number}</p>
                                                <Badge variant={order.status === "PAID" ? "default" : order.status === "CANCELLED" ? "destructive" : "secondary"}>
                                                    {order.status}
                                                </Badge>
                                                <Badge variant="outline">{order.payStatus}</Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {order.guestName || "Guest"}{order.guestEmail ? ` · ${order.guestEmail}` : ""}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {order.tableLabel || "Takeaway"} · {order.payMethod || "Payment pending"} · {formatDistanceToNow(order.placedAt, { addSuffix: true })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold tabular-nums">{money(order.totalCents, order.currency)}</p>
                                            <Link href={`/dashboard/orders/${order.id}/receipt`} className="text-[11px] text-muted-foreground underline">
                                                Receipt
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="mt-3 divide-y divide-border/50 rounded-xl bg-background/70 px-3">
                                        {order.lines.map((line) => (
                                            <div key={line.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                                                <div className="min-w-0">
                                                    <p className="font-medium">{line.qty}× {line.titleSnapshot}</p>
                                                    {line.modifiersLabel ? <p className="text-xs text-muted-foreground">{line.modifiersLabel}</p> : null}
                                                    <p className="text-[11px] text-muted-foreground">{line.status}</p>
                                                </div>
                                                <span className="shrink-0 tabular-nums">{money(line.lineTotalCents, order.currency)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {order.cancelReason ? <p className="mt-2 text-xs text-rose-600">Cancelled: {order.cancelReason}</p> : null}
                                    <RestaurantOrderControls
                                        orderId={order.id}
                                        status={order.status}
                                        lines={order.lines.map((line) => ({
                                            id: line.id,
                                            title: line.titleSnapshot,
                                            status: line.status,
                                        }))}
                                    />
                                </article>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
