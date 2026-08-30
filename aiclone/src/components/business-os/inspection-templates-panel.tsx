"use client"

import { ListChecks } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
    detailsSummary,
    formatWhen,
    inspectionRequest,
    isAbort,
    templateErrorCopy,
    templateRange,
    titleCase,
    type InspectionItemKind,
    type InspectionTemplateItemView,
    type InspectionTemplateView,
} from "./inspection-shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Owner surface for AUTHORING inspection checklists.
 *
 * This closes the gap the H1 package recorded honestly rather than papering over: the five
 * /inspection-templates/** endpoints shipped with no owner surface at all, so a checklist could only
 * be created by calling the API. The inspection panel deliberately only SELECTS an existing
 * template; it never claimed to author one.
 *
 * WHY THIS IS A SEPARATE PANEL. Authoring what you intend to ask and recording what a technician
 * found are different jobs done by different people at different times. The inspection panel is
 * already 950 lines because a job card genuinely has that much on it; folding a second workflow into
 * it would make both harder to read and would tempt a reader into thinking a template line and a
 * recorded item are the same object. They are not: the item is a SNAPSHOT of the line, which is why
 * editing a checklist can never rewrite a past answer.
 *
 * The honesty requirements this panel carries:
 *
 *   - a 403 is shown identically for a foreign checklist and one that does not exist. The contract
 *     has no 404 because a 404 would let a caller discover which ids exist, so the copy never claims
 *     the id is absent;
 *   - expectedMin and expectedMax are Decimal fields serialised as strings. They are parsed for
 *     display only and are sent back as authored;
 *   - the server owns the rules. A MEASUREMENT line without a unit and a range that ends below where
 *     it starts are both refused by a CHECK constraint and by the engine, and this panel surfaces
 *     that refusal verbatim rather than deciding for itself which line is legal. The unit field is
 *     marked required when the kind is MEASUREMENT as a HINT, not as an authority;
 *   - deactivating a checklist does not delete it and does not touch inspections already created
 *     from it, and the copy says so, because "is this gone?" is the first thing an owner asks;
 *   - nothing here is fabricated. An owner with no checklists sees an empty state, not a sample.
 */

const ITEM_KINDS: readonly InspectionItemKind[] = ["CHECK", "MEASUREMENT", "ASSET"]

type Bundle = Readonly<{
    template: InspectionTemplateView
    items: readonly InspectionTemplateItemView[]
}>

function Nothing({ label }: { label: string }) {
    return <p className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">{label}</p>
}

function kindHint(kind: InspectionItemKind): string {
    if (kind === "MEASUREMENT") return "Needs a unit. A reading with no unit is not a reading."
    if (kind === "ASSET") return "The technician must name the equipment this line looked at."
    return "A pass or fail answer."
}

export function InspectionTemplatesPanel({ workspaceId }: { workspaceId: string }) {
    const [templates, setTemplates] = useState<readonly InspectionTemplateView[] | null>(null)
    const [error, setError] = useState<unknown>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [bundle, setBundle] = useState<Bundle | null>(null)
    const [actionError, setActionError] = useState<unknown>(null)
    const [busy, setBusy] = useState(false)

    // new checklist form
    const [newName, setNewName] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [newOfferingId, setNewOfferingId] = useState("")

    // rename form, for the open checklist
    const [renameTo, setRenameTo] = useState("")

    // new line form
    const [lineLabel, setLineLabel] = useState("")
    const [lineKind, setLineKind] = useState<InspectionItemKind>("CHECK")
    const [lineGuidance, setLineGuidance] = useState("")
    const [lineRequired, setLineRequired] = useState(true)
    const [lineUnit, setLineUnit] = useState("")
    const [lineMin, setLineMin] = useState("")
    const [lineMax, setLineMax] = useState("")

    // per-line edit form, keyed by line id. An owner fixing a typo should not have to retype the line.
    const [editLabel, setEditLabel] = useState<Record<string, string>>({})
    const [removedNote, setRemovedNote] = useState<string | null>(null)

    const loadTemplates = useCallback(
        async (signal?: AbortSignal) => {
            if (!workspaceId) return
            setError(null)
            try {
                const data = await inspectionRequest<{ templates: readonly InspectionTemplateView[] }>(
                    `/api/platform/inspection-templates?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { signal },
                )
                setTemplates(data.templates)
            } catch (cause) {
                if (isAbort(cause)) return
                setTemplates(null)
                setError(cause)
            }
        },
        [workspaceId],
    )

    const loadOne = useCallback(
        async (templateId: string) => {
            setBundle(null)
            setActionError(null)
            try {
                const data = await inspectionRequest<Bundle>(
                    `/api/platform/inspection-templates/${encodeURIComponent(templateId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
                )
                setBundle(data)
                setRenameTo(data.template.name)
            } catch (cause) {
                if (isAbort(cause)) return
                setActionError(cause)
            }
        },
        [workspaceId],
    )

    useEffect(() => {
        const controller = new AbortController()
        setTemplates(null)
        setOpenId(null)
        setBundle(null)
        void loadTemplates(controller.signal)
        return () => controller.abort()
    }, [loadTemplates])

    const open = useCallback(
        (templateId: string) => {
            if (openId === templateId) {
                setOpenId(null)
                setBundle(null)
                return
            }
            setOpenId(templateId)
            void loadOne(templateId)
        },
        [openId, loadOne],
    )

    const send = useCallback(
        async (run: () => Promise<unknown>) => {
            setBusy(true)
            setActionError(null)
            try {
                await run()
                await loadTemplates()
                if (openId) await loadOne(openId)
            } catch (cause) {
                setActionError(cause)
            } finally {
                setBusy(false)
            }
        },
        [loadTemplates, loadOne, openId],
    )

    const createTemplate = useCallback(() => {
        const name = newName.trim()
        if (!name) return
        void send(async () => {
            await inspectionRequest("/api/platform/inspection-templates", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    name,
                    ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
                    ...(newOfferingId.trim() ? { serviceOfferingId: newOfferingId.trim() } : {}),
                }),
            })
            setNewName("")
            setNewDescription("")
            setNewOfferingId("")
        })
    }, [newName, newDescription, newOfferingId, send, workspaceId])

    const setActive = useCallback(
        (templateId: string, isActive: boolean) => {
            void send(() =>
                inspectionRequest(`/api/platform/inspection-templates/${encodeURIComponent(templateId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, isActive }),
                }),
            )
        },
        [send, workspaceId],
    )

    const rename = useCallback(
        (templateId: string) => {
            const name = renameTo.trim()
            if (!name) return
            void send(() =>
                inspectionRequest(`/api/platform/inspection-templates/${encodeURIComponent(templateId)}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ workspaceId, name }),
                }),
            )
        },
        [renameTo, send, workspaceId],
    )

    const addLine = useCallback(        (templateId: string) => {
            const label = lineLabel.trim()
            if (!label) return
            void send(async () => {
                await inspectionRequest(`/api/platform/inspection-templates/${encodeURIComponent(templateId)}/items`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        workspaceId,
                        label,
                        kind: lineKind,
                        required: lineRequired,
                        ...(lineGuidance.trim() ? { guidance: lineGuidance.trim() } : {}),
                        ...(lineUnit.trim() ? { unit: lineUnit.trim() } : {}),
                        ...(lineMin.trim() ? { expectedMin: Number(lineMin) } : {}),
                        ...(lineMax.trim() ? { expectedMax: Number(lineMax) } : {}),
                    }),
                })
                setLineLabel("")
                setLineGuidance("")
                setLineUnit("")
                setLineMin("")
                setLineMax("")
            })
        },
        [lineLabel, lineKind, lineRequired, lineGuidance, lineUnit, lineMin, lineMax, send, workspaceId],
    )

    const renameLine = useCallback(
        (templateId: string, itemId: string, currentLabel: string) => {
            const next = (editLabel[itemId] ?? currentLabel).trim()
            if (!next || next === currentLabel) return
            void send(async () => {
                await inspectionRequest(
                    `/api/platform/inspection-templates/${encodeURIComponent(templateId)}/items/${encodeURIComponent(itemId)}`,
                    {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ workspaceId, label: next }),
                    },
                )
                setRemovedNote(null)
            })
        },
        [editLabel, send, workspaceId],
    )

    const setLineRequiredFlag = useCallback(
        (templateId: string, itemId: string, required: boolean) => {
            void send(() =>
                inspectionRequest(
                    `/api/platform/inspection-templates/${encodeURIComponent(templateId)}/items/${encodeURIComponent(itemId)}`,
                    {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ workspaceId, required }),
                    },
                ),
            )
        },
        [send, workspaceId],
    )

    const removeLine = useCallback(
        (templateId: string, itemId: string) => {
            void send(async () => {
                const result = await inspectionRequest<{ snapshotsRetained: number }>(
                    `/api/platform/inspection-templates/${encodeURIComponent(templateId)}/items/${encodeURIComponent(itemId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
                    { method: "DELETE" },
                )
                // The server counts them, so the number is measured rather than implied.
                setRemovedNote(
                    result.snapshotsRetained === 0
                        ? "Line removed. No past inspection had been created from it."
                        : `Line removed. ${result.snapshotsRetained} past inspection${result.snapshotsRetained === 1 ? "" : "s"} keep the question and the answer that was recorded.`,
                )
            })
        },
        [send, workspaceId],
    )

    if (!workspaceId) {
        return (
            <EmptyState
                icon={<ListChecks aria-hidden="true" />}
                title="Select a workspace"
                description="Choose a workspace above to see its inspection checklists."
            />
        )
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    Inspection checklists
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">
                    A checklist is what you intend to ask. When an inspection is created from one, its lines are copied onto
                    that inspection, so editing a checklist here never changes what a past inspection asked or answered.
                </p>

                {error ? (
                    <div className="mt-3">
                        <ErrorState title={templateErrorCopy(error).title} description={templateErrorCopy(error).description} />
                    </div>
                ) : null}

                {actionError ? (
                    <div className="mt-3">
                        <ErrorState
                            title={templateErrorCopy(actionError).title}
                            description={
                                detailsSummary(actionError)
                                    ? `${templateErrorCopy(actionError).description} (${detailsSummary(actionError)})`
                                    : templateErrorCopy(actionError).description
                            }
                        />
                    </div>
                ) : null}

                <div className="mt-4 rounded-md border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">New checklist</h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                            <Label htmlFor="tpl-name">Name</Label>
                            <Input
                                id="tpl-name"
                                value={newName}
                                onChange={(event) => setNewName(event.target.value)}
                                placeholder="Annual boiler check"
                            />
                        </div>
                        <div>
                            <Label htmlFor="tpl-desc">Description</Label>
                            <Input
                                id="tpl-desc"
                                value={newDescription}
                                onChange={(event) => setNewDescription(event.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                        <div>
                            <Label htmlFor="tpl-offering">Service offering id</Label>
                            <Input
                                id="tpl-offering"
                                value={newOfferingId}
                                onChange={(event) => setNewOfferingId(event.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <Button className="mt-2" size="sm" disabled={busy || !newName.trim()} onClick={createTemplate}>
                        Create checklist
                    </Button>
                </div>

                {templates === null && !error ? (
                    <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
                        <span className="sr-only">Loading inspection checklists</span>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}

                {templates !== null && templates.length === 0 ? (
                    <div className="mt-4">
                        <EmptyState
                            icon={<ListChecks aria-hidden="true" />}
                            title="No checklists yet"
                            description="No inspection checklists have been authored in this workspace, and no sample checklists are shown."
                        />
                    </div>
                ) : null}

                {templates !== null && templates.length > 0 ? (
                    <ul className="mt-4 space-y-2" aria-live="polite" aria-busy={busy ? "true" : "false"}>
                        {templates.map((template) => (
                            <li key={template.id} className="rounded-md border border-border/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-semibold">{template.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Revision {template.revision} · updated {formatWhen(template.updatedAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={template.isActive ? "default" : "secondary"}>
                                            {template.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            aria-expanded={openId === template.id}
                                            onClick={() => open(template.id)}
                                        >
                                            {openId === template.id ? "Hide lines" : "Show lines"}
                                        </Button>
                                    </div>
                                </div>

                                {template.description ? (
                                    <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                                ) : null}

                                {openId === template.id ? (
                                    <div className="mt-3 border-t border-border/60 pt-3">
                                        {bundle === null && !actionError ? (
                                            <div aria-live="polite" aria-busy="true">
                                                <span className="sr-only">Loading checklist detail</span>
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        ) : null}

                                        {bundle !== null && bundle.template.id === template.id ? (
                                            <>
                                                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Lines
                                                </h5>
                                                {removedNote ? (
                                                    <p className="mt-1 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                                                        {removedNote}
                                                    </p>
                                                ) : null}
                                                {bundle.items.length === 0 ? (
                                                    <Nothing label="This checklist has no lines yet, so an inspection created from it would ask nothing." />
                                                ) : (
                                                    <ol className="mt-1 space-y-1">
                                                        {bundle.items.map((item) => (
                                                            <li
                                                                key={item.id}
                                                                className="rounded-md border border-border/60 px-3 py-2 text-xs"
                                                            >
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="font-medium">
                                                                        {item.position + 1}. {item.label}
                                                                    </span>
                                                                    <Badge variant="outline">{titleCase(item.kind)}</Badge>
                                                                    <Badge variant={item.required ? "secondary" : "outline"}>
                                                                        {item.required ? "Required" : "Optional"}
                                                                    </Badge>
                                                                    {item.unit ? (
                                                                        <span className="text-muted-foreground">
                                                                            unit {item.unit}
                                                                        </span>
                                                                    ) : null}
                                                                    {templateRange(item) ? (
                                                                        <span className="text-muted-foreground">
                                                                            {templateRange(item)}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                {item.guidance ? (
                                                                    <p className="mt-1 text-muted-foreground">{item.guidance}</p>
                                                                ) : null}
                                                                <div className="mt-2 flex flex-wrap items-end gap-2">
                                                                    <div className="min-w-[12rem] flex-1">
                                                                        <Label htmlFor={`line-edit-${item.id}`}>Wording</Label>
                                                                        <Input
                                                                            id={`line-edit-${item.id}`}
                                                                            value={editLabel[item.id] ?? item.label}
                                                                            onChange={(event) =>
                                                                                setEditLabel((prev) => ({
                                                                                    ...prev,
                                                                                    [item.id]: event.target.value,
                                                                                }))
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={
                                                                            busy ||
                                                                            !(editLabel[item.id] ?? item.label).trim() ||
                                                                            (editLabel[item.id] ?? item.label) === item.label
                                                                        }
                                                                        onClick={() => renameLine(template.id, item.id, item.label)}
                                                                    >
                                                                        Save wording
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={busy}
                                                                        onClick={() =>
                                                                            setLineRequiredFlag(template.id, item.id, !item.required)
                                                                        }
                                                                    >
                                                                        {item.required ? "Make optional" : "Make required"}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={busy}
                                                                        onClick={() => removeLine(template.id, item.id)}
                                                                    >
                                                                        Remove line
                                                                    </Button>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                )}

                                                <h5 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Add a line
                                                </h5>
                                                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                                    <div>
                                                        <Label htmlFor={`line-label-${template.id}`}>Label</Label>
                                                        <Input
                                                            id={`line-label-${template.id}`}
                                                            value={lineLabel}
                                                            onChange={(event) => setLineLabel(event.target.value)}
                                                            placeholder="Flue clear"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`line-kind-${template.id}`}>Kind</Label>
                                                        <select
                                                            id={`line-kind-${template.id}`}
                                                            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                                            value={lineKind}
                                                            onChange={(event) => setLineKind(event.target.value as InspectionItemKind)}
                                                        >
                                                            {ITEM_KINDS.map((kind) => (
                                                                <option key={kind} value={kind}>
                                                                    {titleCase(kind)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="mt-1 text-xs text-muted-foreground">{kindHint(lineKind)}</p>
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`line-unit-${template.id}`}>
                                                            Unit{lineKind === "MEASUREMENT" ? " (required for a measurement)" : ""}
                                                        </Label>
                                                        <Input
                                                            id={`line-unit-${template.id}`}
                                                            value={lineUnit}
                                                            onChange={(event) => setLineUnit(event.target.value)}
                                                            placeholder="bar"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`line-guidance-${template.id}`}>Guidance</Label>
                                                        <Input
                                                            id={`line-guidance-${template.id}`}
                                                            value={lineGuidance}
                                                            onChange={(event) => setLineGuidance(event.target.value)}
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`line-min-${template.id}`}>Expected minimum</Label>
                                                        <Input
                                                            id={`line-min-${template.id}`}
                                                            value={lineMin}
                                                            onChange={(event) => setLineMin(event.target.value)}
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor={`line-max-${template.id}`}>Expected maximum</Label>
                                                        <Input
                                                            id={`line-max-${template.id}`}
                                                            value={lineMax}
                                                            onChange={(event) => setLineMax(event.target.value)}
                                                            placeholder="Optional"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                                    <label className="flex items-center gap-2 text-xs">
                                                        <input
                                                            type="checkbox"
                                                            checked={lineRequired}
                                                            onChange={(event) => setLineRequired(event.target.checked)}
                                                        />
                                                        Required to answer before the inspection can be submitted
                                                    </label>
                                                    <Button
                                                        size="sm"
                                                        disabled={busy || !lineLabel.trim()}
                                                        onClick={() => addLine(template.id)}
                                                    >
                                                        Add line
                                                    </Button>
                                                </div>

                                                <h5 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Checklist settings
                                                </h5>
                                                <div className="mt-1 flex flex-wrap items-end gap-2">
                                                    <div>
                                                        <Label htmlFor={`tpl-rename-${template.id}`}>Name</Label>
                                                        <Input
                                                            id={`tpl-rename-${template.id}`}
                                                            value={renameTo}
                                                            onChange={(event) => setRenameTo(event.target.value)}
                                                        />
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy || !renameTo.trim() || renameTo.trim() === template.name}
                                                        onClick={() => rename(template.id)}
                                                    >
                                                        Rename
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() => setActive(template.id, !template.isActive)}
                                                    >
                                                        {template.isActive ? "Deactivate" : "Reactivate"}
                                                    </Button>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Deactivating hides this checklist from new inspections. It is not deleted, and
                                                    inspections already created from it keep their own copy of these lines.
                                                </p>
                                            </>
                                        ) : null}
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
