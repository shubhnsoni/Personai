import { PersistenceError } from "@/lib/persistence/errors"

import type { FieldJobIntakeService, FieldJobService } from "./engine"
import type { FieldJobInspectionService, FieldJobInspectionTemplateService } from "./inspection"
import {
    handoffFlow,
    inspectionFlow,
    isInspectionItemKind,
    isInspectionItemResult,
    isInspectionOutcome,
} from "./inspection-lifecycle"
import {
    JOB_PRIORITIES,
    assignmentFlow,
    isAssignmentRole,
    isJobPriority,
    jobFlow,
    requestFlow,
    type AssignmentRoleValue,
    type JobPriorityValue,
} from "./lifecycle"
import type { FieldJobActor } from "./shared"

/**
 * HTTP boundary for the fieldJobs surface.
 *
 * The envelope mirrors the cases and cohorts surfaces — { ok: true, data } / { ok: false, error:
 * { code, message } } with the same status map — and is restated rather than imported for the same
 * reason theirs are: the shared PlatformService belongs to another package. The route harness
 * asserts the shapes agree, so drift is caught by a test rather than by a reader.
 *
 * THE ACTOR IS THE ONE THING THIS SURFACE DOES DIFFERENTLY. Cases and cohorts derive a fixed
 * STAFF actor and offer no way to name yourself. Field jobs genuinely have two: an office staffer
 * moving a job card on a technician's behalf is a different fact from the technician moving it, and
 * a job history that cannot tell them apart is worth less. So a write may carry
 * `actorType: "TECHNICIAN"`, and nothing else — CUSTOMER and SYSTEM are not accepted from a
 * request, and actorId is never taken from the caller.
 */

type JsonObject = Record<string, unknown>

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status })
}
function success(data: unknown, status = 200): Response {
    return json({ ok: true, data }, status)
}
function failure(error: unknown): Response {
    if (error instanceof PersistenceError) {
        return json(
            { ok: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
            error.status,
        )
    }
    return json(
        { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Field jobs are temporarily unavailable" } },
        503,
    )
}

async function body(request: Request): Promise<JsonObject> {
    let value: unknown
    try {
        value = await request.json()
    } catch {
        throw new PersistenceError("BAD_REQUEST", "Request body must contain valid JSON")
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new PersistenceError("BAD_REQUEST", "A JSON object body is required")
    }
    return value as JsonObject
}

function str(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
    }
    return value.trim()
}
function nullableStr(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string") throw new PersistenceError("BAD_REQUEST", `${field} must be a string or null`, { field })
    return value.trim() || null
}
function optInt(value: unknown, field: string): number | null {
    if (value === null || value === undefined || value === "") return null
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}
function int(value: unknown, field: string): number {
    if (!Number.isInteger(value)) throw new PersistenceError("BAD_REQUEST", `${field} must be an integer`, { field })
    return value as number
}
function optDate(value: unknown, field: string): Date | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        throw new PersistenceError("BAD_REQUEST", `${field} must be an ISO-compatible timestamp`, { field })
    }
    return new Date(value)
}

/** Validates a value against the owning flow, so an unknown value is 400 and not 409. */
function vocab<T extends string>(value: unknown, guard: (v: unknown) => v is T, label: string, field: string): T {
    const raw = str(value, field)
    if (!guard(raw)) {
        throw new PersistenceError("BAD_REQUEST", `${field} is not a recognised ${label} value`, { field })
    }
    return raw
}
function optPriority(value: unknown): JobPriorityValue | null {
    if (value === null || value === undefined || value === "") return null
    if (!isJobPriority(value)) {
        throw new PersistenceError("BAD_REQUEST", `priority must be one of ${JOB_PRIORITIES.join(", ")}`, { field: "priority" })
    }
    return value
}
function optRole(value: unknown): AssignmentRoleValue | null {
    if (value === null || value === undefined || value === "") return null
    if (!isAssignmentRole(value)) {
        throw new PersistenceError("BAD_REQUEST", "role must be LEAD or HELPER", { field: "role" })
    }
    return value
}

/**
 * A Prisma Decimal, detected structurally. `toFixed` is the discriminator because a JSON metadata
 * object or an array does not have one, and importing the Decimal class here to use `instanceof`
 * would drag the runtime into a module the client can import.
 */
function isDecimal(value: unknown): value is { toString(): string } {
    return typeof value === "object" && value !== null && typeof (value as { toFixed?: unknown }).toFixed === "function"
}

/**
 * Dates become ISO strings; BigInt and Decimal become STRINGS.
 *
 * Decimal is serialised as a string deliberately: `measuredValue`, `expectedMin` and `expectedMax`
 * are Decimal(14,4), and turning them into JSON numbers would silently lose precision on exactly
 * the readings an inspection exists to record. Consumers parse them for display.
 */
function serialise(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
        out[k] =
            v instanceof Date
                ? v.toISOString()
                : typeof v === "bigint"
                  ? String(v)
                  : isDecimal(v)
                    ? v.toString()
                    : v
    }
    return out
}
function serialiseAll(rows: readonly unknown[]): Array<Record<string, unknown>> {
    return rows.map((r) => serialise({ ...(r as Record<string, unknown>) }))
}
function param(request: Request, name: string): string {
    return str(new URL(request.url).searchParams.get(name), name)
}

/** An optional boolean. Absent means "not stated"; a non-boolean is a 400, never a silent false. */
function optBool(value: unknown, field: string): boolean | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value !== "boolean") {
        throw new PersistenceError("BAD_REQUEST", `${field} must be a boolean`, { field })
    }
    return value
}

/**
 * An optional Decimal input. Accepts a number or a numeric string and hands the engine a string, so
 * a reading typed by a human never round-trips through a float on the way in either.
 */
function optDecimal(value: unknown, field: string): number | string | null {
    if (value === null || value === undefined || value === "") return null
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new PersistenceError("BAD_REQUEST", `${field} must be a finite number`, { field })
        }
        return value
    }
    if (typeof value === "string") {
        if (!Number.isFinite(Number(value))) {
            throw new PersistenceError("BAD_REQUEST", `${field} must be a numeric value`, { field })
        }
        return value
    }
    throw new PersistenceError("BAD_REQUEST", `${field} must be a number or a numeric string`, { field })
}

export class FieldJobApiService {
    constructor(
        private readonly intake: FieldJobIntakeService,
        private readonly jobs: FieldJobService,
        private readonly templates: FieldJobInspectionTemplateService,
        private readonly inspections: FieldJobInspectionService,
    ) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch(failure)
    }

    /**
     * The only actor field a request may set is the TYPE, and only to TECHNICIAN. actorId is never
     * taken from the caller, and CUSTOMER and SYSTEM cannot be claimed over HTTP - a request
     * asserting it came from the system would be exactly the kind of thing an audit trail must not
     * believe.
     */
    private actor(input?: JsonObject): FieldJobActor {
        if (input && input.actorType === "TECHNICIAN") return { actorType: "TECHNICIAN", actorId: null }
        if (input && input.actorType !== undefined && input.actorType !== "STAFF") {
            throw new PersistenceError("BAD_REQUEST", "actorType may only be STAFF or TECHNICIAN", { field: "actorType" })
        }
        return { actorType: "STAFF", actorId: null }
    }

    // ---- intake ----------------------------------------------------------

    listRequests(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ requests: serialiseAll(await this.intake.list(param(request, "workspaceId"))) }),
        )
    }

    createRequest(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.intake.create(str(input.workspaceId, "workspaceId"), {
                source: str(input.source, "source"),
                summary: str(input.summary, "summary"),
                serviceOfferingId: nullableStr(input.serviceOfferingId, "serviceOfferingId"),
                requesterName: nullableStr(input.requesterName, "requesterName"),
                requesterEmail: nullableStr(input.requesterEmail, "requesterEmail"),
                requesterPhone: nullableStr(input.requesterPhone, "requesterPhone"),
                siteAddress: nullableStr(input.siteAddress, "siteAddress"),
                idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
            })
            return success(
                { request: serialise({ ...result.request }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionRequest(requestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.intake.transition(
                str(input.workspaceId, "workspaceId"),
                requestId,
                vocab(input.status, requestFlow.is, "request status", "status"),
                nullableStr(input.reason, "reason"),
            )
            return success({ request: serialise({ ...row }) })
        })
    }

    quoteRequest(requestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.intake.quote(str(input.workspaceId, "workspaceId"), requestId, {
                estimateCents: int(input.estimateCents, "estimateCents"),
                currency: nullableStr(input.currency, "currency"),
            })
            return success({ request: serialise({ ...row }) })
        })
    }

    convertRequest(requestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.intake.convert(
                str(input.workspaceId, "workspaceId"),
                requestId,
                {
                    reference: str(input.reference, "reference"),
                    title: str(input.title, "title"),
                    siteAddress: nullableStr(input.siteAddress, "siteAddress"),
                    priority: optPriority(input.priority),
                    originLocationId: nullableStr(input.originLocationId, "originLocationId"),
                },
                this.actor(input),
            )
            return success({ job: serialise({ ...row }) }, 201)
        })
    }

    // ---- jobs ------------------------------------------------------------

    listJobs(request: Request): Promise<Response> {
        return this.run(async () => {
            const url = new URL(request.url)
            const raw = url.searchParams.get("status")
            const filter = raw === null || raw === "" ? null : vocab(raw, jobFlow.is, "job status", "status")
            return success({ jobs: serialiseAll(await this.jobs.list(param(request, "workspaceId"), filter)) })
        })
    }

    getJob(jobId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ job: serialise({ ...(await this.jobs.get(param(request, "workspaceId"), jobId)) }) }),
        )
    }

    createJob(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.jobs.create(
                str(input.workspaceId, "workspaceId"),
                {
                    reference: str(input.reference, "reference"),
                    title: str(input.title, "title"),
                    siteAddress: str(input.siteAddress, "siteAddress"),
                    siteNotes: nullableStr(input.siteNotes, "siteNotes"),
                    contactName: nullableStr(input.contactName, "contactName"),
                    contactPhone: nullableStr(input.contactPhone, "contactPhone"),
                    priority: optPriority(input.priority),
                    serviceOfferingId: nullableStr(input.serviceOfferingId, "serviceOfferingId"),
                    originLocationId: nullableStr(input.originLocationId, "originLocationId"),
                    estimateCents: optInt(input.estimateCents, "estimateCents"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(input),
            )
            return success({ job: serialise({ ...result.job }), replayed: result.replayed }, result.replayed ? 200 : 201)
        })
    }

    transitionJob(jobId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.jobs.transition(
                str(input.workspaceId, "workspaceId"),
                jobId,
                vocab(input.status, jobFlow.is, "job status", "status"),
                this.actor(input),
                nullableStr(input.reason, "reason"),
            )
            return success({ job: serialise({ ...row }) })
        })
    }

    scheduleJob(jobId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.jobs.schedule(
                str(input.workspaceId, "workspaceId"),
                jobId,
                { startAt: optDate(input.startAt, "startAt"), endAt: optDate(input.endAt, "endAt") },
                this.actor(input),
            )
            return success({ job: serialise({ ...row }) })
        })
    }

    listAssignments(jobId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ assignments: serialiseAll(await this.jobs.listAssignments(param(request, "workspaceId"), jobId)) }),
        )
    }

    assign(jobId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.jobs.assign(
                str(input.workspaceId, "workspaceId"),
                jobId,
                {
                    resourceId: str(input.resourceId, "resourceId"),
                    role: optRole(input.role),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(input),
            )
            return success(
                { assignment: serialise({ ...result.assignment }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    transitionAssignment(jobId: string, assignmentId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.jobs.transitionAssignment(
                str(input.workspaceId, "workspaceId"),
                jobId,
                assignmentId,
                vocab(input.state, assignmentFlow.is, "job card state", "state"),
                this.actor(input),
                nullableStr(input.reason, "reason"),
            )
            return success({ assignment: serialise({ ...row }) })
        })
    }

    timeline(jobId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ events: serialiseAll(await this.jobs.timeline(param(request, "workspaceId"), jobId)) }),
        )
    }

    // ---- inspection templates -------------------------------------------

    listTemplates(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ templates: serialiseAll(await this.templates.list(param(request, "workspaceId"))) }),
        )
    }

    createTemplate(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.templates.create(str(input.workspaceId, "workspaceId"), {
                name: str(input.name, "name"),
                description: nullableStr(input.description, "description"),
                serviceOfferingId: nullableStr(input.serviceOfferingId, "serviceOfferingId"),
                idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
            })
            return success(
                { template: serialise({ ...result.template }), replayed: result.replayed },
                result.replayed ? 200 : 201,
            )
        })
    }

    getTemplate(templateId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const result = await this.templates.get(param(request, "workspaceId"), templateId)
            return success({ template: serialise({ ...result.template }), items: serialiseAll(result.items) })
        })
    }

    addTemplateItem(templateId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.templates.addItem(str(input.workspaceId, "workspaceId"), templateId, {
                label: str(input.label, "label"),
                kind:
                    input.kind === null || input.kind === undefined || input.kind === ""
                        ? null
                        : vocab(input.kind, isInspectionItemKind, "inspection line kind", "kind"),
                guidance: nullableStr(input.guidance, "guidance"),
                required: optBool(input.required, "required"),
                unit: nullableStr(input.unit, "unit"),
                expectedMin: optDecimal(input.expectedMin, "expectedMin"),
                expectedMax: optDecimal(input.expectedMax, "expectedMax"),
                position: optInt(input.position, "position"),
            })
            return success({ item: serialise({ ...row }) }, 201)
        })
    }

    updateTemplate(templateId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.templates.update(str(input.workspaceId, "workspaceId"), templateId, {
                name: input.name === undefined ? null : nullableStr(input.name, "name"),
                ...(input.description !== undefined ? { description: nullableStr(input.description, "description") } : {}),
                isActive: optBool(input.isActive, "isActive"),
            })
            return success({ template: serialise({ ...row }) })
        })
    }

    // ---- inspections -----------------------------------------------------

    listInspections(request: Request): Promise<Response> {
        return this.run(async () => {
            const url = new URL(request.url)
            const rawStatus = url.searchParams.get("status")
            const rawJob = url.searchParams.get("jobId")
            return success({
                inspections: serialiseAll(
                    await this.inspections.list(param(request, "workspaceId"), {
                        status:
                            rawStatus === null || rawStatus === ""
                                ? null
                                : vocab(rawStatus, inspectionFlow.is, "inspection status", "status"),
                        jobId: rawJob === null || rawJob === "" ? null : rawJob,
                    }),
                ),
            })
        })
    }

    createInspection(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.inspections.create(
                str(input.workspaceId, "workspaceId"),
                {
                    jobId: str(input.jobId, "jobId"),
                    reference: str(input.reference, "reference"),
                    templateId: nullableStr(input.templateId, "templateId"),
                    assignmentId: nullableStr(input.assignmentId, "assignmentId"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(input),
            )
            return success(
                {
                    inspection: serialise({ ...result.inspection }),
                    items: serialiseAll(result.items),
                    replayed: result.replayed,
                },
                result.replayed ? 200 : 201,
            )
        })
    }

    getInspection(inspectionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const result = await this.inspections.get(param(request, "workspaceId"), inspectionId)
            return success({
                inspection: serialise({ ...result.inspection }),
                items: serialiseAll(result.items),
                parts: serialiseAll(result.parts),
            })
        })
    }

    transitionInspection(inspectionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.inspections.transition(
                str(input.workspaceId, "workspaceId"),
                inspectionId,
                {
                    status: vocab(input.status, inspectionFlow.is, "inspection status", "status"),
                    outcome:
                        input.outcome === null || input.outcome === undefined || input.outcome === ""
                            ? null
                            : vocab(input.outcome, isInspectionOutcome, "inspection outcome", "outcome"),
                    completionNotes: nullableStr(input.completionNotes, "completionNotes"),
                    cancelReason: nullableStr(input.cancelReason, "cancelReason"),
                },
                this.actor(input),
            )
            return success({ inspection: serialise({ ...row }) })
        })
    }

    recordInspectionItem(inspectionId: string, itemId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.inspections.recordItem(
                str(input.workspaceId, "workspaceId"),
                inspectionId,
                itemId,
                {
                    result:
                        input.result === null || input.result === undefined || input.result === ""
                            ? null
                            : vocab(input.result, isInspectionItemResult, "inspection line result", "result"),
                    ...(input.notes !== undefined ? { notes: nullableStr(input.notes, "notes") } : {}),
                    ...(input.measuredValue !== undefined
                        ? { measuredValue: optDecimal(input.measuredValue, "measuredValue") }
                        : {}),
                    ...(input.assetLabel !== undefined ? { assetLabel: nullableStr(input.assetLabel, "assetLabel") } : {}),
                    ...(input.assetSerial !== undefined
                        ? { assetSerial: nullableStr(input.assetSerial, "assetSerial") }
                        : {}),
                    ...(input.assetLocationHint !== undefined
                        ? { assetLocationHint: nullableStr(input.assetLocationHint, "assetLocationHint") }
                        : {}),
                },
                this.actor(input),
            )
            return success({ item: serialise({ ...row }) })
        })
    }

    addInspectionPart(inspectionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.inspections.addPart(
                str(input.workspaceId, "workspaceId"),
                inspectionId,
                {
                    inventoryItemId: str(input.inventoryItemId, "inventoryItemId"),
                    qty: int(input.qty, "qty"),
                    unitCostCents: optInt(input.unitCostCents, "unitCostCents"),
                    currency: nullableStr(input.currency, "currency"),
                    notes: nullableStr(input.notes, "notes"),
                    consumeStock: optBool(input.consumeStock, "consumeStock"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(input),
            )
            return success(
                {
                    part: serialise({ ...result.part }),
                    stock: result.stock ? serialise({ ...result.stock }) : null,
                    replayed: result.replayed,
                },
                result.replayed ? 200 : 201,
            )
        })
    }

    setInspectionHandoff(inspectionId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.inspections.setHandoff(
                str(input.workspaceId, "workspaceId"),
                inspectionId,
                {
                    invoiceHandoffState: vocab(
                        input.invoiceHandoffState,
                        handoffFlow.is,
                        "invoice handoff state",
                        "invoiceHandoffState",
                    ),
                    ...(input.invoiceHandoffReference !== undefined
                        ? { invoiceHandoffReference: nullableStr(input.invoiceHandoffReference, "invoiceHandoffReference") }
                        : {}),
                    ...(input.invoiceHandoffNote !== undefined
                        ? { invoiceHandoffNote: nullableStr(input.invoiceHandoffNote, "invoiceHandoffNote") }
                        : {}),
                },
                this.actor(input),
            )
            return success({ inspection: serialise({ ...row }) })
        })
    }

    inspectionTimeline(inspectionId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({
                events: serialiseAll(await this.inspections.timeline(param(request, "workspaceId"), inspectionId)),
            }),
        )
    }
}
