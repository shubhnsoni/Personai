"use client"

import { ClipboardCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    detailsSummary,
    formatDecimal,
    formatWhen,
    handoffVariant,
    inspectionErrorCopy,
    inspectionRequest,
    inspectionStatusVariant,
    isAbort,
    itemResultVariant,
    measurementRange,
    titleCase,
    type InspectionEventView,
    type InspectionItemResult,
    type InspectionItemView,
    type InspectionPartView,
    type InspectionView,
    type InvoiceHandoffState,
} from "./inspection-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

/**
 * Owner surface for fieldJobs:inspection.
 *
 * Root implements the runtime and routes for this in parallel; this panel is built against
 * INSPECTION_API_CONTRACT.md rather than a running route, and root implements the routes to
 * match this document.
 *
 * The honesty requirements this panel carries:
 *
 *   - a 403 is shown identically for a foreign inspection and a nonexistent one - the contract
 *     has no 404, because a 404 would let a caller discover which ids exist. The copy never says
 *     "not found";
 *   - every action button renders from the record's server-computed allowedTransitions. This
 *     component never re-implements the DRAFT/IN_PROGRESS/SUBMITTED/COMPLETED/CANCELLED state
 *     machine, and never enables a control because it thinks a transition is legal;
 *   - measuredValue, expectedMin and expectedMax are Decimal fields serialised as strings. They
 *     are parsed only for display, never assumed to be numbers, and isWithinExpectedRange is
 *     read from the server rather than recomputed here - a null there means "not applicable",
 *     not "out of range";
 *   - a part's stock only moved if the server set movementId; recording a part never implies
 *     stock moved unless that field says so;
 *   - invoice handoff is a flag the owner sets, never an invoice - the copy avoids the past
 *     tense of "invoice" as a verb, and no currency total is rendered as if a bill exists;
 *   - evidenceManifest is owner-entered metadata, not a file. This panel renders no upload
 *     control and no thumbnail.
 */

type Bundle = Readonly<{
    inspection: InspectionView
    items: readonly InspectionItemView[]
    parts: readonly InspectionPartView[]
}>

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

const ITEM_RESULTS: readonly InspectionItemResult[] = ["PENDING", "PASS", "FAIL", "NOT_APPLICABLE"]
const HANDOFF_STATES: readonly InvoiceHandoffState[] = ["NOT_READY", "READY", "HANDED_OFF", "DECLINED"]

export function InspectionPanel({ workspaceId }: { workspaceId: string }) {
    const [inspections, setInspections] = useState<readonly InspectionView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [events, setEvents] = useState<readonly InspectionEventView[] | null>(null)
    const [showEvents, setShowEvents] = useState(false)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState(false)

    // completion form
    const [outcome, setOutcome] = useState("")
    const [completionNotes, setCompletionNotes] = useState("")
    const [cancelReason, setCancelReason] = useState("")

    // per-item recording (keyed by itemId)
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
    const [itemMeasured, setItemMeasured] = useState<Record<string, string>>({})
    const [assetLabel, setAssetLabel] = useState<Record<string, string>>({})
    const [assetSerial, setAssetSerial] = useState<Record<string, string>>({})
    const [assetLocation, setAssetLocation] = useState<Record<string, string>>({})

    // part-recording form
    const [partInventoryId, setPartInventoryId] = useState("")
    const [partQty, setPartQty] = useState("")
    const [partConsumeStock, setPartConsumeStock] = useState(false)

    // new inspection form
    const [newJobId, setNewJobId] = useState("")
    const [newReference, setNewReference] = useState("")
    const [newTemplateId, setNewTemplateId] = useState("")

    // handoff form
    const [handoffReference, setHandoffReference] = useState("")
    const [handoffNote, setHandoffNote] = useState("")

    const loadInspections = useCallback(
        async (signal?: AbortSignal) => {
            if (!workspaceId) {
                setInspections(null)
                return
            }
            try {
                setError(null)
                const data = await inspectionRequest<{ inspections: readonly InspectionView[] }>(
                    `/api/platform/inspections?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal },
                )
                setInspections(data.inspections)
            } catch (cause) {
                if (isAbort(cause)) return
                setInspections(null)
                setError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        const controller = new AbortController()
        void loadInspections(controller.signal)
        return () => controller.abort()
    }, [loadInspections])

    const loadBundle = useCallback(
        async (inspectionId: string, signal?: AbortSignal) => {
            try {
                setActionError(null)
                const data = await inspectionRequest<{
                    inspection: InspectionView
                    items: readonly InspectionItemView[]
                    parts: readonly InspectionPartView[]
                }>(
                    `/api/platform/inspections/${encodeURIComponent(inspectionId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal },
                )
                setBundle({ inspection: data.inspection, items: data.items, parts: data.parts })
                setOutcome(data.inspection.outcome ?? "")
                setCompletionNotes(data.inspection.completionNotes ?? "")
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
                await loadInspections()
                if (openId) await loadBundle(openId)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy(false)
            }
        },
        [loadInspections, loadBundle, openId],
    )

    if (!workspaceId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h3>Inspections</h3>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EmptyState
                        icon={<ClipboardCheck aria-hidden="true" />}
                        title="Select a workspace"
                        description="Choose a workspace above to see its inspections."
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <h3>Inspections</h3>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    A checklist run against a field job, plus what was found. Invoice handoff below is a flag the
                    owner sets to say the job is billable and passed on — nothing here creates an invoice or moves
                    money. Evidence is metadata the owner types in; there is no file upload or thumbnail on this
                    screen.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? (
                    <ErrorState title={inspectionErrorCopy(error).title} description={inspectionErrorCopy(error).description} />
                ) : null}
                {actionError ? (
                    <ErrorState
                        title={inspectionErrorCopy(actionError).title}
                        description={
                            detailsSummary(actionError)
                                ? `${inspectionErrorCopy(actionError).description} (${detailsSummary(actionError)})`
                                : inspectionErrorCopy(actionError).description
                        }
                    />
                ) : null}

                {inspections === null && !error ? (
                    <div className="space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading inspections</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {inspections !== null && inspections.length === 0 ? (
                    <EmptyState
                        icon={<ClipboardCheck aria-hidden="true" />}
                        title="No inspections yet"
                        description="No inspections have been started against a job in this workspace, and no sample inspections are shown."
                    />
                ) : null}

                {inspections !== null && inspections.length > 0 ? (
                    <ul className="space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                        {inspections.map((inspection) => (
                            <li key={inspection.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">{inspection.reference}</p>
                                        <p className="text-xs text-muted-foreground">
                                            job {inspection.jobId} ·{" "}
                                            {inspection.outcome ? titleCase(inspection.outcome) : "no outcome yet"}
                                            {inspection.pendingRequired > 0
                                                ? ` · ${inspection.pendingRequired} required item${inspection.pendingRequired === 1 ? "" : "s"} still pending`
                                                : ""}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={inspectionStatusVariant(inspection.status)}>{titleCase(inspection.status)}</Badge>
                                        <Badge variant={handoffVariant(inspection.invoiceHandoffState)}>
                                            HANDOFF: {titleCase(inspection.invoiceHandoffState)}
                                        </Badge>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            aria-expanded={openId === inspection.id}
                                            onClick={() => setOpenId(openId === inspection.id ? null : inspection.id)}
                                        >
                                            {openId === inspection.id ? "Hide" : "Open"}
                                        </Button>
                                    </div>
                                </div>

                                {inspection.cancelReason ? (
                                    <p className="mt-1 text-xs text-muted-foreground">Cancelled: {inspection.cancelReason}</p>
                                ) : null}

                                <div className="mt-2 flex flex-wrap gap-2">
                                    {inspection.allowedTransitions
                                        .filter((next) => next !== "COMPLETED" && next !== "CANCELLED")
                                        .map((next) => (
                                            <Button
                                                key={next}
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    void act(() =>
                                                        inspectionRequest(`/api/platform/inspections/${encodeURIComponent(inspection.id)}`, {
                                                            method: "PATCH",
                                                            headers: { "content-type": "application/json" },
                                                            body: JSON.stringify({ workspaceId, status: next }),
                                                        }),
                                                    )
                                                }
                                            >
                                                {titleCase(next)}
                                            </Button>
                                        ))}
                                    {inspection.allowedTransitions.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            This inspection is {inspection.status.toLowerCase()} and cannot change.
                                        </p>
                                    ) : null}
                                </div>

                                {openId === inspection.id ? (
                                    <div className="mt-3 border-t border-border/70 pt-3">
                                        {bundle === null && !actionError ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading inspection detail</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : null}

                                        {bundle ? (
                                            <>
                                                <Section title="Asset checks">
                                                    {bundle.items.filter((item) => item.kind === "ASSET").length === 0 ? (
                                                        <Nothing label="No asset checks on this inspection." />
                                                    ) : (
                                                        bundle.items
                                                            .filter((item) => item.kind === "ASSET")
                                                            .map((item) => (
                                                                <div key={item.id} className="rounded-md border border-border/70 p-2">
                                                                    <p className="text-xs font-medium">{item.label}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {item.assetLabel ? item.assetLabel : "no asset label recorded yet"}
                                                                        {item.assetSerial ? ` · serial ${item.assetSerial}` : ""}
                                                                        {item.assetLocationHint ? ` · ${item.assetLocationHint}` : ""}
                                                                    </p>
                                                                    <div className="mt-1 flex items-center gap-2">
                                                                        <Badge variant={itemResultVariant(item.result)}>{titleCase(item.result)}</Badge>
                                                                        {item.required ? <Badge variant="outline">Required</Badge> : null}
                                                                    </div>
                                                                    {!inspection.isTerminal ? (
                                                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                                                            <div>
                                                                                <Label htmlFor={`asset-label-${item.id}`} className="text-xs">
                                                                                    Asset label
                                                                                </Label>
                                                                                <Input
                                                                                    id={`asset-label-${item.id}`}
                                                                                    value={assetLabel[item.id] ?? item.assetLabel ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setAssetLabel((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                                                    }
                                                                                    className="h-8 w-40"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label htmlFor={`asset-serial-${item.id}`} className="text-xs">
                                                                                    Serial
                                                                                </Label>
                                                                                <Input
                                                                                    id={`asset-serial-${item.id}`}
                                                                                    value={assetSerial[item.id] ?? item.assetSerial ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setAssetSerial((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                                                    }
                                                                                    className="h-8 w-32"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label htmlFor={`asset-location-${item.id}`} className="text-xs">
                                                                                    Location hint
                                                                                </Label>
                                                                                <Input
                                                                                    id={`asset-location-${item.id}`}
                                                                                    value={assetLocation[item.id] ?? item.assetLocationHint ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setAssetLocation((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                                                    }
                                                                                    className="h-8 w-40"
                                                                                />
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                disabled={busy || !(assetLabel[item.id] ?? item.assetLabel ?? "").trim()}
                                                                                onClick={() =>
                                                                                    void act(() =>
                                                                                        inspectionRequest(
                                                                                            `/api/platform/inspections/${encodeURIComponent(inspection.id)}/items/${encodeURIComponent(item.id)}`,
                                                                                            {
                                                                                                method: "PATCH",
                                                                                                headers: { "content-type": "application/json" },
                                                                                                body: JSON.stringify({
                                                                                                    workspaceId,
                                                                                                    assetLabel: (assetLabel[item.id] ?? item.assetLabel ?? "").trim(),
                                                                                                    ...(assetSerial[item.id]?.trim()
                                                                                                        ? { assetSerial: assetSerial[item.id].trim() }
                                                                                                        : {}),
                                                                                                    ...(assetLocation[item.id]?.trim()
                                                                                                        ? { assetLocationHint: assetLocation[item.id].trim() }
                                                                                                        : {}),
                                                                                                }),
                                                                                            },
                                                                                        ),
                                                                                    )
                                                                                }
                                                                            >
                                                                                Save asset
                                                                            </Button>
                                                                        </div>
                                                                    ) : null}
                                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                                        There is no asset registry behind this field — the identity above lives
                                                                        only on this item, and there is no service history to browse per asset.
                                                                    </p>
                                                                </div>
                                                            ))
                                                    )}
                                                </Section>

                                                <Section title="Measurements">
                                                    {bundle.items.filter((item) => item.kind === "MEASUREMENT").length === 0 ? (
                                                        <Nothing label="No measurements on this inspection." />
                                                    ) : (
                                                        bundle.items
                                                            .filter((item) => item.kind === "MEASUREMENT")
                                                            .map((item) => (
                                                                <div key={item.id} className="rounded-md border border-border/70 p-2">
                                                                    <p className="text-xs font-medium">{item.label}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {item.measuredValue !== null
                                                                            ? `reading ${formatDecimal(item.measuredValue)}${item.unit ? ` ${item.unit}` : ""}`
                                                                            : "no reading recorded yet"}
                                                                        {measurementRange(item) ? ` · ${measurementRange(item)}` : ""}
                                                                    </p>
                                                                    <div className="mt-1 flex items-center gap-2">
                                                                        <Badge variant={itemResultVariant(item.result)}>{titleCase(item.result)}</Badge>
                                                                        {item.required ? <Badge variant="outline">Required</Badge> : null}
                                                                        {item.isWithinExpectedRange === null ? (
                                                                            <Badge variant="outline">Range not applicable</Badge>
                                                                        ) : item.isWithinExpectedRange ? (
                                                                            <Badge variant="default">Within expected range</Badge>
                                                                        ) : (
                                                                            <Badge variant="destructive">Outside expected range</Badge>
                                                                        )}
                                                                    </div>
                                                                    {!inspection.isTerminal ? (
                                                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                                                            <div>
                                                                                <Label htmlFor={`measured-${item.id}`} className="text-xs">
                                                                                    Reading{item.unit ? ` (${item.unit})` : ""}
                                                                                </Label>
                                                                                <Input
                                                                                    id={`measured-${item.id}`}
                                                                                    value={itemMeasured[item.id] ?? item.measuredValue ?? ""}
                                                                                    onChange={(e) =>
                                                                                        setItemMeasured((prev) => ({ ...prev, [item.id]: e.target.value }))
                                                                                    }
                                                                                    className="h-8 w-32"
                                                                                />
                                                                            </div>
                                                                            {ITEM_RESULTS.map((next) => (
                                                                                <Button
                                                                                    key={next}
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    disabled={busy}
                                                                                    onClick={() =>
                                                                                        void act(() =>
                                                                                            inspectionRequest(
                                                                                                `/api/platform/inspections/${encodeURIComponent(inspection.id)}/items/${encodeURIComponent(item.id)}`,
                                                                                                {
                                                                                                    method: "PATCH",
                                                                                                    headers: { "content-type": "application/json" },
                                                                                                    body: JSON.stringify({
                                                                                                        workspaceId,
                                                                                                        result: next,
                                                                                                        ...(itemMeasured[item.id]?.trim()
                                                                                                            ? { measuredValue: itemMeasured[item.id].trim() }
                                                                                                            : {}),
                                                                                                        ...(itemNotes[item.id]?.trim()
                                                                                                            ? { notes: itemNotes[item.id].trim() }
                                                                                                            : {}),
                                                                                                    }),
                                                                                                },
                                                                                            ),
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Mark {titleCase(next)}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null}
                                                                    {item.notes ? (
                                                                        <p className="mt-1 text-xs text-muted-foreground">Notes: {item.notes}</p>
                                                                    ) : null}
                                                                </div>
                                                            ))
                                                    )}
                                                </Section>

                                                <Section title="Checks">
                                                    {bundle.items.filter((item) => item.kind === "CHECK").length === 0 ? (
                                                        <Nothing label="No plain checklist items on this inspection." />
                                                    ) : (
                                                        bundle.items
                                                            .filter((item) => item.kind === "CHECK")
                                                            .map((item) => (
                                                                <div key={item.id} className="rounded-md border border-border/70 p-2">
                                                                    <p className="text-xs font-medium">{item.label}</p>
                                                                    {item.guidance ? (
                                                                        <p className="text-xs text-muted-foreground">{item.guidance}</p>
                                                                    ) : null}
                                                                    <div className="mt-1 flex items-center gap-2">
                                                                        <Badge variant={itemResultVariant(item.result)}>{titleCase(item.result)}</Badge>
                                                                        {item.required ? <Badge variant="outline">Required</Badge> : null}
                                                                    </div>
                                                                    {!inspection.isTerminal ? (
                                                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                                                            <div>
                                                                                <Label htmlFor={`check-notes-${item.id}`} className="text-xs">
                                                                                    Notes (required to mark Fail)
                                                                                </Label>
                                                                                <Input
                                                                                    id={`check-notes-${item.id}`}
                                                                                    value={itemNotes[item.id] ?? item.notes ?? ""}
                                                                                    onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                                                    className="h-8 w-56"
                                                                                />
                                                                            </div>
                                                                            {ITEM_RESULTS.map((next) => (
                                                                                <Button
                                                                                    key={next}
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    disabled={busy || (next === "FAIL" && !(itemNotes[item.id] ?? item.notes ?? "").trim())}
                                                                                    onClick={() =>
                                                                                        void act(() =>
                                                                                            inspectionRequest(
                                                                                                `/api/platform/inspections/${encodeURIComponent(inspection.id)}/items/${encodeURIComponent(item.id)}`,
                                                                                                {
                                                                                                    method: "PATCH",
                                                                                                    headers: { "content-type": "application/json" },
                                                                                                    body: JSON.stringify({
                                                                                                        workspaceId,
                                                                                                        result: next,
                                                                                                        ...(itemNotes[item.id]?.trim() ? { notes: itemNotes[item.id].trim() } : {}),
                                                                                                    }),
                                                                                                },
                                                                                            ),
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Mark {titleCase(next)}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ))
                                                    )}
                                                    {inspection.isTerminal ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            This inspection is {inspection.status.toLowerCase()}, so items cannot be recorded.
                                                        </p>
                                                    ) : null}
                                                </Section>

                                                <Section title="Parts used">
                                                    {bundle.parts.length === 0 ? (
                                                        <Nothing label="No parts recorded against this inspection." />
                                                    ) : (
                                                        bundle.parts.map((part) => (
                                                            <div key={part.id} className="rounded-md border border-border/70 p-2 text-xs">
                                                                <p>
                                                                    {part.inventoryItemId} · qty {part.qty}
                                                                    {part.unitCostCents !== null
                                                                        ? ` · ${part.currency ?? ""} ${(part.unitCostCents / 100).toFixed(2)} each`
                                                                        : ""}
                                                                </p>
                                                                <p className="text-muted-foreground">
                                                                    {part.movementId
                                                                        ? `stock moved (movement ${part.movementId})`
                                                                        : "recorded only — stock did not move"}
                                                                </p>
                                                                {part.notes ? <p className="text-muted-foreground">{part.notes}</p> : null}
                                                            </div>
                                                        ))
                                                    )}
                                                    {!inspection.isTerminal ? (
                                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                                            <div>
                                                                <Label htmlFor={`part-inv-${inspection.id}`} className="text-xs">
                                                                    Inventory item id
                                                                </Label>
                                                                <Input
                                                                    id={`part-inv-${inspection.id}`}
                                                                    value={partInventoryId}
                                                                    onChange={(e) => setPartInventoryId(e.target.value)}
                                                                    className="h-8 w-48"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor={`part-qty-${inspection.id}`} className="text-xs">
                                                                    Qty
                                                                </Label>
                                                                <Input
                                                                    id={`part-qty-${inspection.id}`}
                                                                    value={partQty}
                                                                    onChange={(e) => setPartQty(e.target.value)}
                                                                    className="h-8 w-20"
                                                                />
                                                            </div>
                                                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={partConsumeStock}
                                                                    onChange={(e) => setPartConsumeStock(e.target.checked)}
                                                                />
                                                                Move stock now
                                                            </label>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                disabled={busy || !partInventoryId.trim() || !partQty.trim()}
                                                                onClick={() =>
                                                                    void act(async () => {
                                                                        await inspectionRequest(
                                                                            `/api/platform/inspections/${encodeURIComponent(inspection.id)}/parts`,
                                                                            {
                                                                                method: "POST",
                                                                                headers: { "content-type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    workspaceId,
                                                                                    inventoryItemId: partInventoryId.trim(),
                                                                                    qty: Number(partQty.trim()),
                                                                                    consumeStock: partConsumeStock,
                                                                                }),
                                                                            },
                                                                        )
                                                                        setPartInventoryId("")
                                                                        setPartQty("")
                                                                        setPartConsumeStock(false)
                                                                    })
                                                                }
                                                            >
                                                                Record part
                                                            </Button>
                                                        </div>
                                                    ) : null}
                                                    <p className="text-xs text-muted-foreground">
                                                        Recording a part never moves stock by itself. Stock only moves when &ldquo;Move
                                                        stock now&rdquo; is checked, and only then does a movement id appear above.
                                                    </p>
                                                </Section>

                                                <Section title="Completion notes">
                                                    {inspection.completionNotes ? (
                                                        <p className="text-xs">{inspection.completionNotes}</p>
                                                    ) : (
                                                        <Nothing label="No completion notes recorded yet." />
                                                    )}
                                                </Section>

                                                <Section title="Invoice handoff">
                                                    <p className="text-xs text-muted-foreground">
                                                        This is a HANDOFF FLAG, not an invoice. Setting it does not create a bill or move
                                                        money — it records that the owner considers the job billable and has passed it to
                                                        billing.
                                                    </p>
                                                    <p className="text-xs">
                                                        Current: <Badge variant={handoffVariant(inspection.invoiceHandoffState)}>
                                                            {titleCase(inspection.invoiceHandoffState)}
                                                        </Badge>
                                                        {inspection.invoiceHandoffReference ? ` · reference ${inspection.invoiceHandoffReference}` : ""}
                                                        {inspection.invoiceHandoffAt ? ` · set ${formatWhen(inspection.invoiceHandoffAt)}` : ""}
                                                    </p>
                                                    {inspection.invoiceHandoffNote ? (
                                                        <p className="text-xs text-muted-foreground">{inspection.invoiceHandoffNote}</p>
                                                    ) : null}
                                                    {inspection.status !== "COMPLETED" ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            Any handoff state other than Not Ready requires the inspection to be completed
                                                            first.
                                                        </p>
                                                    ) : (
                                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                                            <div>
                                                                <Label htmlFor={`handoff-ref-${inspection.id}`} className="text-xs">
                                                                    Reference (optional)
                                                                </Label>
                                                                <Input
                                                                    id={`handoff-ref-${inspection.id}`}
                                                                    value={handoffReference}
                                                                    onChange={(e) => setHandoffReference(e.target.value)}
                                                                    className="h-8 w-40"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label htmlFor={`handoff-note-${inspection.id}`} className="text-xs">
                                                                    Note (optional)
                                                                </Label>
                                                                <Input
                                                                    id={`handoff-note-${inspection.id}`}
                                                                    value={handoffNote}
                                                                    onChange={(e) => setHandoffNote(e.target.value)}
                                                                    className="h-8 w-48"
                                                                />
                                                            </div>
                                                            {HANDOFF_STATES.map((next) => (
                                                                <Button
                                                                    key={next}
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={busy || next === inspection.invoiceHandoffState}
                                                                    onClick={() =>
                                                                        void act(() =>
                                                                            inspectionRequest(
                                                                                `/api/platform/inspections/${encodeURIComponent(inspection.id)}/handoff`,
                                                                                {
                                                                                    method: "PATCH",
                                                                                    headers: { "content-type": "application/json" },
                                                                                    body: JSON.stringify({
                                                                                        workspaceId,
                                                                                        invoiceHandoffState: next,
                                                                                        ...(handoffReference.trim()
                                                                                            ? { invoiceHandoffReference: handoffReference.trim() }
                                                                                            : {}),
                                                                                        ...(handoffNote.trim() ? { invoiceHandoffNote: handoffNote.trim() } : {}),
                                                                                    }),
                                                                                },
                                                                            ),
                                                                        )
                                                                    }
                                                                >
                                                                    Handoff: {titleCase(next)}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </Section>

                                                {inspection.allowedTransitions.includes("COMPLETED") ? (
                                                    <Section title="Complete this inspection">
                                                        {inspection.pendingRequired > 0 ? (
                                                            <p className="text-xs text-muted-foreground">
                                                                {inspection.pendingRequired} required item
                                                                {inspection.pendingRequired === 1 ? "" : "s"} still pending. Completion will be
                                                                refused until every required item has a result.
                                                            </p>
                                                        ) : null}
                                                        <div className="flex flex-wrap items-end gap-2">
                                                            <div>
                                                                <Label htmlFor={`outcome-${inspection.id}`} className="text-xs">
                                                                    Outcome
                                                                </Label>
                                                                <select
                                                                    id={`outcome-${inspection.id}`}
                                                                    value={outcome}
                                                                    onChange={(e) => setOutcome(e.target.value)}
                                                                    className="h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm"
                                                                >
                                                                    <option value="">Select…</option>
                                                                    <option value="PASS">Pass</option>
                                                                    <option value="FAIL">Fail</option>
                                                                    <option value="ADVISORY">Advisory</option>
                                                                </select>
                                                            </div>
                                                            <div className="w-64">
                                                                <Label htmlFor={`completion-notes-${inspection.id}`} className="text-xs">
                                                                    Completion notes (required)
                                                                </Label>
                                                                <Textarea
                                                                    id={`completion-notes-${inspection.id}`}
                                                                    value={completionNotes}
                                                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                                                    className="min-h-[32px] py-1 text-sm"
                                                                />
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                disabled={busy || !outcome || !completionNotes.trim()}
                                                                onClick={() =>
                                                                    void act(() =>
                                                                        inspectionRequest(
                                                                            `/api/platform/inspections/${encodeURIComponent(inspection.id)}`,
                                                                            {
                                                                                method: "PATCH",
                                                                                headers: { "content-type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    workspaceId,
                                                                                    status: "COMPLETED",
                                                                                    outcome,
                                                                                    completionNotes: completionNotes.trim(),
                                                                                }),
                                                                            },
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                Complete
                                                            </Button>
                                                        </div>
                                                    </Section>
                                                ) : null}

                                                {inspection.allowedTransitions.includes("CANCELLED") ? (
                                                    <Section title="Cancel this inspection">
                                                        <div className="flex flex-wrap items-end gap-2">
                                                            <div className="w-64">
                                                                <Label htmlFor={`cancel-reason-${inspection.id}`} className="text-xs">
                                                                    Cancel reason (required)
                                                                </Label>
                                                                <Input
                                                                    id={`cancel-reason-${inspection.id}`}
                                                                    value={cancelReason}
                                                                    onChange={(e) => setCancelReason(e.target.value)}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={busy || !cancelReason.trim()}
                                                                onClick={() =>
                                                                    void act(() =>
                                                                        inspectionRequest(
                                                                            `/api/platform/inspections/${encodeURIComponent(inspection.id)}`,
                                                                            {
                                                                                method: "PATCH",
                                                                                headers: { "content-type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    workspaceId,
                                                                                    status: "CANCELLED",
                                                                                    cancelReason: cancelReason.trim(),
                                                                                }),
                                                                            },
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                Cancel inspection
                                                            </Button>
                                                        </div>
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
                                                                void inspectionRequest<{ events: readonly InspectionEventView[] }>(
                                                                    `/api/platform/inspections/${encodeURIComponent(inspection.id)}/timeline?workspaceId=${encodeURIComponent(workspaceId)}`,
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
                                                                <span className="sr-only">Loading inspection history</span>
                                                                <Skeleton className="h-6 w-full" />
                                                            </div>
                                                        ) : events.length === 0 ? (
                                                            <Nothing label="No history recorded yet." />
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
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New inspection</h5>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div>
                            <Label htmlFor="insp-job" className="text-xs">
                                Job id
                            </Label>
                            <Input id="insp-job" value={newJobId} onChange={(e) => setNewJobId(e.target.value)} className="h-8 w-48" />
                        </div>
                        <div>
                            <Label htmlFor="insp-reference" className="text-xs">
                                Reference
                            </Label>
                            <Input
                                id="insp-reference"
                                value={newReference}
                                onChange={(e) => setNewReference(e.target.value)}
                                className="h-8 w-40"
                            />
                        </div>
                        <div>
                            <Label htmlFor="insp-template" className="text-xs">
                                Template id (optional)
                            </Label>
                            <Input
                                id="insp-template"
                                value={newTemplateId}
                                onChange={(e) => setNewTemplateId(e.target.value)}
                                className="h-8 w-48"
                            />
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || !newJobId.trim() || !newReference.trim()}
                            onClick={() =>
                                void act(async () => {
                                    await inspectionRequest("/api/platform/inspections", {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({
                                            workspaceId,
                                            jobId: newJobId.trim(),
                                            reference: newReference.trim(),
                                            ...(newTemplateId.trim() ? { templateId: newTemplateId.trim() } : {}),
                                        }),
                                    })
                                    setNewJobId("")
                                    setNewReference("")
                                    setNewTemplateId("")
                                })
                            }
                        >
                            Start inspection
                        </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        A job can only have one open inspection at a time. If a template id is given, its checklist
                        lines are copied onto this inspection now, so editing the template later never rewrites what
                        this inspection already asked.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
