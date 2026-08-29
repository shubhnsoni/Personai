/**
 * fieldJobs:inspection runtime (Wave H1): asset checks, checklists, parts and invoice handoff.
 *
 * Composes what already exists rather than restating it. The checklist is a template plus
 * snapshotted lines, the part is an InventoryItem moved by the existing inventory engine, the
 * technician is the FieldJobAssignment G4 already models, and the history is the SHARED
 * FieldJobEvent ledger — this file adds no event table and no FieldJobEventKind value.
 *
 * WHAT THIS DOES NOT DO, stated here because "inspection" and "invoice handoff" both imply more
 * than they deliver:
 *   - There is NO asset registry. An ASSET line carries the equipment's identity in its own
 *     columns. There is no asset list, no per-asset service history, and nothing to browse.
 *   - There is NO invoice and NO payment. `invoiceHandoffState` is a flag an owner sets. No
 *     invoice row is written, no money moves, no provider is called.
 *   - There is NO file upload. `evidenceManifest` is owner-entered metadata ABOUT evidence held
 *     somewhere else, and nothing in this file dereferences a value inside it.
 *   - There is NO notification. Nothing tells a technician anything.
 * There is no fetch, no provider client and no queue write anywhere in this file.
 *
 * TWO STATE MACHINES, from inspection-lifecycle.ts: the INSPECTION and the INVOICE HANDOFF that
 * may follow it. The side conditions on both are named as exported lists in that module rather
 * than buried in an `if`, so the rule is readable without reading the method.
 *
 * SNAPSHOTTING IS THE POINT OF THE TEMPLATE DESIGN. Creating an inspection from a template copies
 * the template's lines into FieldJobInspectionItem rows. Editing the template afterwards therefore
 * cannot rewrite what a past inspection asked or answered, which is the difference between a
 * record and a report.
 */
import type { PrismaClient } from "@prisma/client"

import type { InventoryService, StockRecord } from "../inventory/engine"
import { PersistenceError } from "../persistence/errors"
import {
    ALL_REQUIRED_ANSWERED_STATUSES,
    HANDOFF_STATES_REQUIRING_COMPLETION,
    HANDOFF_STATES_REQUIRING_TIMESTAMP,
    INSPECTION_EVENT_SUBJECTS,
    INSPECTION_TIMESTAMP_FIELD,
    NOTES_REQUIRED_ITEM_RESULTS,
    NOTES_REQUIRED_STATUSES,
    OUTCOME_REQUIRED_STATUSES,
    REASON_REQUIRED_STATUSES,
    RECORDABLE_STATUSES,
    UNANSWERED_ITEM_RESULTS,
    handoffFlow,
    inspectionFlow,
    type InspectionItemKindValue,
    type InspectionItemResultValue,
    type InspectionOutcomeValue,
    type InspectionStatusValue,
    type InvoiceHandoffStateValue,
} from "./inspection-lifecycle"
import type { FieldJobActor, FieldJobContext } from "./shared"

/**
 * The statuses the partial unique index `FieldJobInspection_one_open_per_job` treats as open.
 * Restated from the migration deliberately: if the two ever disagree the engine's conflict and the
 * database's index would disagree, so the runtime harness asserts this list against the index.
 */
export const OPEN_INSPECTION_STATUSES: readonly InspectionStatusValue[] = Object.freeze([
    "DRAFT",
    "IN_PROGRESS",
    "SUBMITTED",
])

/**
 * A Prisma Decimal, structurally. Typed by the shape actually used rather than by importing the
 * Decimal class, because every consumer of these fields turns them into a string and the HTTP
 * boundary is required to serialise them as strings to avoid float loss.
 */
type DecimalLike = { toString(): string }
/** What a caller may hand in for a Decimal column. Prisma accepts all three. */
export type DecimalInput = number | string | null

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * Narrows a fieldJobs actor to the vocabulary the inventory ledger accepts.
 *
 * fieldJobs has a TECHNICIAN actor and inventory does not, because inventory never needed to tell a
 * technician apart from an office staffer. A technician is staff of the business, so TECHNICIAN maps
 * to STAFF rather than to SYSTEM: recording a human's stock movement as SYSTEM would claim nobody
 * did it. CUSTOMER maps to SYSTEM for the same reason commerce/returns.ts does it — a customer
 * cannot move a depot's stock, so the movement is the system acting on their behalf.
 *
 * The fieldJobs event ledger keeps the UNNARROWED actor, so "which technician" is still answerable
 * there; only the inventory movement is coarser.
 */
function inventoryActor(actor: FieldJobActor): Readonly<{ actorType: "STAFF" | "SYSTEM" | "CUSTOMER"; actorId: string | null }> {
    return {
        actorType: actor.actorType === "CUSTOMER" ? "SYSTEM" : actor.actorType === "TECHNICIAN" ? "STAFF" : actor.actorType,
        actorId: actor.actorId,
    }
}

/** Decimal -> number for range arithmetic only. Never used to serialise. */
function decimalToNumber(value: DecimalLike | null): number | null {
    if (value === null || value === undefined) return null
    const n = Number(value.toString())
    return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

type RawTemplate = {
    id: string
    profileId: string
    serviceOfferingId: string | null
    name: string
    description: string | null
    isActive: boolean
    revision: number
    createdAt: Date
    updatedAt: Date
}

export type TemplateRecord = Readonly<RawTemplate>

export function toTemplateRecord(row: RawTemplate): TemplateRecord {
    return Object.freeze({ ...row })
}

type RawTemplateItem = {
    id: string
    templateId: string
    position: number
    kind: InspectionItemKindValue
    label: string
    guidance: string | null
    required: boolean
    unit: string | null
    expectedMin: DecimalLike | null
    expectedMax: DecimalLike | null
    createdAt: Date
    updatedAt: Date
}

export type TemplateItemRecord = Readonly<RawTemplateItem>

export function toTemplateItemRecord(row: RawTemplateItem): TemplateItemRecord {
    return Object.freeze({ ...row })
}

type RawInspection = {
    id: string
    jobId: string
    profileId: string
    templateId: string | null
    assignmentId: string | null
    reference: string
    status: InspectionStatusValue
    outcome: InspectionOutcomeValue | null
    startedAt: Date | null
    submittedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    completionNotes: string | null
    evidenceManifest: unknown
    invoiceHandoffState: InvoiceHandoffStateValue
    invoiceHandoffAt: Date | null
    invoiceHandoffReference: string | null
    invoiceHandoffNote: string | null
    createdAt: Date
    updatedAt: Date
}

export type InspectionRecord = Readonly<
    RawInspection & {
        allowedTransitions: readonly InspectionStatusValue[]
        /** Server-computed so the UI never has to reimplement the handoff rules. */
        allowedHandoffStates: readonly InvoiceHandoffStateValue[]
        /** How many REQUIRED lines are still unanswered. 0 does not imply completable. */
        pendingRequired: number
        isTerminal: boolean
    }
>

export function toInspectionRecord(row: RawInspection, pendingRequired: number): InspectionRecord {
    return Object.freeze({
        ...row,
        allowedTransitions: inspectionFlow.allowedFrom(row.status),
        // A handoff state is only reachable once the inspection is COMPLETED, and the database
        // agrees via FieldJobInspection_handoff_requires_completion. Offering a button the
        // database would refuse is worse than offering none.
        allowedHandoffStates:
            row.status === "COMPLETED"
                ? handoffFlow.allowedFrom(row.invoiceHandoffState)
                : Object.freeze(
                      handoffFlow
                          .allowedFrom(row.invoiceHandoffState)
                          .filter((s) => !HANDOFF_STATES_REQUIRING_COMPLETION.includes(s)),
                  ),
        pendingRequired,
        isTerminal: inspectionFlow.isTerminal(row.status),
    })
}

type RawItem = {
    id: string
    inspectionId: string
    templateItemId: string | null
    position: number
    kind: InspectionItemKindValue
    label: string
    guidance: string | null
    required: boolean
    result: InspectionItemResultValue
    notes: string | null
    measuredValue: DecimalLike | null
    unit: string | null
    expectedMin: DecimalLike | null
    expectedMax: DecimalLike | null
    assetLabel: string | null
    assetSerial: string | null
    assetLocationHint: string | null
    recordedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export type ItemRecord = Readonly<
    RawItem & {
        /**
         * null when this is not a measurement, has no range, or has no reading yet. Derived on
         * read and never stored, so it cannot go stale when a reading changes.
         */
        isWithinExpectedRange: boolean | null
    }
>

export function toItemRecord(row: RawItem): ItemRecord {
    return Object.freeze({ ...row, isWithinExpectedRange: withinRange(row) })
}

function withinRange(row: RawItem): boolean | null {
    if (row.kind !== "MEASUREMENT") return null
    const value = decimalToNumber(row.measuredValue)
    if (value === null) return null
    const min = decimalToNumber(row.expectedMin)
    const max = decimalToNumber(row.expectedMax)
    if (min === null && max === null) return null
    if (min !== null && value < min) return false
    if (max !== null && value > max) return false
    return true
}

type RawPart = {
    id: string
    inspectionId: string
    inventoryItemId: string
    movementId: string | null
    qty: number
    unitCostCents: number | null
    currency: string
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export type PartRecord = Readonly<
    RawPart & {
        /**
         * Derived, and the honest name for it: a part line with no movement was RECORDED but no
         * stock left the shelf. The UI must be able to say which happened.
         */
        stockMoved: boolean
    }
>

export function toPartRecord(row: RawPart): PartRecord {
    return Object.freeze({ ...row, stockMoved: row.movementId !== null })
}

export type InspectionEvent = Readonly<{
    id: string
    /** String, not number: FieldJobEvent.seq is a BigInt and would lose precision as a JSON number. */
    seq: string
    kind: string
    subjectType: string
    subjectId: string
    from: string | null
    to: string
    actor: string
    actorId: string | null
    at: Date
    metadata: unknown
}>

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export class FieldJobInspectionTemplateService {
    constructor(private readonly ctx: FieldJobContext) {}

    async list(workspaceId: string): Promise<readonly TemplateRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const rows = await this.ctx.db.fieldJobInspectionTemplate.findMany({
            where: { profileId },
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
        })
        for (const row of rows) if (row.profileId !== profileId) this.ctx.denied()
        return Object.freeze(rows.map((r) => toTemplateRecord(r as RawTemplate)))
    }

    /** Idempotent on (profileId, idempotencyKey), backed by a unique index. */
    async create(
        workspaceId: string,
        input: Readonly<{
            name: string
            description?: string | null
            serviceOfferingId?: string | null
            idempotencyKey?: string | null
        }>,
    ): Promise<{ template: TemplateRecord; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const name = this.ctx.required(input.name, "name")
        const key = input.idempotencyKey?.trim() || null
        const offeringId = await this.ctx.assertOffering(profileId, input.serviceOfferingId ?? null)

        if (key) {
            const existing = await this.ctx.db.fieldJobInspectionTemplate.findUnique({
                where: { profileId_idempotencyKey: { profileId, idempotencyKey: key } },
            })
            if (existing) return { template: toTemplateRecord(existing as RawTemplate), replayed: true }
        }

        try {
            const row = await this.ctx.db.fieldJobInspectionTemplate.create({
                data: {
                    profileId,
                    name,
                    description: input.description?.trim() || null,
                    serviceOfferingId: offeringId,
                    ...(key ? { idempotencyKey: key } : {}),
                },
            })
            return { template: toTemplateRecord(row as RawTemplate), replayed: false }
        } catch (error) {
            this.ctx.rethrowUnique(error, "A checklist with that name already exists")
        }
    }

    async get(workspaceId: string, templateId: string): Promise<{ template: TemplateRecord; items: readonly TemplateItemRecord[] }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const template = await this.ownedTemplate(profileId, templateId)
        const items = await this.ctx.db.fieldJobInspectionTemplateItem.findMany({
            where: { templateId: template.id },
            orderBy: { position: "asc" },
        })
        return {
            template: toTemplateRecord(template as RawTemplate),
            items: Object.freeze(items.map((r) => toTemplateItemRecord(r as RawTemplateItem))),
        }
    }

    /**
     * Appends a line. `position` defaults to the end, so an owner adding lines in order never has
     * to think about it; an explicit duplicate position is a conflict because the database says so.
     *
     * A MEASUREMENT without a unit is refused HERE as well as by
     * FieldJobInspectionTemplateItem_measurement_has_unit — the constraint is the backstop, not the
     * primary guard, so the caller gets a sentence instead of a constraint name.
     */
    async addItem(
        workspaceId: string,
        templateId: string,
        input: Readonly<{
            label: string
            kind?: InspectionItemKindValue | null
            guidance?: string | null
            required?: boolean | null
            unit?: string | null
            expectedMin?: DecimalInput
            expectedMax?: DecimalInput
            position?: number | null
        }>,
    ): Promise<TemplateItemRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const template = await this.ownedTemplate(profileId, templateId)
        const label = this.ctx.required(input.label, "label")
        const kind: InspectionItemKindValue = input.kind ?? "CHECK"
        const unit = input.unit?.trim() || null

        if (kind === "MEASUREMENT" && !unit) {
            this.ctx.conflict("A measurement line needs a unit; a number with no unit is not a reading")
        }
        const min = normaliseDecimal(input.expectedMin, "expectedMin")
        const max = normaliseDecimal(input.expectedMax, "expectedMax")
        if (min !== null && max !== null && Number(max) < Number(min)) {
            this.ctx.conflict("expectedMax cannot be below expectedMin")
        }
        if (kind !== "MEASUREMENT" && (min !== null || max !== null)) {
            this.ctx.conflict("Only a measurement line can carry an expected range")
        }

        const position =
            input.position === null || input.position === undefined
                ? ((
                      await this.ctx.db.fieldJobInspectionTemplateItem.aggregate({
                          where: { templateId: template.id },
                          _max: { position: true },
                      })
                  )._max.position ?? -1) + 1
                : input.position

        if (!Number.isInteger(position) || position < 0) {
            throw new PersistenceError("BAD_REQUEST", "position must be a non-negative integer", { field: "position" })
        }

        try {
            const row = await this.ctx.db.fieldJobInspectionTemplateItem.create({
                data: {
                    templateId: template.id,
                    position,
                    kind,
                    label,
                    guidance: input.guidance?.trim() || null,
                    required: input.required ?? true,
                    unit,
                    expectedMin: min,
                    expectedMax: max,
                },
            })
            return toTemplateItemRecord(row as RawTemplateItem)
        } catch (error) {
            this.ctx.rethrowUnique(error, `This checklist already has a line at position ${position}`)
        }
    }

    /**
     * Renames a checklist or retires it. `revision` is bumped on every edit as owner-visible
     * bookkeeping — it is NOT a version anybody can check out, because history is preserved by
     * snapshotting lines onto the inspection instead.
     */
    async update(
        workspaceId: string,
        templateId: string,
        input: Readonly<{ name?: string | null; description?: string | null; isActive?: boolean | null }>,
    ): Promise<TemplateRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const template = await this.ownedTemplate(profileId, templateId)
        const name = input.name === null || input.name === undefined ? null : this.ctx.required(input.name, "name")

        try {
            const row = await this.ctx.db.fieldJobInspectionTemplate.update({
                where: { id: template.id },
                data: {
                    ...(name ? { name } : {}),
                    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
                    ...(input.isActive !== undefined && input.isActive !== null ? { isActive: input.isActive } : {}),
                    revision: { increment: 1 },
                },
            })
            return toTemplateRecord(row as RawTemplate)
        } catch (error) {
            this.ctx.rethrowUnique(error, "A checklist with that name already exists")
        }
    }

    private async ownedTemplate(profileId: string, templateId: string) {
        const id = this.ctx.required(templateId, "templateId")
        const row = await this.ctx.db.fieldJobInspectionTemplate.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.ctx.denied()
        return row
    }
}

function normaliseDecimal(value: DecimalInput | undefined, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    const n = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(n)) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be a finite number`, { field })
    }
    return String(n)
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export class FieldJobInspectionService {
    constructor(
        private readonly ctx: FieldJobContext,
        /**
         * The existing inventory engine. Composed, never reimplemented: a part leaves stock
         * through InventoryService with its own locking, non-negative CHECK constraints and
         * append-only movement ledger, or it does not leave stock at all.
         */
        private readonly inventory: InventoryService,
    ) {}

    async list(
        workspaceId: string,
        filter?: Readonly<{ status?: InspectionStatusValue | null; jobId?: string | null }>,
    ): Promise<readonly InspectionRecord[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        // A jobId filter is authorized before it is used, so it cannot be used to discover that
        // another tenant's job exists.
        const jobId = filter?.jobId?.trim() ? (await this.ctx.ownedJob(profileId, filter.jobId)).id : null

        const rows = await this.ctx.db.fieldJobInspection.findMany({
            where: {
                profileId,
                ...(filter?.status ? { status: filter.status } : {}),
                ...(jobId ? { jobId } : {}),
            },
            orderBy: { createdAt: "desc" },
        })
        for (const row of rows) if (row.profileId !== profileId) this.ctx.denied()

        const pending = await this.pendingRequiredFor(rows.map((r) => r.id))
        return Object.freeze(rows.map((r) => toInspectionRecord(r as RawInspection, pending.get(r.id) ?? 0)))
    }

    async get(
        workspaceId: string,
        inspectionId: string,
    ): Promise<{ inspection: InspectionRecord; items: readonly ItemRecord[]; parts: readonly PartRecord[] }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const row = await this.ownedInspection(profileId, inspectionId)
        const [items, parts] = await Promise.all([
            this.ctx.db.fieldJobInspectionItem.findMany({ where: { inspectionId: row.id }, orderBy: { position: "asc" } }),
            this.ctx.db.fieldJobInspectionPart.findMany({ where: { inspectionId: row.id }, orderBy: { createdAt: "asc" } }),
        ])
        const pendingRequired = (items as RawItem[]).filter(
            (i) => i.required && UNANSWERED_ITEM_RESULTS.includes(i.result),
        ).length
        return {
            inspection: toInspectionRecord(row as RawInspection, pendingRequired),
            items: Object.freeze((items as RawItem[]).map(toItemRecord)),
            parts: Object.freeze((parts as RawPart[]).map(toPartRecord)),
        }
    }

    /**
     * Raises an inspection on a job, optionally from a template.
     *
     * SNAPSHOT, not reference: the template's lines are COPIED into FieldJobInspectionItem rows
     * inside the same transaction, so editing the template afterwards never rewrites what this
     * inspection asked. `templateItemId` is kept for provenance only.
     *
     * An ASSET line is seeded with the template line's label as its `assetLabel`, because
     * FieldJobInspectionItem_asset_has_identity requires every ASSET row to name its equipment
     * from the moment it exists. The owner then refines it with the actual serial. Without this an
     * ASSET template line could not be snapshotted at all.
     *
     * Idempotent on (jobId, idempotencyKey). At most one OPEN inspection per job, enforced here
     * with a sentence and by the partial unique index FieldJobInspection_one_open_per_job.
     */
    async create(
        workspaceId: string,
        input: Readonly<{
            jobId: string
            reference: string
            templateId?: string | null
            assignmentId?: string | null
            idempotencyKey?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<{ inspection: InspectionRecord; items: readonly ItemRecord[]; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const job = await this.ctx.ownedJob(profileId, input.jobId)
        const reference = this.ctx.required(input.reference, "reference")
        const key = input.idempotencyKey?.trim() || null

        const templateId = input.templateId?.trim() || null
        let templateItems: RawTemplateItem[] = []
        if (templateId) {
            const template = await this.ctx.db.fieldJobInspectionTemplate.findUnique({ where: { id: templateId } })
            if (!template || template.profileId !== profileId) this.ctx.denied()
            templateItems = (await this.ctx.db.fieldJobInspectionTemplateItem.findMany({
                where: { templateId: template.id },
                orderBy: { position: "asc" },
            })) as RawTemplateItem[]
        }

        // An assignment may only be cited if it belongs to THIS job. Citing another job's
        // assignment would attribute the visit to the wrong technician.
        const assignmentId = input.assignmentId?.trim() || null
        if (assignmentId) {
            const assignment = await this.ctx.db.fieldJobAssignment.findUnique({
                where: { id: assignmentId },
                select: { id: true, jobId: true },
            })
            if (!assignment || assignment.jobId !== job.id) this.ctx.denied()
        }

        if (key) {
            const replay = await this.ctx.db.fieldJobInspection.findUnique({
                where: { jobId_idempotencyKey: { jobId: job.id, idempotencyKey: key } },
            })
            if (replay) {
                const items = (await this.ctx.db.fieldJobInspectionItem.findMany({
                    where: { inspectionId: replay.id },
                    orderBy: { position: "asc" },
                })) as RawItem[]
                const pendingRequired = items.filter((i) => i.required && UNANSWERED_ITEM_RESULTS.includes(i.result)).length
                return {
                    inspection: toInspectionRecord(replay as RawInspection, pendingRequired),
                    items: Object.freeze(items.map(toItemRecord)),
                    replayed: true,
                }
            }
        }

        try {
            const out = await this.ctx.db.$transaction(async (tx) => {
                const open = await tx.fieldJobInspection.findFirst({
                    where: { jobId: job.id, status: { in: [...OPEN_INSPECTION_STATUSES] } },
                    select: { id: true, status: true, reference: true },
                })
                if (open) {
                    this.ctx.conflict(
                        `Inspection ${open.reference} on this job is still ${open.status.toLowerCase().replace("_", " ")}; complete or cancel it first`,
                        { openInspectionId: open.id, openInspectionReference: open.reference },
                    )
                }

                const created = await tx.fieldJobInspection.create({
                    data: {
                        jobId: job.id,
                        profileId,
                        reference,
                        ...(templateId ? { templateId } : {}),
                        ...(assignmentId ? { assignmentId } : {}),
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                })

                if (templateItems.length > 0) {
                    await tx.fieldJobInspectionItem.createMany({
                        data: templateItems.map((t) => ({
                            inspectionId: created.id,
                            templateItemId: t.id,
                            position: t.position,
                            kind: t.kind,
                            label: t.label,
                            guidance: t.guidance,
                            required: t.required,
                            unit: t.unit,
                            expectedMin: t.expectedMin === null ? null : t.expectedMin.toString(),
                            expectedMax: t.expectedMax === null ? null : t.expectedMax.toString(),
                            // See the method comment: an ASSET row must name its equipment from
                            // the moment it exists, so the checklist line's label seeds it.
                            ...(t.kind === "ASSET" ? { assetLabel: t.label } : {}),
                        })),
                    })
                }

                await this.ctx.appendEvent(tx, job.id, "CREATED", "inspection", created.id, null, created.status, actor, {
                    reference,
                    templateId,
                    lineCount: templateItems.length,
                })

                const items = (await tx.fieldJobInspectionItem.findMany({
                    where: { inspectionId: created.id },
                    orderBy: { position: "asc" },
                })) as RawItem[]
                return { created, items }
            })

            const pendingRequired = out.items.filter((i) => i.required && UNANSWERED_ITEM_RESULTS.includes(i.result)).length
            return {
                inspection: toInspectionRecord(out.created as RawInspection, pendingRequired),
                items: Object.freeze(out.items.map(toItemRecord)),
                replayed: false,
            }
        } catch (error) {
            this.ctx.rethrowUnique(error, "An inspection with that reference already exists, or this job already has an open one")
        }
    }

    /**
     * Moves the inspection. The side conditions are the point, and each one is a named list in
     * inspection-lifecycle.ts rather than an inline `if`:
     *   - COMPLETED needs an outcome AND non-blank completion notes
     *   - CANCELLED needs a reason
     *   - SUBMITTED and COMPLETED need every REQUIRED line answered; PENDING blocks,
     *     NOT_APPLICABLE does not, and the refusal carries the count so the owner sees how many
     */
    async transition(
        workspaceId: string,
        inspectionId: string,
        input: Readonly<{
            status: InspectionStatusValue
            outcome?: InspectionOutcomeValue | null
            completionNotes?: string | null
            cancelReason?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<InspectionRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const id = (await this.ownedInspection(profileId, inspectionId)).id
        const to = input.status

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockInspection(tx, id, profileId)
            if (inspectionFlow.isTerminal(current.status)) {
                this.ctx.conflict(`This inspection is already ${current.status.toLowerCase()} and cannot change`)
            }
            if (!inspectionFlow.can(current.status, to)) {
                this.ctx.conflict(
                    `Cannot move a ${current.status.toLowerCase().replace("_", " ")} inspection to ${to.toLowerCase().replace("_", " ")}`,
                )
            }

            const outcome = input.outcome ?? null
            const notes = input.completionNotes?.trim() || null
            const reason = input.cancelReason?.trim() || null

            if (OUTCOME_REQUIRED_STATUSES.includes(to) && !outcome) {
                this.ctx.conflict("Completing an inspection needs an outcome; a finished inspection that says nothing is not a record")
            }
            if (NOTES_REQUIRED_STATUSES.includes(to) && !notes) {
                this.ctx.conflict("Completing an inspection needs completion notes")
            }
            if (REASON_REQUIRED_STATUSES.includes(to) && !reason) {
                this.ctx.conflict("Cancelling an inspection needs a reason")
            }
            if (ALL_REQUIRED_ANSWERED_STATUSES.includes(to)) {
                const pendingRequired = await tx.fieldJobInspectionItem.count({
                    where: { inspectionId: id, required: true, result: { in: [...UNANSWERED_ITEM_RESULTS] } },
                })
                if (pendingRequired > 0) {
                    this.ctx.conflict(
                        `${pendingRequired} required line${pendingRequired === 1 ? " is" : "s are"} still unanswered`,
                        { pendingRequired },
                    )
                }
            }

            const stamp = INSPECTION_TIMESTAMP_FIELD[to]
            const updated = await tx.fieldJobInspection.update({
                where: { id },
                data: {
                    status: to,
                    ...(stamp ? { [stamp]: new Date() } : {}),
                    ...(to === "COMPLETED" ? { outcome, completionNotes: notes } : {}),
                    ...(to === "CANCELLED" ? { cancelReason: reason } : {}),
                },
            })
            await this.ctx.appendEvent(
                tx,
                updated.jobId,
                "STATUS",
                "inspection",
                id,
                current.status,
                to,
                actor,
                to === "COMPLETED" ? { outcome } : reason ? { reason } : undefined,
            )
            const pendingRequired = await tx.fieldJobInspectionItem.count({
                where: { inspectionId: id, required: true, result: { in: [...UNANSWERED_ITEM_RESULTS] } },
            })
            return { updated, pendingRequired }
        })
        return toInspectionRecord(row.updated as RawInspection, row.pendingRequired)
    }

    /**
     * Records one line. Only while the inspection is OPEN FOR RECORDING — DRAFT or IN_PROGRESS
     * per RECORDABLE_STATUSES. A SUBMITTED inspection must be sent back to IN_PROGRESS first,
     * which is a legal transition precisely so the office can ask for more detail.
     *
     * A FAIL must say why and an ASSET line must name its equipment; both are refused here and
     * independently by CHECK constraints.
     */
    async recordItem(
        workspaceId: string,
        inspectionId: string,
        itemId: string,
        input: Readonly<{
            result?: InspectionItemResultValue | null
            notes?: string | null
            measuredValue?: DecimalInput
            assetLabel?: string | null
            assetSerial?: string | null
            assetLocationHint?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<ItemRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const inspection = await this.ownedInspection(profileId, inspectionId)
        const iid = this.ctx.required(itemId, "itemId")

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockInspection(tx, inspection.id, profileId)
            if (!RECORDABLE_STATUSES.includes(current.status)) {
                this.ctx.conflict(
                    `Nothing can be recorded on a ${current.status.toLowerCase().replace("_", " ")} inspection`,
                    { status: current.status },
                )
            }

            const existing = (await tx.fieldJobInspectionItem.findUnique({ where: { id: iid } })) as RawItem | null
            if (!existing || existing.inspectionId !== inspection.id) this.ctx.denied()

            const result = input.result ?? existing.result
            const notes = input.notes === undefined ? existing.notes : input.notes?.trim() || null
            const assetLabel =
                input.assetLabel === undefined ? existing.assetLabel : input.assetLabel?.trim() || null

            if (NOTES_REQUIRED_ITEM_RESULTS.includes(result) && !notes) {
                this.ctx.conflict("A failed line must say why")
            }
            if (existing.kind === "ASSET" && !assetLabel) {
                this.ctx.conflict("An equipment check must name the equipment")
            }
            const measured = input.measuredValue === undefined ? undefined : normaliseDecimal(input.measuredValue, "measuredValue")
            if (measured !== undefined && measured !== null && existing.kind !== "MEASUREMENT") {
                this.ctx.conflict("Only a measurement line can carry a reading")
            }

            const updated = await tx.fieldJobInspectionItem.update({
                where: { id: iid },
                data: {
                    result,
                    notes,
                    ...(input.assetLabel !== undefined ? { assetLabel } : {}),
                    ...(input.assetSerial !== undefined ? { assetSerial: input.assetSerial?.trim() || null } : {}),
                    ...(input.assetLocationHint !== undefined
                        ? { assetLocationHint: input.assetLocationHint?.trim() || null }
                        : {}),
                    ...(measured !== undefined ? { measuredValue: measured } : {}),
                    // Stamped whenever an answer is given, so "when was this looked at" is
                    // answerable. Cleared again if the line is returned to PENDING.
                    recordedAt: UNANSWERED_ITEM_RESULTS.includes(result) ? null : new Date(),
                },
            })
            await this.ctx.appendEvent(
                tx,
                inspection.jobId,
                "NOTE",
                "inspectionItem",
                iid,
                existing.result,
                result,
                actor,
                { label: existing.label, position: existing.position },
            )
            return updated
        })
        return toItemRecord(row as RawItem)
    }

    /**
     * Records a part used, and OPTIONALLY moves stock.
     *
     * `consumeStock` defaults to FALSE. Recording a part never silently moves stock: an owner
     * noting "we fitted a valve from the van" is a different act from deducting that valve from a
     * counted depot, and conflating them would quietly invent or destroy inventory.
     *
     * When true, the deduction goes through InventoryService.applyMovement as an ADJUSTMENT with a
     * negative quantity — NOT a CONSUME. That is deliberate and the inventory engine requires it:
     * CONSUME only ever arises from settling a reservation, and there is no reservation behind a
     * part taken off a van, so accepting CONSUME here would move the reserved balance with no hold
     * behind it. The engine's own non-negative and not-below-reserved checks then produce the 409.
     *
     * ORDER OF OPERATIONS, and the window it leaves. The part line is written FIRST, so the
     * database's boundary trigger has already validated tenant, depot and existence before any
     * stock moves; then the movement is applied with an idempotency key DERIVED FROM THE PART ID;
     * then the movement id is stored on the line. If the process dies mid-way the visible result is
     * a part line with no movement — recorded, stock not moved — which is honest and recoverable,
     * rather than stock that vanished with nothing pointing at it. A retry with the same
     * idempotencyKey finds the part, sees the missing movement and finishes the job; because the
     * movement key is the part id, it cannot deduct twice.
     */
    async addPart(
        workspaceId: string,
        inspectionId: string,
        input: Readonly<{
            inventoryItemId: string
            qty: number
            unitCostCents?: number | null
            currency?: string | null
            notes?: string | null
            consumeStock?: boolean | null
            idempotencyKey?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<{ part: PartRecord; stock: StockRecord | null; replayed: boolean }> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const inspection = await this.ownedInspection(profileId, inspectionId)
        const key = input.idempotencyKey?.trim() || null
        const consume = input.consumeStock === true

        if (!Number.isInteger(input.qty) || input.qty <= 0) {
            throw new PersistenceError("BAD_REQUEST", "qty must be a positive integer; using zero of a part is not using a part", {
                field: "qty",
            })
        }
        if (input.unitCostCents !== null && input.unitCostCents !== undefined) {
            if (!Number.isInteger(input.unitCostCents) || input.unitCostCents < 0) {
                throw new PersistenceError("BAD_REQUEST", "unitCostCents must be a non-negative integer", {
                    field: "unitCostCents",
                })
            }
        }

        /*
         * A foreign or nonexistent stock record is 403 through the inventory engine's own
         * `denied()`, NOT 409. This deviates from the written contract on purpose: making a
         * foreign stock record answer 409 while a nonexistent one answers 403 would turn this
         * endpoint into an oracle for which stock records exist, defeating the non-enumeration
         * property the whole platform is built on. The genuine CONFLICT is the DEPOT mismatch
         * below, which only arises for stock the caller demonstrably owns.
         */
        const stock = await this.inventory.get(workspaceId, this.ctx.required(input.inventoryItemId, "inventoryItemId"))

        const job = await this.ctx.db.fieldJob.findUniqueOrThrow({
            where: { id: inspection.jobId },
            select: { originLocationId: true, reference: true },
        })
        if (job.originLocationId && stock.locationId !== job.originLocationId) {
            this.ctx.conflict(
                "That stock is held at a different location from the depot this job is dispatched from",
                { stockLocationId: stock.locationId, jobOriginLocationId: job.originLocationId },
            )
        }

        // Idempotent replay. A part that exists but never moved stock, when stock was asked for,
        // is finished rather than duplicated - see the method comment.
        let part: RawPart | null = null
        let replayed = false
        if (key) {
            const existing = (await this.ctx.db.fieldJobInspectionPart.findUnique({
                where: { inspectionId_idempotencyKey: { inspectionId: inspection.id, idempotencyKey: key } },
            })) as RawPart | null
            if (existing) {
                part = existing
                replayed = true
            }
        }

        if (!part) {
            part = (await this.ctx.db.$transaction(async (tx) => {
                const current = await this.lockInspection(tx, inspection.id, profileId)
                if (!RECORDABLE_STATUSES.includes(current.status)) {
                    this.ctx.conflict(
                        `Parts cannot be recorded on a ${current.status.toLowerCase().replace("_", " ")} inspection`,
                        { status: current.status },
                    )
                }
                const created = await tx.fieldJobInspectionPart.create({
                    data: {
                        inspectionId: inspection.id,
                        inventoryItemId: stock.id,
                        qty: input.qty,
                        unitCostCents: input.unitCostCents ?? null,
                        ...(input.currency?.trim() ? { currency: input.currency.trim() } : {}),
                        notes: input.notes?.trim() || null,
                        ...(key ? { idempotencyKey: key } : {}),
                    },
                })
                await this.ctx.appendEvent(
                    tx,
                    inspection.jobId,
                    "NOTE",
                    "inspectionPart",
                    created.id,
                    null,
                    "RECORDED",
                    actor,
                    { inventoryItemId: stock.id, qty: input.qty, stockMoved: false },
                )
                return created
            })) as RawPart
        }

        if (!consume || part.movementId) {
            return { part: toPartRecord(part), stock: null, replayed }
        }

        const movementKey = `inspectionPart:${part.id}`
        const after = await this.inventory.applyMovement(
            workspaceId,
            stock.id,
            {
                kind: "ADJUSTMENT",
                qty: -input.qty,
                reason: `Inspection ${inspection.reference} on job ${job.reference}`,
                idempotencyKey: movementKey,
            },
            inventoryActor(actor),
        )
        const movement = await this.ctx.db.inventoryMovement.findUnique({
            where: { itemId_idempotencyKey: { itemId: stock.id, idempotencyKey: movementKey } },
            select: { id: true },
        })
        const settled = (await this.ctx.db.$transaction(async (tx) => {
            const row = await tx.fieldJobInspectionPart.update({
                where: { id: part!.id },
                data: { ...(movement ? { movementId: movement.id } : {}) },
            })
            await this.ctx.appendEvent(
                tx,
                inspection.jobId,
                "NOTE",
                "inspectionPart",
                row.id,
                "RECORDED",
                "STOCK_MOVED",
                actor,
                { inventoryItemId: stock.id, qty: input.qty, movementId: movement?.id ?? null, stockMoved: true },
            )
            return row
        })) as RawPart

        return { part: toPartRecord(settled), stock: after, replayed }
    }

    /**
     * Records that the owner considers this inspection billable and has passed it on.
     *
     * NOTHING IS INVOICED AND NO MONEY MOVES. No invoice row is written, no Payment row is
     * written, no provider is called. Any state other than NOT_READY requires the inspection to be
     * COMPLETED, refused here and independently by
     * FieldJobInspection_handoff_requires_completion.
     */
    async setHandoff(
        workspaceId: string,
        inspectionId: string,
        input: Readonly<{
            invoiceHandoffState: InvoiceHandoffStateValue
            invoiceHandoffReference?: string | null
            invoiceHandoffNote?: string | null
        }>,
        actor: FieldJobActor,
    ): Promise<InspectionRecord> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.update")
        const inspection = await this.ownedInspection(profileId, inspectionId)
        const to = input.invoiceHandoffState

        const row = await this.ctx.db.$transaction(async (tx) => {
            const current = await this.lockInspectionHandoff(tx, inspection.id, profileId)
            if (handoffFlow.isTerminal(current.invoiceHandoffState)) {
                this.ctx.conflict(
                    `This handoff is already ${current.invoiceHandoffState.toLowerCase().replace("_", " ")} and cannot change`,
                )
            }
            if (!handoffFlow.can(current.invoiceHandoffState, to)) {
                this.ctx.conflict(
                    `Cannot move a ${current.invoiceHandoffState.toLowerCase().replace("_", " ")} handoff to ${to.toLowerCase().replace("_", " ")}`,
                )
            }
            if (HANDOFF_STATES_REQUIRING_COMPLETION.includes(to) && current.status !== "COMPLETED") {
                this.ctx.conflict(
                    "An inspection must be completed before its billing can be handed off",
                    { status: current.status },
                )
            }

            const updated = await tx.fieldJobInspection.update({
                where: { id: inspection.id },
                data: {
                    invoiceHandoffState: to,
                    ...(HANDOFF_STATES_REQUIRING_TIMESTAMP.includes(to) ? { invoiceHandoffAt: new Date() } : {}),
                    ...(input.invoiceHandoffReference !== undefined
                        ? { invoiceHandoffReference: input.invoiceHandoffReference?.trim() || null }
                        : {}),
                    ...(input.invoiceHandoffNote !== undefined
                        ? { invoiceHandoffNote: input.invoiceHandoffNote?.trim() || null }
                        : {}),
                },
            })
            await this.ctx.appendEvent(
                tx,
                updated.jobId,
                "STATUS",
                "inspectionHandoff",
                inspection.id,
                current.invoiceHandoffState,
                to,
                actor,
                { invoiced: false },
            )
            return updated
        })
        const pendingRequired = await this.ctx.db.fieldJobInspectionItem.count({
            where: { inspectionId: inspection.id, required: true, result: { in: [...UNANSWERED_ITEM_RESULTS] } },
        })
        return toInspectionRecord(row as RawInspection, pendingRequired)
    }

    /**
     * This inspection's slice of the SHARED FieldJobEvent ledger.
     *
     * Filtered by subject IDENTITY, not merely by subjectType: an item event carries the item's id,
     * so filtering on subjectType alone would return every inspection's lines on the same job.
     */
    async timeline(workspaceId: string, inspectionId: string): Promise<readonly InspectionEvent[]> {
        const profileId = await this.ctx.requireProfile(workspaceId, "profile.read")
        const inspection = await this.ownedInspection(profileId, inspectionId)
        const [items, parts] = await Promise.all([
            this.ctx.db.fieldJobInspectionItem.findMany({ where: { inspectionId: inspection.id }, select: { id: true } }),
            this.ctx.db.fieldJobInspectionPart.findMany({ where: { inspectionId: inspection.id }, select: { id: true } }),
        ])
        const subjectIds = [inspection.id, ...items.map((i) => i.id), ...parts.map((p) => p.id)]

        const rows = await this.ctx.db.fieldJobEvent.findMany({
            where: {
                jobId: inspection.jobId,
                subjectType: { in: [...INSPECTION_EVENT_SUBJECTS] },
                subjectId: { in: subjectIds },
            },
            orderBy: { seq: "asc" },
        })
        return Object.freeze(
            rows.map((r) =>
                Object.freeze({
                    id: r.id,
                    seq: String(r.seq),
                    kind: r.kind as string,
                    subjectType: r.subjectType,
                    subjectId: r.subjectId,
                    from: r.from,
                    to: r.to,
                    actor: r.actor as string,
                    actorId: r.actorId,
                    at: r.at,
                    metadata: r.metadata,
                }),
            ),
        )
    }

    // ---- internals -------------------------------------------------------

    /** How many required lines are unanswered, for many inspections at once. */
    private async pendingRequiredFor(ids: readonly string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>()
        if (ids.length === 0) return out
        const grouped = await this.ctx.db.fieldJobInspectionItem.groupBy({
            by: ["inspectionId"],
            where: { inspectionId: { in: [...ids] }, required: true, result: { in: [...UNANSWERED_ITEM_RESULTS] } },
            _count: { _all: true },
        })
        for (const g of grouped) out.set(g.inspectionId, g._count._all)
        return out
    }

    private async ownedInspection(profileId: string, inspectionId: string) {
        const id = this.ctx.required(inspectionId, "inspectionId")
        const row = await this.ctx.db.fieldJobInspection.findUnique({ where: { id } })
        if (!row || row.profileId !== profileId) this.ctx.denied()
        return row
    }

    private async lockInspection(tx: Tx, inspectionId: string, profileId: string) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; profileId: string; status: InspectionStatusValue }>>(
            `select "id","profileId","status" from "FieldJobInspection" where "id" = $1 for update`,
            inspectionId,
        )
        const current = rows[0]
        if (!current || current.profileId !== profileId) this.ctx.denied()
        return current
    }

    private async lockInspectionHandoff(tx: Tx, inspectionId: string, profileId: string) {
        const rows = await tx.$queryRawUnsafe<
            Array<{
                id: string
                profileId: string
                status: InspectionStatusValue
                invoiceHandoffState: InvoiceHandoffStateValue
            }>
        >(
            `select "id","profileId","status","invoiceHandoffState" from "FieldJobInspection" where "id" = $1 for update`,
            inspectionId,
        )
        const current = rows[0]
        if (!current || current.profileId !== profileId) this.ctx.denied()
        return current
    }
}
