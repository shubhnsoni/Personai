import { PersistenceError } from "@/lib/persistence/errors"

import type { CaseIntakeService, CaseProjectService } from "./engine"
import {
    caseFlow,
    deliverableFlow,
    documentRequestFlow,
    intakeFlow,
    invoiceFlow,
    milestoneFlow,
} from "./lifecycle"
import type { CaseActor } from "./shared"
import type { CaseWorkflowService } from "./workflow"

/**
 * HTTP boundary for the cases surface.
 *
 * The envelope mirrors PlatformService — { ok: true, data } / { ok: false, error: { code,
 * message } } with the same status map. It is restated rather than imported because that
 * file belongs to the P2-002 package; the route harness asserts both agree so drift is
 * caught by a test.
 *
 * The actor is always derived server-side; no parameter lets a caller name itself.
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
        { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Case persistence is temporarily unavailable" } },
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

/** Validates a status against the owning flow, so an unknown value is 400 not 409. */
function status<T extends string>(
    value: unknown,
    guard: (v: unknown) => v is T,
    label: string,
    field = "status",
): T {
    const raw = str(value, field)
    if (!guard(raw)) {
        throw new PersistenceError("BAD_REQUEST", `${field} is not a recognised ${label} value`, { field })
    }
    return raw
}

function serialise(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
        out[k] = v instanceof Date ? v.toISOString() : typeof v === "bigint" ? String(v) : v
    }
    return out
}
function serialiseAll(rows: readonly unknown[]): Array<Record<string, unknown>> {
    return rows.map((r) => serialise({ ...(r as Record<string, unknown>) }))
}
function param(request: Request, name: string): string {
    return str(new URL(request.url).searchParams.get(name), name)
}

export class CaseApiService {
    constructor(
        private readonly intakes: CaseIntakeService,
        private readonly cases: CaseProjectService,
        private readonly flow: CaseWorkflowService,
    ) {}

    private run(op: () => Promise<Response>): Promise<Response> {
        return op().catch(failure)
    }
    private actor(): CaseActor {
        return { actorType: "STAFF", actorId: null }
    }

    // ---- intakes -------------------------------------------------------

    listIntakes(request: Request): Promise<Response> {
        return this.run(async () =>
            success({ intakes: serialiseAll(await this.intakes.list(param(request, "workspaceId"))) }),
        )
    }

    createIntake(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.intakes.create(str(input.workspaceId, "workspaceId"), {
                source: str(input.source, "source"),
                summary: str(input.summary, "summary"),
                contactId: nullableStr(input.contactId, "contactId"),
                idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
            })
            return success({ intake: serialise({ ...result.intake }), replayed: result.replayed }, result.replayed ? 200 : 201)
        })
    }

    transitionIntake(intakeId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const intake = await this.intakes.transition(
                str(input.workspaceId, "workspaceId"),
                intakeId,
                status(input.status, intakeFlow.is, "intake"),
                nullableStr(input.reason, "reason"),
            )
            return success({ intake: serialise({ ...intake }) })
        })
    }

    convertIntake(intakeId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.intakes.convert(
                str(input.workspaceId, "workspaceId"),
                intakeId,
                {
                    reference: str(input.reference, "reference"),
                    title: str(input.title, "title"),
                    locationId: nullableStr(input.locationId, "locationId"),
                },
                this.actor(),
            )
            return success({ case: serialise({ ...record }) }, 201)
        })
    }

    // ---- cases ---------------------------------------------------------

    list(request: Request): Promise<Response> {
        return this.run(async () => success({ cases: serialiseAll(await this.cases.list(param(request, "workspaceId"))) }))
    }

    create(request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.cases.create(
                str(input.workspaceId, "workspaceId"),
                {
                    reference: str(input.reference, "reference"),
                    title: str(input.title, "title"),
                    contactId: nullableStr(input.contactId, "contactId"),
                    locationId: nullableStr(input.locationId, "locationId"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success({ case: serialise({ ...result.record }), replayed: result.replayed }, result.replayed ? 200 : 201)
        })
    }

    get(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ case: serialise({ ...(await this.cases.get(param(request, "workspaceId"), caseId)) }) }),
        )
    }

    transition(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.cases.transition(
                str(input.workspaceId, "workspaceId"),
                caseId,
                status(input.status, caseFlow.is, "case"),
                this.actor(),
                nullableStr(input.reason, "reason"),
            )
            return success({ case: serialise({ ...record }) })
        })
    }

    assignContact(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const record = await this.cases.assignContact(
                str(input.workspaceId, "workspaceId"),
                caseId,
                nullableStr(input.contactId, "contactId"),
                this.actor(),
            )
            return success({ case: serialise({ ...record }) })
        })
    }

    // ---- brief and timeline -------------------------------------------

    getBrief(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const brief = await this.cases.getBrief(param(request, "workspaceId"), caseId)
            return success({ brief: brief ? serialise({ ...brief }) : null })
        })
    }

    putBrief(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const brief = await this.cases.upsertBrief(
                str(input.workspaceId, "workspaceId"),
                caseId,
                {
                    objectives: str(input.objectives, "objectives"),
                    scope: nullableStr(input.scope, "scope"),
                    constraints: nullableStr(input.constraints, "constraints"),
                    agreed: input.agreed === true,
                },
                this.actor(),
            )
            return success({ brief: serialise({ ...brief }) })
        })
    }

    timeline(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ events: serialiseAll(await this.cases.timeline(param(request, "workspaceId"), caseId)) }),
        )
    }

    // ---- milestones ---------------------------------------------------

    listMilestones(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ milestones: serialiseAll(await this.flow.listMilestones(param(request, "workspaceId"), caseId)) }),
        )
    }

    addMilestone(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.addMilestone(
                str(input.workspaceId, "workspaceId"),
                caseId,
                { title: str(input.title, "title"), ordinal: int(input.ordinal, "ordinal"), dueAt: optDate(input.dueAt, "dueAt") },
                this.actor(),
            )
            return success({ milestone: serialise({ ...row }) }, 201)
        })
    }

    transitionMilestone(caseId: string, milestoneId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionMilestone(
                str(input.workspaceId, "workspaceId"),
                caseId,
                milestoneId,
                status(input.status, milestoneFlow.is, "milestone"),
                this.actor(),
            )
            return success({ milestone: serialise({ ...row }) })
        })
    }

    // ---- document requests --------------------------------------------

    listDocumentRequests(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ requests: serialiseAll(await this.flow.listDocumentRequests(param(request, "workspaceId"), caseId)) }),
        )
    }

    requestDocument(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.requestDocument(
                str(input.workspaceId, "workspaceId"),
                caseId,
                {
                    title: str(input.title, "title"),
                    description: nullableStr(input.description, "description"),
                    dueAt: optDate(input.dueAt, "dueAt"),
                },
                this.actor(),
            )
            return success({ request: serialise({ ...row }) }, 201)
        })
    }

    transitionDocumentRequest(caseId: string, requestId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionDocumentRequest(
                str(input.workspaceId, "workspaceId"),
                caseId,
                requestId,
                status(input.status, documentRequestFlow.is, "document request"),
                this.actor(),
                { documentId: nullableStr(input.documentId, "documentId"), reason: nullableStr(input.reason, "reason") },
            )
            return success({ request: serialise({ ...row }) })
        })
    }

    // ---- deliverables -------------------------------------------------

    listDeliverables(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ deliverables: serialiseAll(await this.flow.listDeliverables(param(request, "workspaceId"), caseId)) }),
        )
    }

    addDeliverable(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.addDeliverable(
                str(input.workspaceId, "workspaceId"),
                caseId,
                { title: str(input.title, "title"), milestoneId: nullableStr(input.milestoneId, "milestoneId") },
                this.actor(),
            )
            return success({ deliverable: serialise({ ...row }) }, 201)
        })
    }

    transitionDeliverable(caseId: string, deliverableId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionDeliverable(
                str(input.workspaceId, "workspaceId"),
                caseId,
                deliverableId,
                status(input.status, deliverableFlow.is, "deliverable"),
                this.actor(),
                { documentId: nullableStr(input.documentId, "documentId") },
            )
            return success({ deliverable: serialise({ ...row }) })
        })
    }

    // ---- tasks and approvals ------------------------------------------

    listTasks(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ tasks: serialiseAll(await this.flow.listTasks(param(request, "workspaceId"), caseId)) }),
        )
    }

    linkTask(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.flow.linkTask(
                str(input.workspaceId, "workspaceId"),
                caseId,
                { title: str(input.title, "title"), idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey") },
                this.actor(),
            )
            return success({ taskJobId: result.taskJobId, replayed: result.replayed }, result.replayed ? 200 : 201)
        })
    }

    listApprovals(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ approvals: serialiseAll(await this.flow.listApprovals(param(request, "workspaceId"), caseId)) }),
        )
    }

    requestApproval(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const result = await this.flow.requestApproval(
                str(input.workspaceId, "workspaceId"),
                caseId,
                {
                    reason: str(input.reason, "reason"),
                    requestedBy: str(input.requestedBy, "requestedBy"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success({ approval: serialise({ ...result.approval }), replayed: result.replayed }, result.replayed ? 200 : 201)
        })
    }

    decideApproval(caseId: string, approvalId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const decision = str(input.decision, "decision")
            if (decision !== "approved" && decision !== "rejected") {
                throw new PersistenceError("BAD_REQUEST", "decision must be approved or rejected", { field: "decision" })
            }
            const approval = await this.flow.decideApproval(
                str(input.workspaceId, "workspaceId"),
                caseId,
                approvalId,
                decision,
                str(input.decidedBy, "decidedBy"),
                this.actor(),
            )
            return success({ approval: serialise({ ...approval }) })
        })
    }

    // ---- invoices -----------------------------------------------------

    listInvoices(caseId: string, request: Request): Promise<Response> {
        return this.run(async () =>
            success({ invoices: serialiseAll(await this.flow.listInvoices(param(request, "workspaceId"), caseId)) }),
        )
    }

    createInvoice(caseId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.createInvoice(
                str(input.workspaceId, "workspaceId"),
                caseId,
                {
                    reference: str(input.reference, "reference"),
                    amountCents: int(input.amountCents, "amountCents"),
                    currency: nullableStr(input.currency, "currency"),
                    idempotencyKey: nullableStr(input.idempotencyKey, "idempotencyKey"),
                },
                this.actor(),
            )
            return success({ invoice: serialise({ ...row }) }, 201)
        })
    }

    transitionInvoice(caseId: string, invoiceId: string, request: Request): Promise<Response> {
        return this.run(async () => {
            const input = await body(request)
            const row = await this.flow.transitionInvoice(
                str(input.workspaceId, "workspaceId"),
                caseId,
                invoiceId,
                status(input.state, invoiceFlow.is, "invoice", "state"),
                this.actor(),
                { paymentId: nullableStr(input.paymentId, "paymentId") },
            )
            return success({ invoice: serialise({ ...row }) })
        })
    }
}
