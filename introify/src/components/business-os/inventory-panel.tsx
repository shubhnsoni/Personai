"use client"

import { Boxes } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing stock panel.
 *
 * Every number shown is a persisted balance read from /api/platform/inventory. Available
 * is the server's derived figure, not recomputed here, so the screen cannot disagree with
 * the record. There is no sample stock: an empty catalogue renders the empty state.
 *
 * The refusal that matters most is an oversell, and it is shown verbatim because it names
 * the real available quantity. A dependency failure is not shown, because its message
 * would only leak internals.
 */

type ItemView = Readonly<{
    id: string
    productId: string
    locationId: string
    onHand: number
    reserved: number
    available: number
    reorderPoint: number | null
    safetyStock: number
    trackingEnabled: boolean
    belowReorderPoint: boolean
}>

type MovementView = Readonly<{
    id: string
    seq: string
    kind: string
    qtyDelta: number
    reservedDelta: number
    onHandAfter: number
    reservedAfter: number
    reason: string | null
    actor: string
    at: string
}>

type ReservationView = Readonly<{
    id: string
    qty: number
    state: string
    orderLineId: string
    expiresAt: string | null
    allowedTransitions: readonly string[]
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

class InventoryRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "InventoryRequestError"
    }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new InventoryRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new InventoryRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

/**
 * A 409 here is usually an oversell or a count that would strand promised stock, and its
 * message contains the actual numbers, so it is surfaced as written. A 403 is deliberately
 * the same copy for a foreign record and a missing one, so the UI does not enumerate.
 */
function errorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof InventoryRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) {
            return {
                title: "Stock access required",
                description: "This workspace does not grant you access to that stock record.",
            }
        }
        if (error.status === 400) return { title: "Check the details", description: error.message }
        if (error.status === 409) return { title: "That stock change is not allowed", description: error.message }
        if (error.status === 503) {
            return { title: "Stock is unavailable", description: "Inventory storage is not responding. Nothing was changed." }
        }
        return { title: "Stock could not load", description: error.message }
    }
    return { title: "Stock could not load", description: "An unexpected problem occurred. Nothing was changed." }
}

function titleCase(value: string): string {
    return value
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" ")
}

function formatWhen(value: string | null): string {
    if (!value) return "—"
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString()
}

export function InventoryPanel({ workspaceId }: { workspaceId: string }) {
    const [items, setItems] = useState<readonly ItemView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState("")
    const [openId, setOpenId] = useState("")
    const [detail, setDetail] = useState<{ movements: readonly MovementView[]; reservations: readonly ReservationView[] } | null>(null)
    const [revision, setRevision] = useState(0)

    const reload = useCallback(() => setRevision((value) => value + 1), [])

    useEffect(() => {
        if (!workspaceId) {
            setItems(null)
            return
        }
        const controller = new AbortController()
        setItems(null)
        setError(null)
        request<{ items: readonly ItemView[] }>(
            `/api/platform/inventory?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setItems(data.items))
            .catch((cause) => {
                if (cause instanceof DOMException && cause.name === "AbortError") return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    useEffect(() => {
        if (!openId) {
            setDetail(null)
            return
        }
        const controller = new AbortController()
        const options = { signal: controller.signal }
        const query = `workspaceId=${encodeURIComponent(workspaceId)}`
        setDetail(null)
        Promise.all([
            request<{ movements: readonly MovementView[] }>(`/api/platform/inventory/${encodeURIComponent(openId)}/movements?${query}`, options),
            request<{ reservations: readonly ReservationView[] }>(`/api/platform/inventory/${encodeURIComponent(openId)}/reservations?${query}`, options),
        ])
            .then(([m, r]) => setDetail({ movements: m.movements, reservations: r.reservations }))
            .catch((cause) => {
                if (cause instanceof DOMException && cause.name === "AbortError") return
                setActionError(cause)
            })
        return () => controller.abort()
    }, [openId, workspaceId, revision])

    const mutate = useCallback(
        async (key: string, url: string, method: string, payload: Record<string, unknown>) => {
            setBusy(key)
            setActionError(null)
            try {
                await request(url, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, ...payload }),
                })
                reload()
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy("")
            }
        },
        [reload, workspaceId],
    )

    if (error) {
        const copy = errorCopy(error)
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
                    <h3>Stock on hand</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Real balances per product per location, with an append-only movement ledger. Available is on hand
                    minus units already promised to orders, so a reservation reduces what you can sell without moving
                    anything off the shelf.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<Boxes aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its stock."
                    />
                ) : null}

                {workspaceId && items === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading stock records</span>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState
                        title={errorCopy(actionError).title}
                        description={errorCopy(actionError).description}
                    />
                ) : null}

                {items?.length === 0 ? (
                    <EmptyState
                        icon={<Boxes aria-hidden="true" />}
                        title="No stock records yet"
                        description="A stock record is opened per product per location. None exist, and no sample stock is shown."
                    />
                ) : null}

                {items && items.length > 0 ? (
                    <ul className="space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                        {items.map((item) => (
                            <li key={item.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {item.available} available
                                    </span>
                                    {item.belowReorderPoint ? (
                                        <Badge variant="destructive">At or below reorder point</Badge>
                                    ) : (
                                        <Badge variant="secondary">In stock</Badge>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {item.onHand} on hand · {item.reserved} promised to orders
                                    {item.reorderPoint === null ? " · no reorder point set" : ` · reorder at ${item.reorderPoint}`}
                                    {item.trackingEnabled ? "" : " · units are not tracked, so nothing can be reserved"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Product {item.productId} · location {item.locationId}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy === `recv:${item.id}`}
                                        onClick={() =>
                                            mutate(`recv:${item.id}`, `/api/platform/inventory/${encodeURIComponent(item.id)}/movements`, "POST", {
                                                kind: "RECEIPT",
                                                qty: 1,
                                                reason: "Received one unit",
                                            })
                                        }
                                    >
                                        Receive 1
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy === `adj:${item.id}` || item.available === 0}
                                        onClick={() =>
                                            mutate(`adj:${item.id}`, `/api/platform/inventory/${encodeURIComponent(item.id)}/movements`, "POST", {
                                                kind: "ADJUSTMENT",
                                                qty: -1,
                                                reason: "Written off",
                                            })
                                        }
                                    >
                                        Write off 1
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-expanded={openId === item.id}
                                        onClick={() => setOpenId(openId === item.id ? "" : item.id)}
                                    >
                                        {openId === item.id ? "Hide ledger" : "Show ledger"}
                                    </Button>
                                </div>
                                {item.reserved > 0 ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {item.reserved} of these units are already promised, so a write-off below that
                                        figure will be refused.
                                    </p>
                                ) : null}

                                {openId === item.id ? (
                                    <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
                                        {detail === null ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading stock ledger</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : (
                                            <>
                                                <section className="space-y-1">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Holds
                                                    </h5>
                                                    {detail.reservations.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            No units are held for orders.
                                                        </p>
                                                    ) : (
                                                        <ul className="space-y-1">
                                                            {detail.reservations.map((reservation) => (
                                                                <li key={reservation.id} className="text-xs">
                                                                    <span className="font-medium">
                                                                        {reservation.qty} units
                                                                    </span>{" "}
                                                                    · {titleCase(reservation.state)} · line{" "}
                                                                    {reservation.orderLineId} · expires{" "}
                                                                    {formatWhen(reservation.expiresAt)}
                                                                    {reservation.allowedTransitions.length > 0 ? (
                                                                        <span className="ml-2 inline-flex gap-1">
                                                                            {reservation.allowedTransitions.map((next) => (
                                                                                <Button
                                                                                    key={next}
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    disabled={busy === `rv:${reservation.id}`}
                                                                                    onClick={() =>
                                                                                        mutate(
                                                                                            `rv:${reservation.id}`,
                                                                                            `/api/platform/inventory/${encodeURIComponent(item.id)}/reservations/${encodeURIComponent(reservation.id)}`,
                                                                                            "PATCH",
                                                                                            { state: next },
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
                                                    )}
                                                </section>

                                                <section className="space-y-1">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Movement ledger
                                                    </h5>
                                                    {detail.movements.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            No movements recorded.
                                                        </p>
                                                    ) : (
                                                        <ol className="space-y-1 text-xs text-muted-foreground">
                                                            {detail.movements.map((movement) => (
                                                                <li key={movement.id}>
                                                                    <span className="font-mono">#{movement.seq}</span>{" "}
                                                                    {titleCase(movement.kind)} · on hand{" "}
                                                                    {movement.qtyDelta >= 0 ? "+" : ""}
                                                                    {movement.qtyDelta} to {movement.onHandAfter} ·
                                                                    promised{" "}
                                                                    {movement.reservedDelta >= 0 ? "+" : ""}
                                                                    {movement.reservedDelta} to{" "}
                                                                    {movement.reservedAfter} · {movement.actor} ·{" "}
                                                                    {formatWhen(movement.at)}
                                                                    {movement.reason ? ` · ${movement.reason}` : ""}
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        This ledger is append-only. Every balance above is the figure
                                                        recorded at the time, not a recalculation.
                                                    </p>
                                                </section>
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </CardContent>
        </Card>
    )
}
