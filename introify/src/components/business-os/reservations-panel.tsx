"use client"

import { CalendarClock } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing reservations panel.
 *
 * Reads and writes only persisted data through /api/platform/reservations. There is
 * no sample or placeholder reservation anywhere in this component: an empty venue
 * renders the empty state, never a fabricated booking.
 *
 * The fetch and error-mapping helpers are intentionally local rather than imported
 * from business-os-shell.tsx, which keeps its internals private. They mirror the
 * same envelope contract, and the route harness asserts that contract, so the two
 * cannot drift silently.
 */

type ReservationView = Readonly<{
    id: string
    tableId: string
    tableLabel: string | null
    partySize: number
    startAt: string
    endAt: string
    status: string
    guestName: string
    guestPhone: string | null
    note: string | null
    allowedTransitions: readonly string[]
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

class ReservationRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "ReservationRequestError"
    }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new ReservationRequestError(
            response.status,
            "INVALID_RESPONSE",
            "The server returned an unreadable response.",
        )
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok
            ? { code: "REQUEST_FAILED", message: "The request failed." }
            : envelope.error
        throw new ReservationRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

/**
 * Distinguishes the states an owner can actually act on. A capacity or overlap
 * refusal is surfaced verbatim because it tells the owner what to change; an
 * infrastructure failure is not, because it would only leak internals.
 */
function errorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof ReservationRequestError) {
        if (error.status === 401) {
            return { title: "Sign in required", description: error.message }
        }
        if (error.status === 403) {
            return { title: "Venue access required", description: error.message }
        }
        if (error.status === 409) {
            return { title: "That booking conflicts", description: error.message }
        }
        if (error.status === 400) {
            return { title: "Check the booking details", description: error.message }
        }
        if (error.status === 503) {
            return {
                title: "Reservations are unavailable",
                description: "Reservation storage is not responding. Nothing was changed.",
            }
        }
        return { title: "Reservations could not load", description: error.message }
    }
    return {
        title: "Reservations could not load",
        description: "An unexpected problem occurred. Nothing was changed.",
    }
}

function statusVariant(status: string) {
    if (status === "COMPLETED" || status === "CONFIRMED" || status === "SEATED") return "default" as const
    if (status === "CANCELLED" || status === "NO_SHOW") return "destructive" as const
    return "secondary" as const
}

function formatWhen(startAt: string, endAt: string): string {
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "unknown time"
    return `${start.toLocaleString()} – ${end.toLocaleTimeString()}`
}

export function ReservationsPanel({ workspaceId }: { workspaceId: string }) {
    const [reservations, setReservations] = useState<readonly ReservationView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busyId, setBusyId] = useState("")
    const [revision, setRevision] = useState(0)

    useEffect(() => {
        if (!workspaceId) {
            setReservations(null)
            return
        }
        const controller = new AbortController()
        setReservations(null)
        setError(null)
        request<{ reservations: readonly ReservationView[] }>(
            `/api/platform/reservations?workspaceId=${encodeURIComponent(workspaceId)}`,
            { signal: controller.signal },
        )
            .then((data) => setReservations(data.reservations))
            .catch((cause) => {
                if (cause instanceof DOMException && cause.name === "AbortError") return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    const transition = useCallback(
        async (reservationId: string, status: string) => {
            setBusyId(reservationId)
            setActionError(null)
            try {
                await request(`/api/platform/reservations/${encodeURIComponent(reservationId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, status }),
                })
                setRevision((value) => value + 1)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusyId("")
            }
        },
        [workspaceId],
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
                    <h3>Table reservations</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Persisted bookings against real tables. Capacity and double-booking are refused at the
                    write boundary, and every status change is recorded in an append-only ledger.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<CalendarClock aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its reservations."
                    />
                ) : null}

                {workspaceId && reservations === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading reservations</span>
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

                {reservations?.length === 0 ? (
                    <EmptyState
                        icon={<CalendarClock aria-hidden="true" />}
                        title="No reservations yet"
                        description="Bookings appear here once they are created against a table that has a seat count configured. No sample reservations are shown."
                    />
                ) : null}

                {reservations && reservations.length > 0 ? (
                    <ul className="space-y-2">
                        {reservations.map((reservation) => (
                            <li key={reservation.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {reservation.guestName} · party of {reservation.partySize}
                                    </span>
                                    <Badge variant={statusVariant(reservation.status)}>{reservation.status}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {reservation.tableLabel ?? reservation.tableId} ·{" "}
                                    {formatWhen(reservation.startAt, reservation.endAt)}
                                </p>
                                {reservation.note ? (
                                    <p className="mt-1 text-xs text-muted-foreground">{reservation.note}</p>
                                ) : null}
                                {reservation.allowedTransitions.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {reservation.allowedTransitions.map((next) => (
                                            <Button
                                                key={next}
                                                size="sm"
                                                variant="outline"
                                                disabled={busyId === reservation.id}
                                                onClick={() => transition(reservation.id, next)}
                                            >
                                                {next === "NO_SHOW" ? "Mark no-show" : next.charAt(0) + next.slice(1).toLowerCase()}
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        This reservation is {reservation.status.toLowerCase()} and cannot change.
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </CardContent>
        </Card>
    )
}
