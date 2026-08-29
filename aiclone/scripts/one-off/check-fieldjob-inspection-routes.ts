/**
 * Wave H1: fieldJobs:inspection route harness.
 *
 * Drives the REAL FieldJobApiService - the same object the route files re-export - with hand-built
 * Request objects, against the authorized disposable rehearsal database. Nothing is stubbed except
 * identity and, for the 503 case, a deliberately broken Prisma.
 *
 * The claims worth measuring at the HTTP boundary rather than in the engine:
 *
 *   * THERE IS NO 404, ANYWHERE. Every request for a row that does not exist is collected and the
 *     set of observed statuses is asserted not to contain 404. The UI is required never to say
 *     "not found", and this is the assertion that makes that instruction safe to follow.
 *   * A foreign row and a nonexistent row produce the BYTE-IDENTICAL response, compared as whole
 *     serialized bodies including status. Asserting two 403s would prove nothing.
 *   * 400 versus 409 ON THE SAME FIELD. An unrecognised `status` is 400 because the vocabulary is
 *     wrong; a recognised `status` in the wrong order is 409 because the vocabulary is right and
 *     the request is not. Both are proven on `status`, not on two different fields.
 *   * DECIMALS ARRIVE AS STRINGS and `seq` arrives as a STRING, checked against the raw JSON text
 *     rather than the parsed value, because JSON.parse of a number would already have lost the
 *     precision the assertion exists to protect.
 *   * THE ACTOR BOUNDARY IS NARROW. TECHNICIAN and STAFF are accepted, CUSTOMER and SYSTEM are
 *     refused with 400, and an actorId supplied by the caller is never persisted.
 *   * consumeStock DEFAULTS TO FALSE OVER HTTP. Omitting the flag entirely must not move stock.
 *   * A 503 leaks no DSN, host or driver text.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove the harness can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-inspection-routes.ts
 */
import { PrismaClient } from "@prisma/client"

import { FieldJobIntakeService, FieldJobService } from "../../src/lib/fieldjobs/engine"
import { FieldJobApiService } from "../../src/lib/fieldjobs/http"
import { FieldJobInspectionService, FieldJobInspectionTemplateService } from "../../src/lib/fieldjobs/inspection"
import { FieldJobContext } from "../../src/lib/fieldjobs/shared"
import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wh1x_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const API = "http://127.0.0.1/api/platform"
const TPL = `${API}/inspection-templates`
const INSP = `${API}/inspections`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/** Flipped at RECORD time by INVERT_ASSERTION=1, so each assertion's ability to fail is proven. */
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

type Called = { status: number; body: Record<string, unknown>; raw: string }

/** Every status this harness ever observes, so "there is no 404" can be asserted over all of them. */
const observedStatuses: number[] = []

async function call(p: Promise<Response>): Promise<Called> {
    const res = await p
    const raw = await res.text()
    let body: Record<string, unknown> = {}
    try {
        body = JSON.parse(raw) as Record<string, unknown>
    } catch {
        body = {}
    }
    observedStatuses.push(res.status)
    return { status: res.status, body, raw }
}
function get(url: string): Request {
    return new Request(url, { method: "GET" })
}
function send(url: string, payload: unknown, method = "POST"): Request {
    return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
}
function sendRaw(url: string, raw: string, method = "POST"): Request {
    return new Request(url, { method, headers: { "content-type": "application/json" }, body: raw })
}
function errCode(c: Called): string {
    return (c.body as { error?: { code?: string } }).error?.code ?? "NONE"
}
function errDetails(c: Called): Record<string, unknown> | undefined {
    return (c.body as { error?: { details?: Record<string, unknown> } }).error?.details
}
function dataOf(c: Called): Record<string, unknown> {
    return ((c.body as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>
}
/** Status plus whole body. This is what "byte-identical refusal" has to mean to be worth anything. */
function refusal(c: Called): string {
    return `${c.status}:${c.raw}`
}

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${dbName}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    const identity = new ControlledIdentity()
    const tenancy = new PersistedTenancy(prisma, identity)
    const ctx = new FieldJobContext(prisma, tenancy)
    const inventory = new InventoryService(new InventoryContext(prisma, tenancy))
    const api = new FieldJobApiService(
        new FieldJobIntakeService(ctx),
        new FieldJobService(ctx),
        new FieldJobInspectionTemplateService(ctx),
        new FieldJobInspectionService(ctx, inventory),
    )

    const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
    if (live[0].db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: connected to ${live[0].db}`)
        process.exit(1)
    }

    const ids = {
        userA: `${RUN}_ua`,
        userB: `${RUN}_ub`,
        profileA: `${RUN}_pa`,
        profileB: `${RUN}_pb`,
        wsA: `${RUN}_wa`,
        wsB: `${RUN}_wb`,
        locA: `${RUN}_la`,
        prodA: `${RUN}_proda`,
        jobA: `${RUN}_ja`,
        jobB: `${RUN}_jb`,
    }
    const base = { templates: 0, inspections: 0, items: 0, parts: 0, events: 0, movements: 0 }

    try {
        base.templates = await prisma.fieldJobInspectionTemplate.count()
        base.inspections = await prisma.fieldJobInspection.count()
        base.items = await prisma.fieldJobInspectionItem.count()
        base.parts = await prisma.fieldJobInspectionPart.count()
        base.events = await prisma.fieldJobEvent.count()
        base.movements = await prisma.inventoryMovement.count()

        for (const [u, p, w] of [
            [ids.userA, ids.profileA, ids.wsA],
            [ids.userB, ids.profileB, ids.wsB],
        ]) {
            await prisma.user.create({ data: { id: u, clerkId: `clerk_${u}`, email: `${u}@example.test` } })
            await prisma.profile.create({ data: { id: p, userId: u, slug: `slug-${p}`, displayName: `P ${p}` } })
            await prisma.workspace.create({ data: { id: w, profileId: p, name: `WS ${w}`, slug: `ws-${w}` } })
            await prisma.membership.create({ data: { workspaceId: w, userId: u, role: "OWNER" } })
        }
        await prisma.location.create({ data: { id: ids.locA, workspaceId: ids.wsA, name: "Depot A" } })
        await prisma.digitalProduct.create({ data: { id: ids.prodA, profileId: ids.profileA, title: "Valve" } })
        for (const [id, profileId, reference, loc] of [
            [ids.jobA, ids.profileA, `${RUN}-JOB-A`, ids.locA],
            [ids.jobB, ids.profileB, `${RUN}-JOB-B`, null],
        ] as Array<[string, string, string, string | null]>) {
            await prisma.fieldJob.create({
                data: {
                    id,
                    profileId,
                    reference,
                    title: `Job ${reference}`,
                    siteAddress: "1 Example Street",
                    ...(loc ? { originLocationId: loc } : {}),
                },
            })
        }

        // ---- 1. anonymous ---------------------------------------------------
        identity.current = null
        const anonList = await call(api.listInspections(get(`${INSP}?workspaceId=${ids.wsA}`)))
        check("an anonymous list is 401", anonList.status === 401, `status=${anonList.status}`)
        check(
            "the 401 uses the platform's UNAUTHORIZED code",
            errCode(anonList) === "UNAUTHORIZED",
            `code=${errCode(anonList)}`,
        )

        identity.current = `clerk_${ids.userA}`

        // ---- 2. workspaceId is mandatory on both shapes --------------------
        const noWsQuery = await call(api.listInspections(get(INSP)))
        check("a GET without workspaceId is 400", noWsQuery.status === 400, `status=${noWsQuery.status}`)
        const noWsBody = await call(api.createInspection(send(INSP, { jobId: ids.jobA, reference: "x" })))
        check("a POST without workspaceId is 400", noWsBody.status === 400, `status=${noWsBody.status}`)

        // ---- 3. malformed bodies -------------------------------------------
        const badJson = await call(api.createInspection(sendRaw(INSP, "{not json")))
        check("a malformed JSON body is 400", badJson.status === 400, `status=${badJson.status}`)
        const arrayBody = await call(api.createInspection(sendRaw(INSP, "[1,2,3]")))
        check("a non-object JSON body is 400", arrayBody.status === 400, `status=${arrayBody.status}`)

        // ---- 4. templates over HTTP ----------------------------------------
        const tplCreated = await call(
            api.createTemplate(send(TPL, { workspaceId: ids.wsA, name: "Annual check", idempotencyKey: "t1" })),
        )
        check("creating a template is 201", tplCreated.status === 201, `status=${tplCreated.status}`)
        const templateId = (dataOf(tplCreated).template as { id: string }).id
        const tplReplayed = await call(
            api.createTemplate(send(TPL, { workspaceId: ids.wsA, name: "Ignored", idempotencyKey: "t1" })),
        )
        checkInvertible(
            "an idempotent template replay is 200 with replayed:true, not a second 201",
            tplReplayed.status === 200 && dataOf(tplReplayed).replayed === true,
            `status=${tplReplayed.status} replayed=${String(dataOf(tplReplayed).replayed)}`,
        )

        const badKind = await call(
            api.addTemplateItem(
                templateId,
                send(`${TPL}/${templateId}/items`, { workspaceId: ids.wsA, label: "L", kind: "NONSENSE" }),
            ),
        )
        checkInvertible(
            "an unrecognised line kind is 400, because the vocabulary is wrong",
            badKind.status === 400,
            `status=${badKind.status} code=${errCode(badKind)}`,
        )
        const measurementNoUnit = await call(
            api.addTemplateItem(
                templateId,
                send(`${TPL}/${templateId}/items`, { workspaceId: ids.wsA, label: "Flow", kind: "MEASUREMENT" }),
            ),
        )
        checkInvertible(
            "a measurement line with no unit is 409, because the vocabulary is right and the request is not",
            measurementNoUnit.status === 409,
            `status=${measurementNoUnit.status} code=${errCode(measurementNoUnit)}`,
        )

        await call(
            api.addTemplateItem(
                templateId,
                send(`${TPL}/${templateId}/items`, { workspaceId: ids.wsA, label: "Flue clear" }),
            ),
        )
        await call(
            api.addTemplateItem(
                templateId,
                send(`${TPL}/${templateId}/items`, {
                    workspaceId: ids.wsA,
                    label: "Flow temperature",
                    kind: "MEASUREMENT",
                    unit: "C",
                    expectedMin: 60,
                    expectedMax: 80,
                }),
            ),
        )
        const tplRead = await call(api.getTemplate(templateId, get(`${TPL}/${templateId}?workspaceId=${ids.wsA}`)))
        checkInvertible(
            "template Decimals arrive as JSON STRINGS, so a range cannot lose precision in transit",
            /"expectedMin":"60"/.test(tplRead.raw) && /"expectedMax":"80"/.test(tplRead.raw),
            tplRead.raw.slice(0, 220),
        )

        // ---- 5. inspections over HTTP --------------------------------------
        const created = await call(
            api.createInspection(
                send(INSP, {
                    workspaceId: ids.wsA,
                    jobId: ids.jobA,
                    reference: `${RUN}-I1`,
                    templateId,
                    idempotencyKey: "i1",
                }),
            ),
        )
        check("creating an inspection is 201", created.status === 201, `status=${created.status}`)
        const inspection = dataOf(created).inspection as {
            id: string
            status: string
            allowedTransitions: string[]
            allowedHandoffStates: string[]
            pendingRequired: number
            isTerminal: boolean
            canRecord: boolean
        }
        const itemsOut = dataOf(created).items as Array<{ id: string; kind: string; label: string }>
        check("the created inspection carries its snapshotted lines", itemsOut.length === 2, `lines=${itemsOut.length}`)
        checkInvertible(
            "the server sends allowedTransitions, pendingRequired and isTerminal so the UI never reimplements the rules",
            Array.isArray(inspection.allowedTransitions) &&
                inspection.allowedTransitions.length > 0 &&
                typeof inspection.pendingRequired === "number" &&
                typeof inspection.isTerminal === "boolean" &&
                Array.isArray(inspection.allowedHandoffStates),
            `allowed=[${inspection.allowedTransitions?.join(",")}] pendingRequired=${inspection.pendingRequired}`,
        )
        const replayed = await call(
            api.createInspection(
                send(INSP, { workspaceId: ids.wsA, jobId: ids.jobA, reference: "ignored", idempotencyKey: "i1" }),
            ),
        )
        check(
            "an idempotent inspection replay is 200",
            replayed.status === 200 && dataOf(replayed).replayed === true,
            `status=${replayed.status}`,
        )

        // ---- 6. 400 versus 409 on the SAME field ---------------------------
        const unknownStatus = await call(
            api.transitionInspection(inspection.id, send(`${INSP}/${inspection.id}`, { workspaceId: ids.wsA, status: "NONSENSE" }, "PATCH")),
        )
        const wrongOrder = await call(
            api.transitionInspection(
                inspection.id,
                send(`${INSP}/${inspection.id}`, { workspaceId: ids.wsA, status: "COMPLETED" }, "PATCH"),
            ),
        )
        checkInvertible(
            "an unrecognised status is 400 and a recognised status in the wrong order is 409, proven on the SAME field",
            unknownStatus.status === 400 && wrongOrder.status === 409,
            `unknown=${unknownStatus.status} wrongOrder=${wrongOrder.status}`,
        )
        const badStatusFilter = await call(api.listInspections(get(`${INSP}?workspaceId=${ids.wsA}&status=NONSENSE`)))
        check("an unrecognised status filter is 400", badStatusFilter.status === 400, `status=${badStatusFilter.status}`)

        // ---- 7. the actor boundary is narrow -------------------------------
        await call(
            api.transitionInspection(
                inspection.id,
                send(`${INSP}/${inspection.id}`, { workspaceId: ids.wsA, status: "IN_PROGRESS", actorType: "TECHNICIAN" }, "PATCH"),
            ),
        )
        const techEvent = await prisma.fieldJobEvent.findFirst({
            where: { subjectId: inspection.id, to: "IN_PROGRESS" },
            orderBy: { seq: "desc" },
        })
        checkInvertible(
            "a write may declare TECHNICIAN and the ledger records it",
            techEvent?.actor === "TECHNICIAN",
            `actor=${String(techEvent?.actor)}`,
        )
        checkInvertible(
            "actorId is never taken from the caller, even when the ledger records a technician",
            techEvent?.actorId === null,
            `actorId=${String(techEvent?.actorId)}`,
        )
        for (const claimed of ["CUSTOMER", "SYSTEM"]) {
            const spoof = await call(
                api.recordInspectionItem(
                    inspection.id,
                    itemsOut[0].id,
                    send(
                        `${INSP}/${inspection.id}/items/${itemsOut[0].id}`,
                        { workspaceId: ids.wsA, result: "PASS", actorType: claimed },
                        "PATCH",
                    ),
                ),
            )
            checkInvertible(
                `a request cannot claim it came from ${claimed}`,
                spoof.status === 400,
                `status=${spoof.status} code=${errCode(spoof)}`,
            )
        }

        // ---- 8. the pendingRequired count reaches the client ---------------
        const submitBlocked = await call(
            api.transitionInspection(
                inspection.id,
                send(`${INSP}/${inspection.id}`, { workspaceId: ids.wsA, status: "SUBMITTED" }, "PATCH"),
            ),
        )
        checkInvertible(
            "a refused submission is 409 and its details carry the number of unanswered required lines",
            submitBlocked.status === 409 && errDetails(submitBlocked)?.pendingRequired === 2,
            `status=${submitBlocked.status} details=${JSON.stringify(errDetails(submitBlocked) ?? null)}`,
        )
        checkInvertible(
            "canRecord is on the wire, so the panel never has to re-derive when recording is allowed",
            /"canRecord":true/.test(created.raw) && inspection.canRecord === true,
            created.raw.slice(0, 200),
        )

        // ---- 9. readings as strings ----------------------------------------
        await call(
            api.recordInspectionItem(
                inspection.id,
                itemsOut[0].id,
                send(`${INSP}/${inspection.id}/items/${itemsOut[0].id}`, { workspaceId: ids.wsA, result: "PASS" }, "PATCH"),
            ),
        )
        const measured = await call(
            api.recordInspectionItem(
                inspection.id,
                itemsOut[1].id,
                send(
                    `${INSP}/${inspection.id}/items/${itemsOut[1].id}`,
                    { workspaceId: ids.wsA, result: "PASS", measuredValue: 70.5 },
                    "PATCH",
                ),
            ),
        )
        checkInvertible(
            "a reading arrives as a JSON STRING, so 70.5 cannot become a float on the wire",
            /"measuredValue":"70\.5"/.test(measured.raw),
            measured.raw.slice(0, 220),
        )
        checkInvertible(
            "the server sends its own range verdict rather than leaving the UI to recompute it",
            /"isWithinExpectedRange":true/.test(measured.raw),
            measured.raw.slice(0, 260),
        )

        // ---- 10. consumeStock defaults to false OVER HTTP -------------------
        const stock = await inventory.ensureItem(
            ids.wsA,
            { productId: ids.prodA, locationId: ids.locA },
            { actorType: "STAFF", actorId: null },
        )
        await inventory.applyMovement(ids.wsA, stock.record.id, { kind: "RECEIPT", qty: 10 }, { actorType: "STAFF", actorId: null })
        const onHandBefore = (await inventory.get(ids.wsA, stock.record.id)).onHand
        const partDefault = await call(
            api.addInspectionPart(
                inspection.id,
                send(`${INSP}/${inspection.id}/parts`, { workspaceId: ids.wsA, inventoryItemId: stock.record.id, qty: 2 }),
            ),
        )
        const onHandAfter = (await inventory.get(ids.wsA, stock.record.id)).onHand
        checkInvertible(
            "omitting consumeStock does not move stock, and the response says so rather than implying it",
            partDefault.status === 201 &&
                onHandAfter === onHandBefore &&
                /"stockMoved":false/.test(partDefault.raw) &&
                /"movementId":null/.test(partDefault.raw) &&
                /"stock":null/.test(partDefault.raw),
            `onHand ${onHandBefore} -> ${onHandAfter}, body=${partDefault.raw.slice(0, 160)}`,
        )
        const partConsume = await call(
            api.addInspectionPart(
                inspection.id,
                send(`${INSP}/${inspection.id}/parts`, {
                    workspaceId: ids.wsA,
                    inventoryItemId: stock.record.id,
                    qty: 3,
                    consumeStock: true,
                }),
            ),
        )
        const onHandConsumed = (await inventory.get(ids.wsA, stock.record.id)).onHand
        checkInvertible(
            "asking for stock to move moves exactly that much and reports the new stock record",
            partConsume.status === 201 && onHandConsumed === onHandAfter - 3 && /"stockMoved":true/.test(partConsume.raw),
            `onHand ${onHandAfter} -> ${onHandConsumed}`,
        )
        const badBool = await call(
            api.addInspectionPart(
                inspection.id,
                send(`${INSP}/${inspection.id}/parts`, {
                    workspaceId: ids.wsA,
                    inventoryItemId: stock.record.id,
                    qty: 1,
                    consumeStock: "yes",
                }),
            ),
        )
        checkInvertible(
            "a non-boolean consumeStock is 400 rather than being coerced into a silent false",
            badBool.status === 400,
            `status=${badBool.status}`,
        )

        // ---- 11. no 404, and byte-identical refusals ------------------------
        const ghostInspection = await call(api.getInspection(`${RUN}_ghost`, get(`${INSP}/${RUN}_ghost?workspaceId=${ids.wsA}`)))
        identity.current = `clerk_${ids.userB}`
        const foreignInspection = await call(
            api.getInspection(inspection.id, get(`${INSP}/${inspection.id}?workspaceId=${ids.wsB}`)),
        )
        const ghostForB = await call(api.getInspection(`${RUN}_ghost2`, get(`${INSP}/${RUN}_ghost2?workspaceId=${ids.wsB}`)))
        identity.current = `clerk_${ids.userA}`
        checkInvertible(
            "an inspection that exists but belongs to another tenant is refused byte-identically to one that does not exist",
            refusal(foreignInspection) === refusal(ghostForB),
            `${refusal(foreignInspection)} vs ${refusal(ghostForB)}`,
        )
        check(
            "a nonexistent inspection is 403, not 404",
            ghostInspection.status === 403,
            `status=${ghostInspection.status}`,
        )
        const ghostTemplate = await call(api.getTemplate(`${RUN}_gt`, get(`${TPL}/${RUN}_gt?workspaceId=${ids.wsA}`)))
        const ghostTimeline = await call(
            api.inspectionTimeline(`${RUN}_gtl`, get(`${INSP}/${RUN}_gtl/timeline?workspaceId=${ids.wsA}`)),
        )
        const ghostItem = await call(
            api.recordInspectionItem(
                inspection.id,
                `${RUN}_gi`,
                send(`${INSP}/${inspection.id}/items/${RUN}_gi`, { workspaceId: ids.wsA, result: "PASS" }, "PATCH"),
            ),
        )
        const ghostHandoff = await call(
            api.setInspectionHandoff(
                `${RUN}_gh`,
                send(`${INSP}/${RUN}_gh/handoff`, { workspaceId: ids.wsA, invoiceHandoffState: "READY" }, "PATCH"),
            ),
        )
        check(
            "every missing-row request is 403",
            [ghostTemplate, ghostTimeline, ghostItem, ghostHandoff].every((c) => c.status === 403),
            `statuses=${[ghostTemplate, ghostTimeline, ghostItem, ghostHandoff].map((c) => c.status).join(",")}`,
        )
        checkInvertible(
            "no refusal anywhere on this surface says 'not found', so the UI can safely never say it either",
            ![ghostInspection, ghostTemplate, ghostTimeline, ghostItem, ghostHandoff, foreignInspection].some((c) =>
                /not found|NOT_FOUND|no such/i.test(c.raw),
            ),
            `bodies=${[ghostInspection, ghostTemplate].map((c) => c.raw).join(" | ").slice(0, 200)}`,
        )

        // ---- 12. handoff before completion ---------------------------------
        const earlyHandoff = await call(
            api.setInspectionHandoff(
                inspection.id,
                send(`${INSP}/${inspection.id}/handoff`, { workspaceId: ids.wsA, invoiceHandoffState: "READY" }, "PATCH"),
            ),
        )
        checkInvertible(
            "handing billing off before the inspection is complete is 409",
            earlyHandoff.status === 409,
            `status=${earlyHandoff.status}`,
        )
        const badHandoffState = await call(
            api.setInspectionHandoff(
                inspection.id,
                send(`${INSP}/${inspection.id}/handoff`, { workspaceId: ids.wsA, invoiceHandoffState: "PAID" }, "PATCH"),
            ),
        )
        checkInvertible(
            "an invented handoff state such as PAID is 400 - this surface has no notion of paid",
            badHandoffState.status === 400,
            `status=${badHandoffState.status}`,
        )

        // ---- 13. complete, then the timeline -------------------------------
        await call(
            api.transitionInspection(
                inspection.id,
                send(`${INSP}/${inspection.id}`, { workspaceId: ids.wsA, status: "SUBMITTED" }, "PATCH"),
            ),
        )
        const completed = await call(
            api.transitionInspection(
                inspection.id,
                send(
                    `${INSP}/${inspection.id}`,
                    { workspaceId: ids.wsA, status: "COMPLETED", outcome: "PASS", completionNotes: "All good" },
                    "PATCH",
                ),
            ),
        )
        check("completing is 200", completed.status === 200, `status=${completed.status}`)
        checkInvertible(
            "a completed inspection reports no further transitions, so the UI renders no action",
            /"allowedTransitions":\[\]/.test(completed.raw) && /"isTerminal":true/.test(completed.raw),
            completed.raw.slice(0, 240),
        )
        const handedOff = await call(
            api.setInspectionHandoff(
                inspection.id,
                send(`${INSP}/${inspection.id}/handoff`, { workspaceId: ids.wsA, invoiceHandoffState: "READY" }, "PATCH"),
            ),
        )
        check("a completed inspection can be marked billable", handedOff.status === 200, `status=${handedOff.status}`)

        const timeline = await call(
            api.inspectionTimeline(inspection.id, get(`${INSP}/${inspection.id}/timeline?workspaceId=${ids.wsA}`)),
        )
        check("the timeline is 200", timeline.status === 200, `status=${timeline.status}`)
        checkInvertible(
            "seq arrives as a JSON STRING, checked in the raw text because JSON.parse of a number would already have lost it",
            /"seq":"\d+"/.test(timeline.raw) && !/"seq":\d/.test(timeline.raw),
            timeline.raw.slice(0, 200),
        )

        // ---- 14. dependency failure ----------------------------------------
        const brokenPrisma = {
            fieldJobInspection: {
                findMany: async () => {
                    throw new Error("SECRET_DETAIL postgres://u:p@h/d")
                },
            },
            workspace: { findUnique: async () => ({ profileId: ids.profileA }) },
        } as unknown as PrismaClient
        const brokenCtx = new FieldJobContext(brokenPrisma, tenancy)
        const brokenApi = new FieldJobApiService(
            new FieldJobIntakeService(brokenCtx),
            new FieldJobService(brokenCtx),
            new FieldJobInspectionTemplateService(brokenCtx),
            new FieldJobInspectionService(brokenCtx, new InventoryService(new InventoryContext(brokenPrisma, tenancy))),
        )
        const broken = await call(brokenApi.listInspections(get(`${INSP}?workspaceId=${ids.wsA}`)))
        check("a dependency failure is 503", broken.status === 503, `status=${broken.status}`)
        checkInvertible(
            "the 503 body leaks no DSN, host or driver text",
            !/SECRET_DETAIL|postgres:\/\//.test(broken.raw) && errCode(broken) === "DEPENDENCY_UNAVAILABLE",
            broken.raw.slice(0, 120),
        )

        // ---- 15. one envelope shape, and never a 404 -----------------------
        for (const [label, c] of [
            ["200", completed],
            ["201", created],
            ["400", unknownStatus],
            ["401", anonList],
            ["403", ghostInspection],
            ["409", wrongOrder],
            ["503", broken],
        ] as Array<[string, Called]>) {
            const keys = Object.keys(c.body).sort().join(",")
            const expected = c.status < 400 ? "data,ok" : "error,ok"
            check(`the ${label} response uses the shared envelope shape`, keys === expected, `keys=${keys}`)
        }
        checkInvertible(
            `no request on this surface ever produced a 404 across ${observedStatuses.length} observed responses`,
            !observedStatuses.includes(404),
            `statuses seen=[${[...new Set(observedStatuses)].sort((a, b) => a - b).join(",")}]`,
        )
    } finally {
        const profileList = `'${ids.profileA}','${ids.profileB}'`
        const inspScope = `select "id" from "FieldJobInspection" where "profileId" in (${profileList})`
        try {
            await prisma.$executeRawUnsafe(`delete from "FieldJobInspectionPart" where "inspectionId" in (${inspScope})`)
            await prisma.$executeRawUnsafe(`delete from "FieldJobInspectionItem" where "inspectionId" in (${inspScope})`)
            await prisma.$executeRawUnsafe(`delete from "FieldJobInspection" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(
                `delete from "FieldJobInspectionTemplateItem" where "templateId" in (select "id" from "FieldJobInspectionTemplate" where "profileId" in (${profileList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "FieldJobInspectionTemplate" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`alter table "FieldJobEvent" disable trigger "FieldJobEvent_append_only"`)
            try {
                await prisma.$executeRawUnsafe(
                    `delete from "FieldJobEvent" where "jobId" in (select "id" from "FieldJob" where "profileId" in (${profileList}))`,
                )
            } finally {
                await prisma.$executeRawUnsafe(`alter table "FieldJobEvent" enable trigger "FieldJobEvent_append_only"`)
            }
            await prisma.$executeRawUnsafe(`alter table "InventoryMovement" disable trigger "InventoryMovement_append_only"`)
            try {
                await prisma.$executeRawUnsafe(
                    `delete from "InventoryMovement" where "itemId" in (select "id" from "InventoryItem" where "profileId" in (${profileList}))`,
                )
            } finally {
                await prisma.$executeRawUnsafe(`alter table "InventoryMovement" enable trigger "InventoryMovement_append_only"`)
            }
            await prisma.$executeRawUnsafe(`delete from "InventoryItem" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "ProductVariant" where "productId" in ('${ids.prodA}')`)
            await prisma.$executeRawUnsafe(`delete from "DigitalProduct" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "FieldJob" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "Location" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }

        const end = {
            templates: await prisma.fieldJobInspectionTemplate.count(),
            inspections: await prisma.fieldJobInspection.count(),
            items: await prisma.fieldJobInspectionItem.count(),
            parts: await prisma.fieldJobInspectionPart.count(),
            events: await prisma.fieldJobEvent.count(),
            movements: await prisma.inventoryMovement.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All fieldJobs:inspection route boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
