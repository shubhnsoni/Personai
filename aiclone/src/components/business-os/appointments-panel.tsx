"use client"

import { CalendarCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner-facing appointments panel for the shared appointments engine.
 *
 * One panel serves coaching, consulting, CA practice, salon, events, real estate and pet
 * care, because they all run on the same engine. There is no industry-specific variant.
 *
 * Reads and writes only persisted data through /api/platform/appointments. No sample or
 * placeholder appointment exists anywhere in this component: an empty practice renders the
 * empty state.
 *
 * Deposit and reminder states are shown as they actually are. A deposit sits at REQUIRED
 * and a reminder at SCHEDULED until a payment or messaging provider is deliberately wired
 * up, and the copy says so rather than implying money moved or a message was sent.
 */

type AppointmentView = Readonly<{
    id: string
    serviceName: string | null
    resourceName: string | null
    visitorName: string
    partySize: number
    startTime: string
    endTime: string
    status: string
    cancelReason: string | null
    allowedTransitions: readonly string[]
}>

type DepositView = Readonly<{ bookingId: string; state: string; amountCents: number; currency: string }>
type ReminderView = Readonly<{ id: string; bookingId: string; channel: string; sendAt: string; state: string }>
type WaitlistView = Readonly<{
    id: string
    guestName: string
    partySize: number
    requestedStart: string
    requestedEnd: string
    status: string
}>

type ApiEnvelope<T> =
    | Readonly<{ ok: true; data: T }>
    | Readonly<{ ok: false; error: { code: string; message: string } }>

class AppointmentRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = "AppointmentRequestError"
    }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, { cache: "no-store", ...init })
    let envelope: ApiEnvelope<T>
    try {
        envelope = (await response.json()) as ApiEnvelope<T>
    } catch {
        throw new AppointmentRequestError(response.status, "INVALID_RESPONSE", "The server returned an unreadable response.")
    }
    if (!response.ok || !envelope.ok) {
        const error = envelope.ok ? { code: "REQUEST_FAILED", message: "The request failed." } : envelope.error
        throw new AppointmentRequestError(response.status, error.code, error.message)
    }
    return envelope.data
}

/**
 * A capacity or conflict refusal is surfaced verbatim because it tells the owner what to
 * change. An infrastructure failure is not, because it would only leak internals.
 */
function errorCopy(error: unknown): { title: string; description: string } {
    if (error instanceof AppointmentRequestError) {
        if (error.status === 401) return { title: "Sign in required", description: error.message }
        if (error.status === 403) return { title: "Practice access required", description: error.message }
        if (error.status === 409) return { title: "That appointment conflicts", description: error.message }
        if (error.status === 400) return { title: "Check the appointment details", description: error.message }
        if (error.status === 503) {
            return {
                title: "Appointments are unavailable",
                description: "Appointment storage is not responding. Nothing was changed.",
            }
        }
        return { title: "Appointments could not load", description: error.message }
    }
    return { title: "Appointments could not load", description: "An unexpected problem occurred. Nothing was changed." }
}

function statusVariant(status: string) {
    if (["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(status)) return "default" as const
    if (["CANCELLED", "NO_SHOW", "EXPIRED"].includes(status)) return "destructive" as const
    return "secondary" as const
}

function humanise(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ")
}

function formatWhen(start: string, end: string): string {
    const s = new Date(start)
    const e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "unknown time"
    return `${s.toLocaleString()} – ${e.toLocaleTimeString()}`
}

/** Honest, non-implying copy for a deposit state. */
function depositCopy(state: string): string {
    if (state === "REQUIRED") return "Deposit pending — no payment has been taken"
    if (state === "AUTHORIZED") return "Deposit authorised"
    if (state === "CAPTURED") return "Deposit received"
    if (state === "REFUNDED") return "Deposit refunded"
    if (state === "FORFEITED") return "Deposit forfeited"
    if (state === "FAILED") return "Deposit failed"
    return "No deposit"
}

function reminderCopy(state: string): string {
    if (state === "SCHEDULED") return "Reminder queued — not yet sent"
    if (state === "SENT") return "Reminder sent"
    if (state === "FAILED") return "Reminder failed"
    if (state === "SUPPRESSED") return "Reminder suppressed"
    if (state === "CANCELLED") return "Reminder cancelled"
    return state
}

export function AppointmentsPanel({ workspaceId }: { workspaceId: string }) {
    const [appointments, setAppointments] = useState<readonly AppointmentView[] | null>(null)
    const [waitlist, setWaitlist] = useState<readonly WaitlistView[] | null>(null)
    const [deposits, setDeposits] = useState<Record<string, DepositView>>({})
    const [reminders, setReminders] = useState<Record<string, readonly ReminderView[]>>({})
    const [error, setError] = useState<unknown>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busyId, setBusyId] = useState("")
    const [revision, setRevision] = useState(0)

    useEffect(() => {
        if (!workspaceId) {
            setAppointments(null)
            setWaitlist(null)
            return
        }
        const controller = new AbortController()
        setAppointments(null)
        setWaitlist(null)
        setError(null)
        const scope = `workspaceId=${encodeURIComponent(workspaceId)}`
        Promise.all([
            request<{ appointments: readonly AppointmentView[] }>(`/api/platform/appointments?${scope}`, { signal: controller.signal }),
            request<{ entries: readonly WaitlistView[] }>(`/api/platform/appointments/waitlist?${scope}`, { signal: controller.signal }),
        ])
            .then(([a, w]) => {
                setAppointments(a.appointments)
                setWaitlist(w.entries)
            })
            .catch((cause) => {
                if (cause instanceof DOMException && cause.name === "AbortError") return
                setError(cause)
            })
        return () => controller.abort()
    }, [workspaceId, revision])

    const transition = useCallback(
        async (id: string, status: string) => {
            setBusyId(id)
            setActionError(null)
            try {
                await request(`/api/platform/appointments/${encodeURIComponent(id)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, status }),
                })
                setRevision((v) => v + 1)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusyId("")
            }
        },
        [workspaceId],
    )

    const loadDetail = useCallback(
        async (id: string) => {
            setBusyId(id)
            setActionError(null)
            try {
                const scope = `workspaceId=${encodeURIComponent(workspaceId)}`
                const [r, d] = await Promise.all([
                    request<{ reminders: readonly ReminderView[] }>(
                        `/api/platform/appointments/${encodeURIComponent(id)}/reminders?${scope}`,
                    ),
                    request<{ deposit: DepositView | null }>(
                        `/api/platform/appointments/${encodeURIComponent(id)}/deposit?${scope}`,
                    ),
                ])
                setReminders((prev) => ({ ...prev, [id]: r.reminders }))
                if (d.deposit) {
                    const found = d.deposit
                    setDeposits((prev) => ({ ...prev, [id]: found }))
                }
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusyId("")
            }
        },
        [workspaceId],
    )

    const promote = useCallback(
        async (entryId: string) => {
            setBusyId(entryId)
            setActionError(null)
            try {
                await request(`/api/platform/appointments/waitlist/${encodeURIComponent(entryId)}/promote`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId }),
                })
                setRevision((v) => v + 1)
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
                    <h3>Appointments</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    One shared engine for sessions, consultations, visits and viewings. Availability, capacity
                    and double-booking are enforced at the write boundary, and every status change is recorded
                    in an append-only ledger.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {!workspaceId ? (
                    <EmptyState
                        icon={<CalendarCheck aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its appointments."
                    />
                ) : null}

                {workspaceId && appointments === null ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading appointments</span>
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : null}

                {actionError ? (
                    <ErrorState title={errorCopy(actionError).title} description={errorCopy(actionError).description} />
                ) : null}

                {appointments?.length === 0 ? (
                    <EmptyState
                        icon={<CalendarCheck aria-hidden="true" />}
                        title="No appointments yet"
                        description="Appointments appear here once they are booked against a resource that has a capacity configured. No sample appointments are shown."
                    />
                ) : null}

                {appointments && appointments.length > 0 ? (
                    <ul className="space-y-2">
                        {appointments.map((appointment) => (
                            <li key={appointment.id} className="rounded-xl border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {appointment.visitorName}
                                        {appointment.partySize > 1 ? ` · party of ${appointment.partySize}` : ""}
                                    </span>
                                    <Badge variant={statusVariant(appointment.status)}>{humanise(appointment.status)}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {appointment.serviceName ?? "Service"} ·{" "}
                                    {appointment.resourceName ?? "Unassigned"} ·{" "}
                                    {formatWhen(appointment.startTime, appointment.endTime)}
                                </p>
                                {appointment.cancelReason ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Reason: {appointment.cancelReason}
                                    </p>
                                ) : null}
                                {deposits[appointment.id] ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {depositCopy(deposits[appointment.id].state)}
                                    </p>
                                ) : null}
                                {reminders[appointment.id]?.length ? (
                                    <ul className="mt-1 space-y-0.5">
                                        {reminders[appointment.id].map((reminder) => (
                                            <li key={reminder.id} className="text-xs text-muted-foreground">
                                                {reminder.channel}: {reminderCopy(reminder.state)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {appointment.allowedTransitions.map((next) => (
                                        <Button
                                            key={next}
                                            size="sm"
                                            variant="outline"
                                            disabled={busyId === appointment.id}
                                            onClick={() => transition(appointment.id, next)}
                                        >
                                            {next === "NO_SHOW" ? "Mark no-show" : humanise(next)}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={busyId === appointment.id}
                                        onClick={() => loadDetail(appointment.id)}
                                    >
                                        Reminders
                                    </Button>
                                </div>
                                {appointment.allowedTransitions.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        This appointment is {humanise(appointment.status).toLowerCase()} and cannot change.
                                    </p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}

                {waitlist && waitlist.length > 0 ? (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Waitlist</h4>
                        <ul className="space-y-2">
                            {waitlist.map((entry) => (
                                <li key={entry.id} className="rounded-xl border border-dashed border-border/70 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium">{entry.guestName}</span>
                                        <Badge variant="secondary">{humanise(entry.status)}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Waitlisted for {formatWhen(entry.requestedStart, entry.requestedEnd)}
                                    </p>
                                    {entry.status === "WAITING" ? (
                                        <Button
                                            className="mt-2"
                                            size="sm"
                                            variant="outline"
                                            disabled={busyId === entry.id}
                                            onClick={() => promote(entry.id)}
                                        >
                                            Offer this slot
                                        </Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
