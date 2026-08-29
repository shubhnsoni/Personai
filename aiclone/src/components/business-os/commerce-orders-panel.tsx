"use client"

import { Truck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    type AllocationView,
    type CommerceEventView,
    type EligibilityView,
    type FulfilmentView,
    type OrderView,
    type ReturnView,
    commerceErrorCopy,
    commerceRequest,
    formatWhen,
    isAbort,
    money,
    titleCase,
} from "./commerce-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing shipments and returns console.
 *
 * Every figure is the server's derived value: how much of a line is still shippable, how
 * much actually shipped, and how much could still come back. Nothing is recomputed here, so
 * the screen cannot disagree with the record.
 *
 * Two honesty properties the copy states plainly:
 *   - stock leaves at SHIPPED, not when a shipment is packed
 *   - carrier and tracking are owner-entered; no carrier is contacted
 */

type Bundle = Readonly<{
    allocations: readonly AllocationView[]
    fulfilments: readonly FulfilmentView[]
    eligibility: readonly EligibilityView[]
    returns: readonly ReturnView[]
}>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
            {children}
        </section>
    )
}

function Nothing({ label }: { label: string }) {
    return <p className="text-xs text-muted-foreground">{label}</p>
}

function returnStateVariant(state: string) {
    if (state === "RECEIVED" || state === "APPROVED") return "default" as const
    if (state === "REJECTED" || state === "CANCELLED") return "destructive" as const
    return "secondary" as const
}

export function CommerceOrdersPanel({ workspaceId, locationId }: { workspaceId: string; locationId: string }) {
    const [orders, setOrders] = useState<readonly OrderView[] | null>(null)
    const [openOrderId, setOpenOrderId] = useState("")
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [events, setEvents] = useState<readonly CommerceEventView[] | null>(null)
    const [openSubject, setOpenSubject] = useState<{ type: string; id: string } | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [revision, setRevision] = useState(0)
    const [shipmentRef, setShipmentRef] = useState("")
    const [returnRef, setReturnRef] = useState("")
    const [decidedBy, setDecidedBy] = useState("")

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setOrders(null)
            return
        }
        const controller = new AbortController()
        setOrders(null)
        setError(null)
        commerceRequest<{ orders: readonly OrderView[] }>(
            `/api/platform/orders?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setOrders(data.orders))
            .catch((cause) => {
                if (isAbort(cause)) return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    useEffect(() => {
        if (!openOrderId || !workspaceId) {
            setBundle(null)
            return
        }
        const controller = new AbortController()
        const opts = { signal: controller.signal }
        const query = `workspaceId=${encodeURIComponent(workspaceId)}`
        const order = encodeURIComponent(openOrderId)
        setBundle(null)
        Promise.all([
            commerceRequest<{ allocations: readonly AllocationView[] }>(`/api/platform/orders/${order}/allocations?${query}`, opts),
            commerceRequest<{ fulfilments: readonly FulfilmentView[] }>(`/api/platform/fulfilments?${query}&orderId=${order}`, opts),
            commerceRequest<{ eligibility: readonly EligibilityView[] }>(`/api/platform/orders/${order}/return-eligibility?${query}`, opts),
            commerceRequest<{ returns: readonly ReturnView[] }>(`/api/platform/returns?${query}&orderId=${order}`, opts),
        ])
            .then(([a, f, e, r]) =>
                setBundle({ allocations: a.allocations, fulfilments: f.fulfilments, eligibility: e.eligibility, returns: r.returns }),
            )
            .catch((cause) => {
                if (isAbort(cause)) return
                setActionError(cause)
            })
        return () => controller.abort()
    }, [openOrderId, workspaceId, revision])

    useEffect(() => {
        if (!openSubject || !workspaceId) {
            setEvents(null)
            return
        }
        const controller = new AbortController()
        setEvents(null)
        commerceRequest<{ events: readonly CommerceEventView[] }>(
            `/api/platform/commerce-events?workspaceId=${encodeURIComponent(workspaceId)}&subjectType=${openSubject.type}&subjectId=${encodeURIComponent(openSubject.id)}`,
            { signal: controller.signal },
        )
            .then((data) => setEvents(data.events))
            .catch((cause) => {
                if (isAbort(cause)) return
                setActionError(cause)
            })
        return () => controller.abort()
    }, [openSubject, workspaceId, revision])

    const mutate = useCallback(
        async (key: string, url: string, method: string, payload: Record<string, unknown>) => {
            setBusy(key)
            setActionError(null)
            try {
                await commerceRequest(url, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, ...payload }),
                })
                reload()
                return true
            } catch (cause) {
                setActionError(cause)
                return false
            } finally {
                setBusy("")
            }
        },
        [reload, workspaceId],
    )

    if (error) {
        const copy = commerceErrorCopy(error)
        return (
            <Card>
                <CardContent>
                    <ErrorState title={copy.title} description={copy.description} />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Shipments and returns</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Partial shipments, return eligibility and restocking against real orders. Stock leaves when a
                    shipment is marked shipped, not when it is packed. Carrier and tracking are whatever you type here;
                    no carrier is contacted.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<Truck aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its orders."
                    />
                ) : null}

                {workspaceId && orders === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading orders</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={commerceErrorCopy(actionError).title}
                        description={commerceErrorCopy(actionError).description}
                    />
                ) : null}

                {orders?.length === 0 ? (
                    <EmptyState
                        icon={<Truck aria-hidden="true" />}
                        title="No orders yet"
                        description="Shipments and returns are recorded against real orders. None exist, and no sample orders are shown."
                    />
                ) : null}

                {orders && orders.length > 0 ? (
                    <ul className="space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                        {orders.slice(0, 25).map((order) => (
                            <li key={order.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        #{order.number} · {money(order.totalCents, order.currency)}
                                    </span>
                                    <Badge variant="secondary">{titleCase(order.status)}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {order.guestName ?? "no guest name"} · {order.lineCount} line
                                    {order.lineCount === 1 ? "" : "s"} · {order.fulfilmentCount} shipment
                                    {order.fulfilmentCount === 1 ? "" : "s"} · {order.returnCount} return
                                    {order.returnCount === 1 ? "" : "s"} · {formatWhen(order.placedAt)}
                                </p>
                                <div className="mt-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-expanded={openOrderId === order.id}
                                        onClick={() => setOpenOrderId(openOrderId === order.id ? "" : order.id)}
                                    >
                                        {openOrderId === order.id ? "Hide detail" : "Show detail"}
                                    </Button>
                                </div>

                                {openOrderId === order.id ? (
                                    <div className="mt-3 space-y-5 border-t border-border/70 pt-3">
                                        {bundle === null ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading shipments and returns</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : (
                                            <>
                                                <Section title="Lines still to ship">
                                                    {bundle.allocations.length === 0 ? (
                                                        <Nothing label="This order has no lines." />
                                                    ) : (
                                                        <ul className="space-y-1 text-xs">
                                                            {bundle.allocations.map((a) => (
                                                                <li key={a.orderLineId} className="flex flex-wrap justify-between gap-2">
                                                                    <span>{a.title}</span>
                                                                    <span className="text-muted-foreground">
                                                                        {a.allocated} of {a.ordered} allocated ·{" "}
                                                                        {a.remaining} still to ship · {a.fulfilled}{" "}
                                                                        shipped
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <Nothing label="Allocated counts lines on any live shipment. Cancelling a shipment frees them again." />
                                                </Section>

                                                <Section title="Shipments">
                                                    {bundle.fulfilments.length === 0 ? (
                                                        <Nothing label="Nothing has been shipped for this order." />
                                                    ) : (
                                                        <ul className="space-y-2">
                                                            {bundle.fulfilments.map((f) => (
                                                                <li key={f.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span>{f.reference}</span>
                                                                        <Badge variant={f.state === "DELIVERED" ? "default" : "secondary"}>
                                                                            {titleCase(f.state)}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {f.items.length} line
                                                                        {f.items.length === 1 ? "" : "s"} ·{" "}
                                                                        {f.trackingNumber
                                                                            ? `tracking ${f.trackingNumber} (entered by hand)`
                                                                            : "no tracking entered"}
                                                                        {f.shippedAt ? ` · shipped ${formatWhen(f.shippedAt)}` : ""}
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        {f.allowedTransitions.map((next) => (
                                                                            <Button
                                                                                key={next}
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={busy === `f:${f.id}`}
                                                                                onClick={() =>
                                                                                    mutate(
                                                                                        `f:${f.id}`,
                                                                                        `/api/platform/fulfilments/${encodeURIComponent(f.id)}`,
                                                                                        "PATCH",
                                                                                        { state: next },
                                                                                    )
                                                                                }
                                                                            >
                                                                                {titleCase(next)}
                                                                            </Button>
                                                                        ))}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            aria-expanded={openSubject?.id === f.id}
                                                                            onClick={() =>
                                                                                setOpenSubject(
                                                                                    openSubject?.id === f.id
                                                                                        ? null
                                                                                        : { type: "FULFILMENT", id: f.id },
                                                                                )
                                                                            }
                                                                        >
                                                                            {openSubject?.id === f.id ? "Hide history" : "Show history"}
                                                                        </Button>
                                                                    </div>
                                                                    {f.state === "PACKED" ? (
                                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                                            Marking this shipped is what takes the units
                                                                            off the shelf. Packing has not moved any
                                                                            stock.
                                                                        </p>
                                                                    ) : null}
                                                                    {f.allowedTransitions.length === 0 ? (
                                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                                            This shipment is {f.state.toLowerCase()} and
                                                                            cannot change.
                                                                        </p>
                                                                    ) : null}
                                                                    {openSubject?.id === f.id ? (
                                                                        <div className="mt-2 border-t border-border/70 pt-2">
                                                                            {events === null ? (
                                                                                <div aria-live="polite" aria-busy="true">
                                                                                    <span className="sr-only">
                                                                                        Loading shipment history
                                                                                    </span>
                                                                                    <Skeleton className="h-6 w-full" />
                                                                                </div>
                                                                            ) : events.length === 0 ? (
                                                                                <Nothing label="No history recorded." />
                                                                            ) : (
                                                                                <ol className="space-y-1 text-xs text-muted-foreground">
                                                                                    {events.map((e) => (
                                                                                        <li key={e.id}>
                                                                                            <span className="font-mono">
                                                                                                #{e.seq}
                                                                                            </span>{" "}
                                                                                            {e.from ? `${e.from} → ` : ""}
                                                                                            {e.to} · {e.actor} ·{" "}
                                                                                            {formatWhen(e.at)}
                                                                                        </li>
                                                                                    ))}
                                                                                </ol>
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`shipment-ref-${order.id}`}>
                                                                New shipment reference
                                                            </Label>
                                                            <Input
                                                                id={`shipment-ref-${order.id}`}
                                                                value={shipmentRef}
                                                                onChange={(event) => setShipmentRef(event.target.value)}
                                                                placeholder="SHIP-001"
                                                            />
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            disabled={busy === `newf:${order.id}` || !shipmentRef.trim()}
                                                            onClick={async () => {
                                                                const ok = await mutate(
                                                                    `newf:${order.id}`,
                                                                    "/api/platform/fulfilments",
                                                                    "POST",
                                                                    {
                                                                        orderId: order.id,
                                                                        reference: shipmentRef,
                                                                        ...(locationId ? { locationId } : {}),
                                                                    },
                                                                )
                                                                if (ok) setShipmentRef("")
                                                            }}
                                                        >
                                                            Start shipment
                                                        </Button>
                                                    </div>
                                                </Section>

                                                <Section title="Returnable">
                                                    {bundle.eligibility.every((e) => e.returnable === 0) ? (
                                                        <Nothing label="Nothing on this order can be returned: either it has not shipped, or a live return already claims it." />
                                                    ) : (
                                                        <ul className="space-y-1 text-xs">
                                                            {bundle.eligibility.map((e) => (
                                                                <li key={e.orderLineId} className="flex flex-wrap justify-between gap-2">
                                                                    <span>{e.title}</span>
                                                                    <span className="text-muted-foreground">
                                                                        {e.fulfilled} shipped · {e.claimed} claimed ·{" "}
                                                                        {e.returnable} returnable
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </Section>

                                                <Section title="Returns">
                                                    {bundle.returns.length === 0 ? (
                                                        <Nothing label="No returns requested for this order." />
                                                    ) : (
                                                        <ul className="space-y-2">
                                                            {bundle.returns.map((r) => (
                                                                <li key={r.id} className="rounded-lg border border-border/70 p-2 text-sm">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span>{r.reference}</span>
                                                                        <Badge variant={returnStateVariant(r.state)}>
                                                                            {titleCase(r.state)}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {r.reason ?? "no reason given"} ·{" "}
                                                                        {r.items.length} line
                                                                        {r.items.length === 1 ? "" : "s"}
                                                                        {r.decidedBy ? ` · decided by ${r.decidedBy}` : ""}
                                                                        {r.refundPaymentId
                                                                            ? " · refund linked"
                                                                            : " · no refund linked"}
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                                        {r.allowedTransitions.map((next) => (
                                                                            <Button
                                                                                key={next}
                                                                                size="sm"
                                                                                variant="outline"
                                                                                disabled={busy === `r:${r.id}`}
                                                                                onClick={() =>
                                                                                    mutate(
                                                                                        `r:${r.id}`,
                                                                                        `/api/platform/returns/${encodeURIComponent(r.id)}`,
                                                                                        "PATCH",
                                                                                        {
                                                                                            state: next,
                                                                                            ...(next === "APPROVED" ||
                                                                                            next === "REJECTED"
                                                                                                ? { decidedBy: decidedBy || "owner" }
                                                                                                : {}),
                                                                                        },
                                                                                    )
                                                                                }
                                                                            >
                                                                                {titleCase(next)}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                    {r.allowedTransitions.includes("APPROVED") ? (
                                                                        <div className="mt-2 grid gap-1 sm:max-w-xs">
                                                                            <Label htmlFor={`decided-by-${r.id}`}>
                                                                                Who is deciding
                                                                            </Label>
                                                                            <Input
                                                                                id={`decided-by-${r.id}`}
                                                                                value={decidedBy}
                                                                                onChange={(event) => setDecidedBy(event.target.value)}
                                                                                placeholder="owner"
                                                                            />
                                                                            <p className="text-xs text-muted-foreground">
                                                                                A decision must be attributable, so
                                                                                approving or rejecting without a name is
                                                                                refused.
                                                                            </p>
                                                                        </div>
                                                                    ) : null}
                                                                    {r.state === "RECEIVED" ? (
                                                                        <ul className="mt-2 space-y-1">
                                                                            {r.items.map((item) => (
                                                                                <li key={item.id} className="text-xs">
                                                                                    {item.qty} unit
                                                                                    {item.qty === 1 ? "" : "s"} ·{" "}
                                                                                    {titleCase(item.restockState)}
                                                                                    {item.restockMovementId
                                                                                        ? " · stock credited"
                                                                                        : ""}
                                                                                    {item.allowedRestockTransitions.length > 0 ? (
                                                                                        <span className="ml-2 inline-flex gap-1">
                                                                                            {item.allowedRestockTransitions.map((next) => (
                                                                                                <Button
                                                                                                    key={next}
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    disabled={
                                                                                                        busy === `ri:${item.id}` ||
                                                                                                        (next === "RESTOCKED" && !locationId)
                                                                                                    }
                                                                                                    onClick={() =>
                                                                                                        mutate(
                                                                                                            `ri:${item.id}`,
                                                                                                            `/api/platform/returns/${encodeURIComponent(r.id)}/items/${encodeURIComponent(item.id)}`,
                                                                                                            "PATCH",
                                                                                                            {
                                                                                                                restockState: next,
                                                                                                                ...(next === "RESTOCKED"
                                                                                                                    ? { locationId }
                                                                                                                    : {}),
                                                                                                            },
                                                                                                        )
                                                                                                    }
                                                                                                >
                                                                                                    {titleCase(next)}
                                                                                                </Button>
                                                                                            ))}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="ml-2 text-muted-foreground">
                                                                                            settled, cannot change
                                                                                        </span>
                                                                                    )}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    ) : null}
                                                                    {r.state === "RECEIVED" && !locationId ? (
                                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                                            Restocking needs a location, so that
                                                                            &quot;back in stock&quot; has an answer to
                                                                            &quot;where&quot;. Select one above.
                                                                        </p>
                                                                    ) : null}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`return-ref-${order.id}`}>
                                                                New return reference
                                                            </Label>
                                                            <Input
                                                                id={`return-ref-${order.id}`}
                                                                value={returnRef}
                                                                onChange={(event) => setReturnRef(event.target.value)}
                                                                placeholder="RET-001"
                                                            />
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            disabled={busy === `newr:${order.id}` || !returnRef.trim()}
                                                            onClick={async () => {
                                                                const ok = await mutate(
                                                                    `newr:${order.id}`,
                                                                    "/api/platform/returns",
                                                                    "POST",
                                                                    { orderId: order.id, reference: returnRef },
                                                                )
                                                                if (ok) setReturnRef("")
                                                            }}
                                                        >
                                                            Open return
                                                        </Button>
                                                    </div>
                                                    <Nothing label="A return can only be opened when something on the order has actually shipped and is not already claimed." />
                                                </Section>
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}

                {orders && orders.length > 25 ? (
                    <p className="text-xs text-muted-foreground">Showing the 25 most recent orders of {orders.length}.</p>
                ) : null}
            </CardContent>
        </Card>
    )
}
