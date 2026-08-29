import {
    APPROVAL_GATED_DELIVERABLE_STATUSES,
    DOCUMENT_REQUIRED_STATUSES,
    deliverableFlow,
    documentRequestFlow,
    invoiceFlow,
    milestoneFlow,
    type DeliverableStatusValue,
    type DocumentRequestStatusValue,
    type InvoiceStateValue,
    type MilestoneStatusValue,
} from "./lifecycle"
import type { CaseActor, CaseContext } from "./shared"

/**
 * Milestones, deliverables, document requests, task links, approval links and invoices.
 *
 * Every one COMPOSES an existing system rather than adding a parallel one:
 *   * tasks are `TaskJob` rows in the existing durable queue
 *   * approvals are `Approval` rows on a `WorkflowRun`, the copilot ledger
 *   * documents are `ProfileDocument` rows
 *   * invoices carry billing STATE and point at `Payment`; no amounts are re-ledgered
 *
 * A child row belonging to another case is refused exactly as a missing one, so the
 * non-enumeration property holds at every level, not just on the case itself.
 */
export class CaseWorkflowService {
    constructor(private readonly ctx: CaseContext) {}

    // ---- milestones ----------------------------------------------------

    async addMilestone(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ title: string; ordinal: number; dueAt?: Date | null }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const title = this.ctx.required(input.title, "title")
        if (!Number.isInteger(input.ordinal) || input.ordinal < 1) {
            this.ctx.conflict("ordinal must be a positive integer")
        }
        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.caseMilestone.create({
                    data: { caseId: owned.id, title, ordinal: input.ordinal, dueAt: input.dueAt ?? null },
                })
                await this.ctx.appendEvent(tx, owned.id, "MILESTONE", null, "PENDING", actor, { milestoneId: row.id })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "A milestone with that ordinal already exists on this case")
        }
    }

    async listMilestones(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        return Object.freeze(
            await this.ctx.db.caseMilestone.findMany({ where: { caseId: owned.id }, orderBy: { ordinal: "asc" } }),
        )
    }

    async transitionMilestone(
        workspaceId: string,
        caseId: string,
        milestoneId: string,
        to: MilestoneStatusValue,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const id = this.ctx.required(milestoneId, "milestoneId")

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; caseId: string; status: MilestoneStatusValue }>>(
                `select "id","caseId","status" from "CaseMilestone" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.caseId !== owned.id) this.ctx.denied()
            if (!milestoneFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} milestone to ${to.toLowerCase()}`)
            }
            const row = await tx.caseMilestone.update({
                where: { id },
                data: { status: to, ...(to === "DONE" ? { completedAt: new Date() } : {}) },
            })
            await this.ctx.appendEvent(tx, owned.id, "MILESTONE", current.status, to, actor, { milestoneId: id })
            return row
        })
    }

    // ---- document requests --------------------------------------------

    async requestDocument(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ title: string; description?: string | null; dueAt?: Date | null }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const title = this.ctx.required(input.title, "title")
        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.caseDocumentRequest.create({
                data: {
                    caseId: owned.id,
                    title,
                    description: input.description?.trim() || null,
                    dueAt: input.dueAt ?? null,
                    status: "REQUESTED",
                },
            })
            await this.ctx.appendEvent(tx, owned.id, "DOCUMENT", null, "REQUESTED", actor, { requestId: row.id })
            return row
        })
    }

    async listDocumentRequests(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        return Object.freeze(
            await this.ctx.db.caseDocumentRequest.findMany({
                where: { caseId: owned.id },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
        )
    }

    /**
     * RECEIVED requires an actual ProfileDocument. A request marked received with nothing
     * attached would be a false record, so it is refused rather than accepted optimistically.
     */
    async transitionDocumentRequest(
        workspaceId: string,
        caseId: string,
        requestId: string,
        to: DocumentRequestStatusValue,
        actor: CaseActor,
        options?: Readonly<{ documentId?: string | null; reason?: string | null }>,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const id = this.ctx.required(requestId, "requestId")

        if (DOCUMENT_REQUIRED_STATUSES.includes(to) && !options?.documentId?.trim()) {
            this.ctx.conflict("Marking a document request received requires the document it was satisfied by")
        }
        const documentId = await this.ctx.assertDocument(options?.documentId?.trim() || null)

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<
                Array<{ id: string; caseId: string; status: DocumentRequestStatusValue }>
            >(`select "id","caseId","status" from "CaseDocumentRequest" where "id" = $1 for update`, id)
            const current = rows[0]
            if (!current || current.caseId !== owned.id) this.ctx.denied()
            if (!documentRequestFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} document request to ${to.toLowerCase()}`)
            }
            const row = await tx.caseDocumentRequest.update({
                where: { id },
                data: {
                    status: to,
                    ...(to === "RECEIVED" ? { documentId, receivedAt: new Date() } : {}),
                    ...(to === "WAIVED" ? { waivedReason: options?.reason?.trim() || null } : {}),
                },
            })
            await this.ctx.appendEvent(tx, owned.id, "DOCUMENT", current.status, to, actor, { requestId: id })
            return row
        })
    }

    // ---- deliverables -------------------------------------------------

    async addDeliverable(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ title: string; milestoneId?: string | null }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const title = this.ctx.required(input.title, "title")

        const milestoneId = input.milestoneId?.trim() || null
        if (milestoneId) {
            const m = await this.ctx.db.caseMilestone.findUnique({
                where: { id: milestoneId },
                select: { id: true, caseId: true },
            })
            if (!m || m.caseId !== owned.id) this.ctx.denied()
        }

        return this.ctx.db.$transaction(async (tx) => {
            const row = await tx.caseDeliverable.create({
                data: { caseId: owned.id, title, milestoneId, status: "DRAFT" },
            })
            await this.ctx.appendEvent(tx, owned.id, "DELIVERABLE", null, "DRAFT", actor, { deliverableId: row.id })
            return row
        })
    }

    async listDeliverables(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        return Object.freeze(
            await this.ctx.db.caseDeliverable.findMany({
                where: { caseId: owned.id },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
        )
    }

    /**
     * DELIVERED is APPROVAL-GATED. Handing work to a client is externally visible and
     * cannot be quietly undone, so it is refused unless an Approval linked to this case is
     * in state `approved`. The approval lives in the existing Approval table.
     */
    async transitionDeliverable(
        workspaceId: string,
        caseId: string,
        deliverableId: string,
        to: DeliverableStatusValue,
        actor: CaseActor,
        options?: Readonly<{ documentId?: string | null }>,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const id = this.ctx.required(deliverableId, "deliverableId")
        const documentId = await this.ctx.assertDocument(options?.documentId?.trim() || null)

        if (APPROVAL_GATED_DELIVERABLE_STATUSES.includes(to)) {
            const granted = await this.ctx.db.caseApprovalLink.findFirst({
                where: { caseId: owned.id, approval: { state: "approved" } },
                select: { approvalId: true },
            })
            if (!granted) this.ctx.conflict("Delivering this requires an approved approval on the case")
        }

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; caseId: string; status: DeliverableStatusValue }>>(
                `select "id","caseId","status" from "CaseDeliverable" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.caseId !== owned.id) this.ctx.denied()
            if (!deliverableFlow.can(current.status, to)) {
                this.ctx.conflict(`Cannot move a ${current.status.toLowerCase()} deliverable to ${to.toLowerCase()}`)
            }
            const row = await tx.caseDeliverable.update({
                where: { id },
                data: {
                    status: to,
                    ...(documentId ? { documentId } : {}),
                    ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}),
                },
            })
            await this.ctx.appendEvent(tx, owned.id, "DELIVERABLE", current.status, to, actor, { deliverableId: id })
            return row
        })
    }

    // ---- task links (composes the existing durable queue) --------------

    /**
     * Creates a real `TaskJob` in the existing durable queue and links it to the case.
     * Idempotent on the queue's own `idempotencyKey`, so a replay links the same job rather
     * than enqueuing a duplicate.
     */
    async linkTask(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ title: string; idempotencyKey?: string | null; maxAttempts?: number }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const title = this.ctx.required(input.title, "title")
        const idempotencyKey = input.idempotencyKey?.trim() || null

        if (idempotencyKey) {
            const existing = await this.ctx.db.taskJob.findUnique({ where: { idempotencyKey } })
            if (existing) {
                const link = await this.ctx.db.caseTaskLink.findUnique({
                    where: { caseId_taskJobId: { caseId: owned.id, taskJobId: existing.id } },
                })
                if (link) return { taskJobId: existing.id, replayed: true }
            }
        }

        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const job = await tx.taskJob.create({
                    data: {
                        payload: JSON.stringify({ kind: "case.work", caseId: owned.id, title }),
                        state: "QUEUED",
                        maxAttempts: input.maxAttempts ?? 3,
                        nextAttemptAt: new Date(),
                        idempotencyKey,
                    },
                })
                await tx.caseTaskLink.create({ data: { caseId: owned.id, taskJobId: job.id } })
                await this.ctx.appendEvent(tx, owned.id, "TASK", null, "QUEUED", actor, { taskJobId: job.id })
                return { taskJobId: job.id, replayed: false }
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "A task with this idempotency key is already linked")
        }
    }

    async listTasks(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const links = await this.ctx.db.caseTaskLink.findMany({
            where: { caseId: owned.id },
            include: {
                taskJob: { select: { id: true, state: true, attempts: true, maxAttempts: true, lastError: true } },
            },
            orderBy: { createdAt: "asc" },
        })
        return Object.freeze(links.map((l) => Object.freeze({ ...l.taskJob })))
    }

    // ---- approval links (composes the copilot approval ledger) ---------

    /**
     * Requests an approval for the case.
     *
     * `Approval.workflowRunId` is NOT NULL in the existing schema, so a real `WorkflowRun`
     * is created to carry it. That is the composition working as intended: case sign-off
     * becomes a first-class entry in the copilot ledger rather than a second, parallel
     * approval concept.
     */
    async requestApproval(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ reason: string; requestedBy: string; idempotencyKey?: string | null }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const reason = this.ctx.required(input.reason, "reason")
        const requestedBy = this.ctx.required(input.requestedBy, "requestedBy")
        const idempotencyKey = input.idempotencyKey?.trim() || `case-approval-${owned.id}-${reason}`

        const existingRun = await this.ctx.db.workflowRun.findFirst({
            where: { workspaceId: ws, idempotencyKey },
            select: { id: true },
        })
        if (existingRun) {
            const link = await this.ctx.db.caseApprovalLink.findFirst({
                where: { caseId: owned.id, approval: { workflowRunId: existingRun.id } },
                include: { approval: { select: { id: true, state: true, reason: true } } },
            })
            if (link) return { approval: link.approval, replayed: true }
        }

        return this.ctx.db.$transaction(async (tx) => {
            const run = await tx.workflowRun.create({
                data: {
                    workspaceId: ws,
                    workflowKey: "cases.approval",
                    workflowName: "Case approval",
                    state: "awaiting_approval",
                    idempotencyKey,
                },
            })
            const approval = await tx.approval.create({
                data: { workflowRunId: run.id, reason, state: "pending", requestedBy },
            })
            await tx.caseApprovalLink.create({ data: { caseId: owned.id, approvalId: approval.id } })
            await this.ctx.appendEvent(tx, owned.id, "APPROVAL", null, "pending", actor, { approvalId: approval.id })
            return { approval: { id: approval.id, state: approval.state, reason: approval.reason }, replayed: false }
        })
    }

    async listApprovals(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const links = await this.ctx.db.caseApprovalLink.findMany({
            where: { caseId: owned.id },
            include: {
                approval: {
                    select: { id: true, state: true, reason: true, requestedBy: true, decidedBy: true, decidedAt: true },
                },
            },
            orderBy: { createdAt: "asc" },
        })
        return Object.freeze(links.map((l) => Object.freeze({ ...l.approval })))
    }

    /** Decides a pending approval. Only `pending` may be decided, and only once. */
    async decideApproval(
        workspaceId: string,
        caseId: string,
        approvalId: string,
        decision: "approved" | "rejected",
        decidedBy: string,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const id = this.ctx.required(approvalId, "approvalId")
        const decider = this.ctx.required(decidedBy, "decidedBy")

        // The link is what proves this approval belongs to this case; a foreign approval
        // is refused exactly as a missing one.
        const link = await this.ctx.db.caseApprovalLink.findUnique({
            where: { caseId_approvalId: { caseId: owned.id, approvalId: id } },
        })
        if (!link) this.ctx.denied()

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; state: string }>>(
                `select "id","state" from "Approval" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current) this.ctx.denied()
            if (current.state !== "pending") {
                this.ctx.conflict(`This approval is already ${current.state} and cannot be decided again`)
            }
            const approval = await tx.approval.update({
                where: { id },
                data: { state: decision, decidedBy: decider, decidedAt: new Date() },
            })
            await tx.workflowRun.update({
                where: { id: approval.workflowRunId },
                data: { state: decision === "approved" ? "approved" : "rejected" },
            })
            await this.ctx.appendEvent(tx, owned.id, "APPROVAL", "pending", decision, actor, { approvalId: id })
            return { id: approval.id, state: approval.state, reason: approval.reason }
        })
    }

    // ---- invoices (billing STATE only) ---------------------------------

    async createInvoice(
        workspaceId: string,
        caseId: string,
        input: Readonly<{ reference: string; amountCents: number; currency?: string | null; idempotencyKey?: string | null }>,
        actor: CaseActor,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const reference = this.ctx.required(input.reference, "reference")
        if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
            this.ctx.conflict("amountCents must be a positive integer")
        }
        try {
            return await this.ctx.db.$transaction(async (tx) => {
                const row = await tx.caseInvoice.create({
                    data: {
                        caseId: owned.id,
                        reference,
                        amountCents: input.amountCents,
                        currency: input.currency?.trim() || "USD",
                        state: "DRAFT",
                        idempotencyKey: input.idempotencyKey?.trim() || null,
                    },
                })
                await this.ctx.appendEvent(tx, owned.id, "INVOICE", "NONE", "DRAFT", actor, { invoiceId: row.id })
                return row
            })
        } catch (error) {
            this.ctx.rethrowUnique(error, "An invoice with that reference already exists on this case")
        }
    }

    async listInvoices(workspaceId: string, caseId: string) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.read")
        const owned = await this.ctx.ownedCase(ws, caseId)
        return Object.freeze(
            await this.ctx.db.caseInvoice.findMany({
                where: { caseId: owned.id },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            }),
        )
    }

    /**
     * Moves invoice state and mirrors it onto the case. No money moves here and no
     * external payment provider is contacted: `paymentId` may be recorded to point at an
     * existing `Payment` row, but this engine never creates or settles one.
     */
    async transitionInvoice(
        workspaceId: string,
        caseId: string,
        invoiceId: string,
        to: InvoiceStateValue,
        actor: CaseActor,
        options?: Readonly<{ paymentId?: string | null }>,
    ) {
        const ws = await this.ctx.requireWorkspace(workspaceId, "profile.update")
        const owned = await this.ctx.ownedCase(ws, caseId)
        const id = this.ctx.required(invoiceId, "invoiceId")

        return this.ctx.db.$transaction(async (tx) => {
            const rows = await tx.$queryRawUnsafe<Array<{ id: string; caseId: string; state: InvoiceStateValue }>>(
                `select "id","caseId","state" from "CaseInvoice" where "id" = $1 for update`,
                id,
            )
            const current = rows[0]
            if (!current || current.caseId !== owned.id) this.ctx.denied()
            if (!invoiceFlow.can(current.state, to)) {
                this.ctx.conflict(`Cannot move a ${current.state.toLowerCase()} invoice to ${to.toLowerCase()}`)
            }
            const row = await tx.caseInvoice.update({
                where: { id },
                data: {
                    state: to,
                    ...(to === "ISSUED" ? { issuedAt: new Date() } : {}),
                    ...(to === "PAID" ? { paidAt: new Date() } : {}),
                    ...(options?.paymentId?.trim() ? { paymentId: options.paymentId.trim() } : {}),
                },
            })
            // The case mirrors its most recent invoice state so the console can show
            // billing without a second query per case.
            await tx.caseProject.update({ where: { id: owned.id }, data: { invoiceState: to } })
            await this.ctx.appendEvent(tx, owned.id, "INVOICE", current.state, to, actor, { invoiceId: id })
            return row
        })
    }
}
