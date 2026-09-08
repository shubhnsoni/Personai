"use client"

import { Handshake } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    allowance,
    caseErrorCopy,
    caseRequest,
    formatWhen,
    isAbort,
    money,
    titleCase,
    type RetainerBalanceView,
    type RetainerCaseView,
    type RetainerDrawView,
    type RetainerEventView,
    type RetainerPeriodView,
    type RetainerView,
} from "./cases-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner surface for retainers.
 *
 * The honesty requirements this panel has to carry, because a retainer looks like a payment and
 * is not one:
 *
 *   - billing state records where an invoice got to. It never charges anybody, and the copy says
 *     so where an owner will actually read it;
 *   - overage is shown, not hidden. A period that has been overdrawn says by how much, because an
 *     owner who cannot see overage cannot bill for it;
 *   - the allowance and every balance come from the server. This component performs no
 *     arithmetic on them at all - not even a subtraction - because the ledger is the only place
 *     those numbers are allowed to be worked out;
 *   - every action button is rendered from server-computed allowedTransitions, so the UI cannot
 *     offer a move the engine would refuse.
 */

type Bundle = Readonly<{
    periods: readonly RetainerPeriodView[]
    cases: readonly RetainerCaseView[]
    draws: readonly RetainerDrawView[]
    balance: RetainerBalanceView
}>

const BASIS_HELP: Record<string, string> = {
    UNITS: "denominated in units of work",
    VALUE: "denominated in money",
}

function Nothing({ label }: { label: string }) {
    return <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">{label}</p>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mt-3">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
            <div className="mt-1 space-y-1">{children}</div>
        </div>
    )
}

export function RetainersPanel({ workspaceId }: { workspaceId: string }) {
    const [retainers, setRetainers] = useState<readonly RetainerView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [events, setEvents] = useState<readonly RetainerEventView[] | null>(null)
    const [showEvents, setShowEvents] = useState(false)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState(false)

    const [reference, setReference] = useState("")
    const [title, setTitle] = useState("")
    const [basis, setBasis] = useState("UNITS")
    const [included, setIncluded] = useState("")

    const [drawUnits, setDrawUnits] = useState("")
    const [drawNote, setDrawNote] = useState("")
    const [drawCaseId, setDrawCaseId] = useState("")

    const loadRetainers = useCallback(
        async (signal?: AbortSignal) => {
            if (!workspaceId) {
                setRetainers(null)
                return
            }
            try {
                setError(null)
                const data = await caseRequest<{ retainers: readonly RetainerView[] }>(
                    `/api/platform/retainers?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal },
                )
                setRetainers(data.retainers)
            } catch (cause) {
                if (isAbort(cause)) return
                setRetainers(null)
                setError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        const controller = new AbortController()
        void loadRetainers(controller.signal)
        return () => controller.abort()
    }, [loadRetainers])

    const loadBundle = useCallback(
        async (retainerId: string, signal?: AbortSignal) => {
            const query = `workspaceId=${encodeURIComponent(workspaceId)}`
            const base = `/api/platform/retainers/${encodeURIComponent(retainerId)}`
            const opts = { signal }
            try {
                setActionError(null)
                const [p, c, d, b] = await Promise.all([
                    caseRequest<{ periods: readonly RetainerPeriodView[] }>(`${base}/periods?${query}`, opts),
                    caseRequest<{ cases: readonly RetainerCaseView[] }>(`${base}/cases?${query}`, opts),
                    caseRequest<{ draws: readonly RetainerDrawView[] }>(`${base}/draws?${query}`, opts),
                    caseRequest<{ balance: RetainerBalanceView }>(`${base}/balance?${query}`, opts),
                ])
                setBundle({ periods: p.periods, cases: c.cases, draws: d.draws, balance: b.balance })
            } catch (cause) {
                if (isAbort(cause)) return
                setBundle(null)
                setActionError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        if (!openId) {
            setBundle(null)
            setEvents(null)
            setShowEvents(false)
            return
        }
        const controller = new AbortController()
        void loadBundle(openId, controller.signal)
        return () => controller.abort()
    }, [openId, loadBundle])

    const act = useCallback(
        async (run: () => Promise<unknown>) => {
            setBusy(true)
            setActionError(null)
            try {
                await run()
                await loadRetainers()
                if (openId) await loadBundle(openId)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy(false)
            }
        },
        [loadRetainers, loadBundle, openId],
    )

    if (!workspaceId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h3>Retainers</h3>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EmptyState
                        icon={<Handshake aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its retainer agreements."
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Retainers</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    An agreement plus a draw-down ledger. Billing state records where an invoice got to; nothing here
                    charges anybody. Overage is shown rather than blocked, because work that was done should be
                    billable.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? (
                    <ErrorState title={caseErrorCopy(error).title} description={caseErrorCopy(error).description} />
                ) : null}
                {actionError ? (
                    <ErrorState
                        title={caseErrorCopy(actionError).title}
                        description={caseErrorCopy(actionError).description}
                    />
                ) : null}

                {retainers === null && !error ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading retainers</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {retainers !== null && retainers.length === 0 ? (
                    <EmptyState
                        icon={<Handshake aria-hidden="true" />}
                        title="No retainers yet"
                        description="Retainers are agreements with a client. None exist in this workspace, and no sample retainers are shown."
                    />
                ) : null}

                {retainers !== null && retainers.length > 0 ? (
                    <ul className="space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                        {retainers.map((retainer) => (
                            <li key={retainer.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {retainer.reference} · {retainer.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {allowance(
                                                retainer.basis,
                                                retainer.includedUnits ?? 0,
                                                retainer.includedValueCents ?? 0,
                                                retainer.currency,
                                            )}{" "}
                                            per {retainer.periodLengthDays ?? "?"} days ·{" "}
                                            {BASIS_HELP[retainer.basis] ?? retainer.basis}
                                            {retainer.rolloverAllowed ? " · unused allowance rolls over" : " · no rollover"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={retainer.state === "ACTIVE" ? "default" : "secondary"}>
                                            {titleCase(retainer.state)}
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            aria-expanded={openId === retainer.id}
                                            onClick={() => setOpenId(openId === retainer.id ? null : retainer.id)}
                                        >
                                            {openId === retainer.id ? "Hide" : "Open"}
                                        </Button>
                                    </div>
                                </div>

                                {retainer.autoRenew ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Marked auto-renew. That records intent only — nothing renews this agreement on a
                                        timer, and a lapsed period stays lapsed until somebody renews it.
                                    </p>
                                ) : null}

                                <div className="mt-2 flex flex-wrap gap-2">
                                    {retainer.allowedTransitions.map((next) => (
                                        <Button
                                            key={next}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() =>
                                                void act(() =>
                                                    caseRequest(`/api/platform/retainers/${encodeURIComponent(retainer.id)}`, {
                                                        method: "PATCH",
                                                        headers: { "content-type": "application/json" },
                                                        body: JSON.stringify({
                                                            workspaceId,
                                                            state: next,
                                                            ...(next === "CANCELLED" ? { reason: "Ended by owner" } : {}),
                                                        }),
                                                    }),
                                                )
                                            }
                                        >
                                            {titleCase(next)}
                                        </Button>
                                    ))}
                                    {retainer.allowedTransitions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            This retainer is {retainer.state.toLowerCase()} and cannot change.
                                        </p>
                                    ) : null}
                                </div>
                                {retainer.cancelReason ? (
                                    <p className="mt-1 text-xs text-muted-foreground">Cancelled: {retainer.cancelReason}</p>
                                ) : null}

                                {openId === retainer.id ? (
                                    <div className="mt-3 border-t border-border/70 pt-3">
                                        {bundle === null && !actionError ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading periods, cases and draws</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : null}

                                        {bundle ? (
                                            <>
                                                <Section title="Balance">
                                                    <p className="text-xs text-muted-foreground">
                                                        Across {bundle.balance.periodCount} period
                                                        {bundle.balance.periodCount === 1 ? "" : "s"}:{" "}
                                                        {allowance(
                                                            bundle.balance.basis,
                                                            bundle.balance.lifetimeUsed,
                                                            bundle.balance.lifetimeUsed,
                                                            bundle.balance.currency,
                                                        )}{" "}
                                                        used of{" "}
                                                        {allowance(
                                                            bundle.balance.basis,
                                                            bundle.balance.lifetimeIncluded,
                                                            bundle.balance.lifetimeIncluded,
                                                            bundle.balance.currency,
                                                        )}{" "}
                                                        included. These figures are recomputed from the ledger on every
                                                        read, not stored.
                                                    </p>
                                                    {bundle.balance.lifetimeOverage > 0 ? (
                                                        <p className="text-xs font-medium">
                                                            Overage to date:{" "}
                                                            {allowance(
                                                                bundle.balance.basis,
                                                                bundle.balance.lifetimeOverage,
                                                                bundle.balance.lifetimeOverage,
                                                                bundle.balance.currency,
                                                            )}
                                                            . Overage is recorded rather than refused, so it can be billed.
                                                        </p>
                                                    ) : null}
                                                    {bundle.balance.openPeriod === null ? (
                                                        <Nothing label="No period is open, so nothing can be drawn right now." />
                                                    ) : null}
                                                </Section>

                                                <Section title="Periods">
                                                    {bundle.periods.length === 0 ? (
                                                        <Nothing label="No periods opened yet. A retainer must be active before a period can open." />
                                                    ) : (
                                                        bundle.periods.map((period) => (
                                                            <div key={period.id} className="rounded-md border border-border/70 p-2">
                                                                <p className="text-xs">
                                                                    Period {period.ordinal} · {formatWhen(period.startsOn)} to{" "}
                                                                    {formatWhen(period.endsOn)} · {titleCase(period.state)}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {allowance(
                                                                        period.basis,
                                                                        period.usedUnits,
                                                                        period.usedValueCents,
                                                                        retainer.currency,
                                                                    )}{" "}
                                                                    used ·{" "}
                                                                    {allowance(
                                                                        period.basis,
                                                                        period.remaining,
                                                                        period.remaining,
                                                                        retainer.currency,
                                                                    )}{" "}
                                                                    remaining
                                                                    {period.overage > 0
                                                                        ? ` · ${allowance(period.basis, period.overage, period.overage, retainer.currency)} over the allowance`
                                                                        : ""}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Billing: {titleCase(period.billingState)}
                                                                    {period.invoiceId ? ` · invoice ${period.invoiceId}` : " · no invoice recorded"}.
                                                                    Billing state is a record, not a charge — no payment is
                                                                    taken here.
                                                                </p>
                                                                <div className="mt-1 flex flex-wrap gap-2">
                                                                    {period.allowedTransitions.map((next) => (
                                                                        <Button
                                                                            key={next}
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void act(() =>
                                                                                    caseRequest(
                                                                                        `/api/platform/retainers/${encodeURIComponent(retainer.id)}/periods/${encodeURIComponent(period.id)}`,
                                                                                        {
                                                                                            method: "PATCH",
                                                                                            headers: { "content-type": "application/json" },
                                                                                            body: JSON.stringify({ workspaceId, state: next }),
                                                                                        },
                                                                                    ),
                                                                                )
                                                                            }
                                                                        >
                                                                            {titleCase(next)}
                                                                        </Button>
                                                                    ))}
                                                                    {period.allowedBillingTransitions.map((next) => (
                                                                        <Button
                                                                            key={`bill-${next}`}
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            disabled={busy}
                                                                            onClick={() =>
                                                                                void act(() =>
                                                                                    caseRequest(
                                                                                        `/api/platform/retainers/${encodeURIComponent(retainer.id)}/periods/${encodeURIComponent(period.id)}/billing`,
                                                                                        {
                                                                                            method: "PATCH",
                                                                                            headers: { "content-type": "application/json" },
                                                                                            body: JSON.stringify({ workspaceId, billingState: next }),
                                                                                        },
                                                                                    ),
                                                                                )
                                                                            }
                                                                        >
                                                                            Billing: {titleCase(next)}
                                                                        </Button>
                                                                    ))}
                                                                    {period.allowedTransitions.length === 0 ? (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            This period is {period.state.toLowerCase()} and cannot
                                                                            change.
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                    {retainer.state === "ACTIVE" && bundle.balance.openPeriod === null ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={busy}
                                                            onClick={() =>
                                                                void act(() =>
                                                                    caseRequest(
                                                                        `/api/platform/retainers/${encodeURIComponent(retainer.id)}/periods`,
                                                                        {
                                                                            method: "POST",
                                                                            headers: { "content-type": "application/json" },
                                                                            body: JSON.stringify({ workspaceId }),
                                                                        },
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            Open the next period
                                                        </Button>
                                                    ) : null}
                                                </Section>

                                                <Section title="Cases covered">
                                                    {bundle.cases.length === 0 ? (
                                                        <Nothing label="No cases linked yet. Only a linked case can draw against this retainer." />
                                                    ) : (
                                                        bundle.cases.map((c) => (
                                                            <p key={c.caseId} className="text-xs text-muted-foreground">
                                                                {c.reference} · {c.title} · {titleCase(c.status)} · linked{" "}
                                                                {formatWhen(c.linkedAt)}
                                                            </p>
                                                        ))
                                                    )}
                                                </Section>

                                                <Section title="Draw ledger">
                                                    {bundle.draws.length === 0 ? (
                                                        <Nothing label="Nothing drawn yet." />
                                                    ) : (
                                                        bundle.draws.map((draw) => (
                                                            <p key={draw.id} className="text-xs text-muted-foreground">
                                                                #{draw.seq} · {titleCase(draw.kind)} ·{" "}
                                                                {draw.unitsDelta !== null
                                                                    ? `${draw.unitsDelta} units`
                                                                    : money(draw.valueDeltaCents ?? 0, retainer.currency)}{" "}
                                                                · balance after{" "}
                                                                {draw.unitsDelta !== null
                                                                    ? `${draw.usedUnitsAfter} units`
                                                                    : money(draw.usedValueCentsAfter, retainer.currency)}{" "}
                                                                · {formatWhen(draw.at)}
                                                                {draw.note ? ` · ${draw.note}` : ""}
                                                            </p>
                                                        ))
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        The ledger is append-only. Each row stores the balance it produced,
                                                        so these figures are what was recorded at the time and not a
                                                        recalculation.
                                                    </p>
                                                </Section>

                                                {bundle.balance.openPeriod !== null && retainer.state === "ACTIVE" ? (
                                                    <Section title="Record a draw">
                                                        <div className="flex flex-wrap items-end gap-2">
                                                            <div>
                                                                <Label htmlFor={`draw-amount-${retainer.id}`} className="text-xs">
                                                                    {retainer.basis === "UNITS" ? "Units" : "Cents"}
                                                                </Label>
                                                                <Input
                                                                    id={`draw-amount-${retainer.id}`}
                                                                    value={drawUnits}
                                                                    onChange={(e) => setDrawUnits(e.target.value)}
                                                                    className="h-8 w-24"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor={`draw-case-${retainer.id}`} className="text-xs">
                                                                    Case id (optional)
                                                                </Label>
                                                                <Input
                                                                    id={`draw-case-${retainer.id}`}
                                                                    value={drawCaseId}
                                                                    onChange={(e) => setDrawCaseId(e.target.value)}
                                                                    className="h-8 w-48"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor={`draw-note-${retainer.id}`} className="text-xs">
                                                                    Note
                                                                </Label>
                                                                <Input
                                                                    id={`draw-note-${retainer.id}`}
                                                                    value={drawNote}
                                                                    onChange={(e) => setDrawNote(e.target.value)}
                                                                    className="h-8 w-48"
                                                                />
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                disabled={busy || !drawUnits.trim()}
                                                                onClick={() =>
                                                                    void act(async () => {
                                                                        const amount = Number(drawUnits.trim())
                                                                        await caseRequest(
                                                                            `/api/platform/retainers/${encodeURIComponent(retainer.id)}/draws`,
                                                                            {
                                                                                method: "POST",
                                                                                headers: { "content-type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    workspaceId,
                                                                                    kind: "DRAW",
                                                                                    ...(retainer.basis === "UNITS"
                                                                                        ? { units: amount }
                                                                                        : { valueCents: amount }),
                                                                                    ...(drawCaseId.trim() ? { caseId: drawCaseId.trim() } : {}),
                                                                                    ...(drawNote.trim() ? { note: drawNote.trim() } : {}),
                                                                                }),
                                                                            },
                                                                        )
                                                                        setDrawUnits("")
                                                                        setDrawNote("")
                                                                        setDrawCaseId("")
                                                                    })
                                                                }
                                                            >
                                                                Record draw
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            A draw naming a case must name one this retainer covers. A draw
                                                            past the allowance is accepted and shown as overage rather than
                                                            refused.
                                                        </p>
                                                    </Section>
                                                ) : null}

                                                <div className="mt-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-expanded={showEvents}
                                                        onClick={() => {
                                                            const next = !showEvents
                                                            setShowEvents(next)
                                                            if (next && events === null) {
                                                                void caseRequest<{ events: readonly RetainerEventView[] }>(
                                                                    `/api/platform/retainers/${encodeURIComponent(retainer.id)}/timeline?workspaceId=${encodeURIComponent(workspaceId)}`,
                                                                )
                                                                    .then((d) => setEvents(d.events))
                                                                    .catch((cause) => setActionError(cause))
                                                            }
                                                        }}
                                                    >
                                                        {showEvents ? "Hide history" : "Show history"}
                                                    </Button>
                                                    {showEvents ? (
                                                        events === null ? (
                                                            <div aria-live="polite" aria-busy="true">
                                                                <span className="sr-only">Loading retainer history</span>
                                                                <Skeleton className="h-6 w-full" />
                                                            </div>
                                                        ) : events.length === 0 ? (
                                                            <Nothing label="No history recorded." />
                                                        ) : (
                                                            <div className="mt-1 space-y-1">
                                                                {events.map((event) => (
                                                                    <p key={event.id} className="text-xs text-muted-foreground">
                                                                        #{event.seq} · {event.subjectType} ·{" "}
                                                                        {event.from ? `${event.from} → ` : ""}
                                                                        {event.to} · {event.actor} · {formatWhen(event.at)}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )
                                                    ) : null}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}

                <div className="border-t border-border/70 pt-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        New retainer
                    </h5>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div>
                            <Label htmlFor="ret-reference" className="text-xs">
                                Reference
                            </Label>
                            <Input
                                id="ret-reference"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="h-8 w-40"
                            />
                        </div>
                        <div>
                            <Label htmlFor="ret-title" className="text-xs">
                                Title
                            </Label>
                            <Input id="ret-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-48" />
                        </div>
                        <div>
                            <Label htmlFor="ret-basis" className="text-xs">
                                Basis
                            </Label>
                            <select
                                id="ret-basis"
                                value={basis}
                                onChange={(e) => setBasis(e.target.value)}
                                className="h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm"
                            >
                                <option value="UNITS">Units of work</option>
                                <option value="VALUE">Money</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="ret-included" className="text-xs">
                                {basis === "UNITS" ? "Included units" : "Included cents"}
                            </Label>
                            <Input
                                id="ret-included"
                                value={included}
                                onChange={(e) => setIncluded(e.target.value)}
                                className="h-8 w-32"
                            />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || !reference.trim() || !title.trim() || !included.trim()}
                            onClick={() =>
                                void act(async () => {
                                    const amount = Number(included.trim())
                                    await caseRequest("/api/platform/retainers", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({
                                            workspaceId,
                                            reference: reference.trim(),
                                            title: title.trim(),
                                            basis,
                                            ...(basis === "UNITS" ? { includedUnits: amount } : { includedValueCents: amount }),
                                        }),
                                    })
                                    setReference("")
                                    setTitle("")
                                    setIncluded("")
                                })
                            }
                        >
                            Create retainer
                        </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        A retainer is denominated in units of work or in money, never both. It starts as a draft, and a
                        period can only be opened once it is active.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
