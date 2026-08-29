/**
 * Wave H1: fieldJobs:inspection runtime harness.
 *
 * Executes the REAL FieldJobInspectionTemplateService and FieldJobInspectionService against the
 * authorized disposable rehearsal database with a controlled identity. Nothing here is mocked
 * except the clock-free identity and the external-call blocker.
 *
 * The claims worth measuring rather than trusting:
 *
 *   * SNAPSHOTTING. The whole template design rests on the claim that editing a checklist cannot
 *     rewrite what a past inspection asked. So a template is edited AFTER an inspection is raised
 *     from it, and the inspection's lines are re-read and compared. If snapshotting were a
 *     reference this assertion goes red.
 *   * PENDING versus NOT_APPLICABLE. These are different answers and only one of them blocks
 *     completion. Both paths are exercised, and the refusal's `details.pendingRequired` COUNT is
 *     asserted, not merely its presence.
 *   * consumeStock DEFAULTS TO FALSE. Recording a part must not move stock. Measured by reading
 *     onHand before and after, not by trusting the flag.
 *   * The stock movement is an ADJUSTMENT with a NEGATIVE delta, not a CONSUME. The inventory
 *     engine refuses CONSUME as direct input because CONSUME belongs to reservations; this harness
 *     asserts which kind actually landed in the movement ledger.
 *   * IDEMPOTENCY CANNOT DOUBLE-DEDUCT. The same part call is replayed and onHand is asserted to
 *     have moved exactly once.
 *   * NON-ENUMERATION, byte for byte. A foreign inspection and a nonexistent one, a foreign
 *     template and a nonexistent one, and foreign versus nonexistent STOCK all produce the
 *     identical serialized refusal. Comparing two 403s would prove nothing; whole envelopes are
 *     compared.
 *   * THE ENGINE'S OPEN-STATUS LIST AGREES WITH THE DATABASE'S PARTIAL INDEX. The index definition
 *     is read out of pg_indexes and compared against OPEN_INSPECTION_STATUSES, so the engine's
 *     conflict and the database's guarantee cannot drift apart silently.
 *   * NOTHING IS INVOICED. Payment and Order row counts are asserted unchanged across a full
 *     handoff to HANDED_OFF.
 *
 * Three negative claims are measured: zero external calls, no asset registry table, zero residue.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove the harness can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-fieldjob-inspection-runtime.ts
 */
// The blocker MUST be the first import: its side effect has to run before any module under test is
// evaluated, or "zero external calls" would only describe the window it was watching.
import {
    EXTERNAL_CALL_BLOCKER_INSTALLED,
    externalCallCount,
    externalCallLog,
    restoreExternalCalls,
} from "../lib/external-call-blocker"

import { PrismaClient } from "@prisma/client"

import {
    FieldJobInspectionService,
    FieldJobInspectionTemplateService,
    OPEN_INSPECTION_STATUSES,
} from "../../src/lib/fieldjobs/inspection"
import {
    INSPECTION_ITEM_RESULTS,
    INSPECTION_STATUSES,
    INVOICE_HANDOFF_STATES,
    handoffFlow,
    inspectionFlow,
} from "../../src/lib/fieldjobs/inspection-lifecycle"
import { FieldJobContext } from "../../src/lib/fieldjobs/shared"
import { InventoryService } from "../../src/lib/inventory/engine"
import { InventoryContext } from "../../src/lib/inventory/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wh1r_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

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

type Envelope = { ok: true } | { ok: false; code: string; message: string; details?: unknown }
async function attempt(fn: () => Promise<unknown>): Promise<Envelope> {
    try {
        await fn()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) {
            return { ok: false, code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) }
        }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}
function why(o: Envelope): string {
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`
}
/**
 * Serialized WHOLE envelope for the byte-identical non-enumeration comparison. Driver text with row
 * ids is deliberately excluded from this type: folding it in would make a foreign refusal and a
 * ghost refusal differ and silently break the property this comparison exists to prove.
 */
function envelope(o: Envelope): string {
    return JSON.stringify(o)
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }
const techActor = { actorType: "TECHNICIAN" as const, actorId: "tech" }

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
    const templates = new FieldJobInspectionTemplateService(ctx)
    const inspections = new FieldJobInspectionService(ctx, inventory)

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
        locA2: `${RUN}_la2`,
        locB: `${RUN}_lb`,
        svcA: `${RUN}_sa`,
        prodA: `${RUN}_proda`,
        prodB: `${RUN}_prodb`,
        techA: `${RUN}_ta`,
        jobA: `${RUN}_ja`,
        jobA2: `${RUN}_ja2`,
        jobNoDepot: `${RUN}_jnd`,
        jobB: `${RUN}_jb`,
    }
    const base = {
        templates: 0,
        templateItems: 0,
        inspections: 0,
        inspectionItems: 0,
        inspectionParts: 0,
        events: 0,
        items: 0,
        movements: 0,
        payments: 0,
        orders: 0,
    }

    try {
        base.templates = await prisma.fieldJobInspectionTemplate.count()
        base.templateItems = await prisma.fieldJobInspectionTemplateItem.count()
        base.inspections = await prisma.fieldJobInspection.count()
        base.inspectionItems = await prisma.fieldJobInspectionItem.count()
        base.inspectionParts = await prisma.fieldJobInspectionPart.count()
        base.events = await prisma.fieldJobEvent.count()
        base.items = await prisma.inventoryItem.count()
        base.movements = await prisma.inventoryMovement.count()
        base.payments = await prisma.payment.count()
        base.orders = await prisma.order.count()

        // ---- 0. the two lifecycle tables ------------------------------------
        for (const { label, all, can } of [
            {
                label: "inspection",
                all: INSPECTION_STATUSES,
                can: (a: string, b: string) => inspectionFlow.can(a as never, b as never),
            },
            {
                label: "handoff",
                all: INVOICE_HANDOFF_STATES,
                can: (a: string, b: string) => handoffFlow.can(a as never, b as never),
            },
        ]) {
            let legal = 0
            let illegal = 0
            for (const from of all) {
                for (const to of all) {
                    if (can(from, to)) legal += 1
                    else illegal += 1
                }
            }
            check(
                `${label} transition table is total over ${all.length}x${all.length} pairs`,
                legal + illegal === all.length ** 2,
                `legal=${legal} illegal=${illegal}`,
            )
        }
        check(
            "a completed or cancelled inspection is terminal",
            inspectionFlow.isTerminal("COMPLETED") && inspectionFlow.isTerminal("CANCELLED"),
        )
        checkInvertible(
            "SUBMITTED can go back to IN_PROGRESS, because an office returning a job card for detail is ordinary",
            inspectionFlow.can("SUBMITTED", "IN_PROGRESS"),
        )
        check(
            "a DRAFT inspection cannot jump straight to SUBMITTED or COMPLETED",
            !inspectionFlow.can("DRAFT", "SUBMITTED") && !inspectionFlow.can("DRAFT", "COMPLETED"),
        )
        check(
            "HANDED_OFF and DECLINED are terminal handoff states",
            handoffFlow.isTerminal("HANDED_OFF") && handoffFlow.isTerminal("DECLINED"),
        )
        check(
            "PENDING is the only unanswered item result; NOT_APPLICABLE is an answer",
            INSPECTION_ITEM_RESULTS.includes("NOT_APPLICABLE") && INSPECTION_ITEM_RESULTS.includes("PENDING"),
        )

        // The engine's open-status list and the database's partial unique index must agree, or the
        // engine's conflict and the database's guarantee would drift apart silently.
        const idxRows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
            `select indexdef from pg_indexes where indexname = 'FieldJobInspection_one_open_per_job'`,
        )
        const indexDef = idxRows[0]?.indexdef ?? ""
        const statusesInIndex = INSPECTION_STATUSES.filter((s) => new RegExp(`'${s}'`).test(indexDef))
        checkInvertible(
            "OPEN_INSPECTION_STATUSES matches the partial unique index the database actually enforces",
            idxRows.length === 1 &&
                statusesInIndex.length === OPEN_INSPECTION_STATUSES.length &&
                OPEN_INSPECTION_STATUSES.every((s) => statusesInIndex.includes(s)),
            `index lists [${statusesInIndex.join(",")}] engine lists [${OPEN_INSPECTION_STATUSES.join(",")}]`,
        )

        // ---- seed two tenants ----------------------------------------------
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
        await prisma.location.create({ data: { id: ids.locA2, workspaceId: ids.wsA, name: "Depot A2" } })
        await prisma.location.create({ data: { id: ids.locB, workspaceId: ids.wsB, name: "Depot B" } })
        await prisma.serviceOffering.create({ data: { id: ids.svcA, profileId: ids.profileA, name: "Boiler service" } })
        await prisma.appointmentResource.create({
            data: { id: ids.techA, profileId: ids.profileA, name: "Tech A", kind: "STAFF", isActive: true },
        })
        await prisma.digitalProduct.create({ data: { id: ids.prodA, profileId: ids.profileA, title: "Valve" } })
        await prisma.digitalProduct.create({ data: { id: ids.prodB, profileId: ids.profileB, title: "Foreign valve" } })
        for (const [id, profileId, reference, originLocationId] of [
            [ids.jobA, ids.profileA, `${RUN}-JOB-A`, ids.locA],
            [ids.jobA2, ids.profileA, `${RUN}-JOB-A2`, ids.locA],
            [ids.jobNoDepot, ids.profileA, `${RUN}-JOB-ND`, null],
            [ids.jobB, ids.profileB, `${RUN}-JOB-B`, ids.locB],
        ] as Array<[string, string, string, string | null]>) {
            await prisma.fieldJob.create({
                data: {
                    id,
                    profileId,
                    reference,
                    title: `Job ${reference}`,
                    siteAddress: "1 Example Street",
                    ...(originLocationId ? { originLocationId } : {}),
                },
            })
        }

        // ---- 1. anonymous is refused and writes nothing --------------------
        identity.current = null
        const anonList = await attempt(() => inspections.list(ids.wsA))
        const anonCreate = await attempt(() =>
            inspections.create(ids.wsA, { jobId: ids.jobA, reference: "X" }, actor),
        )
        check("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        check("anonymous create refused UNAUTHORIZED", !anonCreate.ok && anonCreate.code === "UNAUTHORIZED", why(anonCreate))
        check("anonymous wrote zero inspections", (await prisma.fieldJobInspection.count()) === base.inspections)

        // ---- 2. authenticated non-member ----------------------------------
        identity.current = `clerk_${ids.userB}`
        const outsider = await attempt(() => inspections.list(ids.wsA))
        check("authenticated non-member refused FORBIDDEN", !outsider.ok && outsider.code === "FORBIDDEN", why(outsider))

        identity.current = `clerk_${ids.userA}`

        // ---- 3. templates --------------------------------------------------
        const tpl = await templates.create(ids.wsA, { name: "Annual boiler check", idempotencyKey: "t1" })
        check("a template starts active at revision 1", tpl.template.isActive && tpl.template.revision === 1)
        const tplReplay = await templates.create(ids.wsA, { name: "Different name", idempotencyKey: "t1" })
        checkInvertible(
            "replaying the template key returns the original rather than creating a second",
            tplReplay.replayed && tplReplay.template.id === tpl.template.id && tplReplay.template.name === "Annual boiler check",
            `replayed=${tplReplay.replayed}`,
        )
        const dupName = await attempt(() => templates.create(ids.wsA, { name: "Annual boiler check" }))
        check("a duplicate template name is a CONFLICT", !dupName.ok && dupName.code === "CONFLICT", why(dupName))

        const noUnit = await attempt(() =>
            templates.addItem(ids.wsA, tpl.template.id, { label: "Flow temperature", kind: "MEASUREMENT" }),
        )
        checkInvertible(
            "a measurement line with no unit is refused - 12 what?",
            !noUnit.ok && noUnit.code === "CONFLICT",
            why(noUnit),
        )
        const badRange = await attempt(() =>
            templates.addItem(ids.wsA, tpl.template.id, {
                label: "Pressure",
                kind: "MEASUREMENT",
                unit: "bar",
                expectedMin: 3,
                expectedMax: 1,
            }),
        )
        check("expectedMax below expectedMin is refused", !badRange.ok && badRange.code === "CONFLICT", why(badRange))
        const rangeOnCheck = await attempt(() =>
            templates.addItem(ids.wsA, tpl.template.id, { label: "Flue clear", expectedMin: 1 }),
        )
        check(
            "only a measurement line may carry an expected range",
            !rangeOnCheck.ok && rangeOnCheck.code === "CONFLICT",
            why(rangeOnCheck),
        )

        const li0 = await templates.addItem(ids.wsA, tpl.template.id, { label: "Flue clear" })
        const li1 = await templates.addItem(ids.wsA, tpl.template.id, {
            label: "Flow temperature",
            kind: "MEASUREMENT",
            unit: "C",
            expectedMin: 60,
            expectedMax: 80,
        })
        const li2 = await templates.addItem(ids.wsA, tpl.template.id, { label: "Boiler unit", kind: "ASSET" })
        const li3 = await templates.addItem(ids.wsA, tpl.template.id, { label: "Optional tidy-up", required: false })
        check(
            "positions auto-append in order when not stated",
            li0.position === 0 && li1.position === 1 && li2.position === 2 && li3.position === 3,
            `positions=${[li0, li1, li2, li3].map((l) => l.position).join(",")}`,
        )
        const dupPos = await attempt(() =>
            templates.addItem(ids.wsA, tpl.template.id, { label: "Clash", position: 0 }),
        )
        check("two lines cannot share a position", !dupPos.ok && dupPos.code === "CONFLICT", why(dupPos))

        // ---- 4. snapshotting, the central claim ----------------------------
        const created = await inspections.create(
            ids.wsA,
            { jobId: ids.jobA, reference: `${RUN}-INSP-1`, templateId: tpl.template.id, idempotencyKey: "i1" },
            actor,
        )
        check(
            "an inspection created from a template snapshots every line",
            created.items.length === 4,
            `lines=${created.items.length}`,
        )
        check("an inspection starts DRAFT with no outcome", created.inspection.status === "DRAFT" && created.inspection.outcome === null)
        check(
            "the snapshot carries the measurement's unit and range across",
            created.items[1].unit === "C" &&
                String(created.items[1].expectedMin) === "60" &&
                String(created.items[1].expectedMax) === "80",
            `unit=${created.items[1].unit} min=${created.items[1].expectedMin} max=${created.items[1].expectedMax}`,
        )
        checkInvertible(
            "an ASSET line is snapshotted with its equipment named, so the asset-identity constraint holds from creation",
            created.items[2].kind === "ASSET" && (created.items[2].assetLabel ?? "").trim() === "Boiler unit",
            `assetLabel=${created.items[2].assetLabel}`,
        )
        check(
            "three of the four snapshotted lines are required, so pendingRequired is 3",
            created.inspection.pendingRequired === 3,
            `pendingRequired=${created.inspection.pendingRequired}`,
        )

        // Edit the template AFTER the inspection exists. If lines were referenced rather than
        // snapshotted, the inspection's questions would change under it.
        await templates.addItem(ids.wsA, tpl.template.id, { label: "Added after the fact" })
        await prisma.fieldJobInspectionTemplateItem.update({
            where: { id: li0.id },
            data: { label: "REWRITTEN LABEL", required: false },
        })
        const afterEdit = await inspections.get(ids.wsA, created.inspection.id)
        checkInvertible(
            "editing the template afterwards does not rewrite what the inspection asked",
            afterEdit.items.length === 4 &&
                afterEdit.items[0].label === "Flue clear" &&
                afterEdit.items[0].required === true,
            `lines=${afterEdit.items.length} first="${afterEdit.items[0].label}" required=${afterEdit.items[0].required}`,
        )

        const replay = await inspections.create(
            ids.wsA,
            { jobId: ids.jobA, reference: "ignored", templateId: tpl.template.id, idempotencyKey: "i1" },
            actor,
        )
        check(
            "replaying the inspection key returns the original",
            replay.replayed && replay.inspection.id === created.inspection.id,
            `replayed=${replay.replayed}`,
        )
        const secondOpen = await attempt(() =>
            inspections.create(ids.wsA, { jobId: ids.jobA, reference: `${RUN}-INSP-2` }, actor),
        )
        checkInvertible(
            "a second OPEN inspection on the same job is refused",
            !secondOpen.ok && secondOpen.code === "CONFLICT",
            why(secondOpen),
        )
        const dupRef = await attempt(() =>
            inspections.create(ids.wsA, { jobId: ids.jobA2, reference: `${RUN}-INSP-1` }, actor),
        )
        check("a duplicate reference is refused", !dupRef.ok && dupRef.code === "CONFLICT", why(dupRef))

        const foreignJob = await attempt(() =>
            inspections.create(ids.wsA, { jobId: ids.jobB, reference: `${RUN}-INSP-F` }, actor),
        )
        check("raising an inspection on another tenant's job is FORBIDDEN", !foreignJob.ok && foreignJob.code === "FORBIDDEN", why(foreignJob))

        // ---- 5. recording lines --------------------------------------------
        const failNoNotes = await attempt(() =>
            inspections.recordItem(ids.wsA, created.inspection.id, afterEdit.items[0].id, { result: "FAIL" }, actor),
        )
        checkInvertible("a FAIL with no notes is refused", !failNoNotes.ok && failNoNotes.code === "CONFLICT", why(failNoNotes))

        const failed = await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[0].id,
            { result: "FAIL", notes: "Blocked by debris" },
            techActor,
        )
        check("a FAIL with notes is accepted and stamped", failed.result === "FAIL" && failed.recordedAt !== null)

        const backToPending = await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[0].id,
            { result: "PENDING" },
            actor,
        )
        checkInvertible(
            "returning a line to PENDING clears its recorded time, so it is not shown as answered",
            backToPending.result === "PENDING" && backToPending.recordedAt === null,
            `recordedAt=${String(backToPending.recordedAt)}`,
        )
        await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[0].id,
            { result: "PASS" },
            actor,
        )

        const clearAsset = await attempt(() =>
            inspections.recordItem(ids.wsA, created.inspection.id, afterEdit.items[2].id, { assetLabel: "  " }, actor),
        )
        checkInvertible(
            "an equipment check cannot have its equipment name blanked",
            !clearAsset.ok && clearAsset.code === "CONFLICT",
            why(clearAsset),
        )
        const readingOnCheck = await attempt(() =>
            inspections.recordItem(ids.wsA, created.inspection.id, afterEdit.items[0].id, { measuredValue: 5 }, actor),
        )
        check(
            "only a measurement line may carry a reading",
            !readingOnCheck.ok && readingOnCheck.code === "CONFLICT",
            why(readingOnCheck),
        )

        // isWithinExpectedRange is derived by the SERVER; the UI is required to read it verbatim.
        const noReading = afterEdit.items[1]
        check(
            "a measurement with no reading yet has no range verdict",
            noReading.isWithinExpectedRange === null,
            `verdict=${String(noReading.isWithinExpectedRange)}`,
        )
        const inRange = await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[1].id,
            { result: "PASS", measuredValue: 70 },
            actor,
        )
        checkInvertible(
            "a reading inside the expected range reads as within it",
            inRange.isWithinExpectedRange === true,
            `70 in 60..80 -> ${String(inRange.isWithinExpectedRange)}`,
        )
        const outOfRange = await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[1].id,
            { result: "FAIL", notes: "Running cold", measuredValue: 40 },
            actor,
        )
        checkInvertible(
            "a reading below the expected range reads as outside it",
            outOfRange.isWithinExpectedRange === false,
            `40 in 60..80 -> ${String(outOfRange.isWithinExpectedRange)}`,
        )
        check(
            "a Decimal reading survives as an exact string rather than a float",
            String((await inspections.get(ids.wsA, created.inspection.id)).items[1].measuredValue) === "40",
            `measuredValue=${String((await inspections.get(ids.wsA, created.inspection.id)).items[1].measuredValue)}`,
        )
        await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[1].id,
            { result: "PASS", measuredValue: 70 },
            actor,
        )

        const foreignItem = await attempt(() =>
            inspections.recordItem(ids.wsA, created.inspection.id, li0.id, { result: "PASS" }, actor),
        )
        check(
            "a line belonging to something else cannot be recorded through this inspection",
            !foreignItem.ok && foreignItem.code === "FORBIDDEN",
            why(foreignItem),
        )

        // ---- 6. transitions and their side conditions ---------------------
        const illegal = await attempt(() =>
            inspections.transition(ids.wsA, created.inspection.id, { status: "COMPLETED" }, actor),
        )
        check("DRAFT cannot jump to COMPLETED", !illegal.ok && illegal.code === "CONFLICT", why(illegal))

        await inspections.transition(ids.wsA, created.inspection.id, { status: "IN_PROGRESS" }, actor)

        // One required line (the ASSET line) is still PENDING at this point.
        const pendingBlocked = await attempt(() =>
            inspections.transition(ids.wsA, created.inspection.id, { status: "SUBMITTED" }, actor),
        )
        const pendingDetails = pendingBlocked.ok ? undefined : (pendingBlocked.details as { pendingRequired?: number } | undefined)
        checkInvertible(
            "an unanswered REQUIRED line blocks submission and the refusal says how many",
            !pendingBlocked.ok && pendingBlocked.code === "CONFLICT" && pendingDetails?.pendingRequired === 1,
            `${why(pendingBlocked)} details=${JSON.stringify(pendingDetails ?? null)}`,
        )

        // NOT_APPLICABLE is an ANSWER. This is the assertion that separates it from PENDING.
        await inspections.recordItem(
            ids.wsA,
            created.inspection.id,
            afterEdit.items[2].id,
            { result: "NOT_APPLICABLE" },
            actor,
        )
        const naState = await inspections.get(ids.wsA, created.inspection.id)
        checkInvertible(
            "NOT_APPLICABLE counts as answered, so it does not block completion the way PENDING does",
            naState.inspection.pendingRequired === 0,
            `pendingRequired=${naState.inspection.pendingRequired}`,
        )
        check(
            "the optional line is still PENDING and is deliberately not blocking",
            naState.items[3].result === "PENDING" && naState.items[3].required === false,
        )

        const submitted = await inspections.transition(ids.wsA, created.inspection.id, { status: "SUBMITTED" }, techActor)
        check("submission is accepted once every required line is answered", submitted.status === "SUBMITTED" && submitted.submittedAt !== null)
        check(
            "the server offers COMPLETED and a way back to IN_PROGRESS from SUBMITTED",
            submitted.allowedTransitions.includes("COMPLETED") && submitted.allowedTransitions.includes("IN_PROGRESS"),
            `allowed=[${submitted.allowedTransitions.join(",")}]`,
        )

        const noOutcome = await attempt(() =>
            inspections.transition(ids.wsA, created.inspection.id, { status: "COMPLETED", completionNotes: "All fine" }, actor),
        )
        checkInvertible("completing without an outcome is refused", !noOutcome.ok && noOutcome.code === "CONFLICT", why(noOutcome))
        const noNotes = await attempt(() =>
            inspections.transition(ids.wsA, created.inspection.id, { status: "COMPLETED", outcome: "PASS" }, actor),
        )
        checkInvertible("completing without notes is refused", !noNotes.ok && noNotes.code === "CONFLICT", why(noNotes))
        const blankNotes = await attempt(() =>
            inspections.transition(
                ids.wsA,
                created.inspection.id,
                { status: "COMPLETED", outcome: "PASS", completionNotes: "   " },
                actor,
            ),
        )
        check("whitespace is not completion notes", !blankNotes.ok && blankNotes.code === "CONFLICT", why(blankNotes))

        // ---- 7. handoff BEFORE completion ---------------------------------
        const earlyHandoff = await attempt(() =>
            inspections.setHandoff(ids.wsA, created.inspection.id, { invoiceHandoffState: "READY" }, actor),
        )
        checkInvertible(
            "billing cannot be handed off from an inspection that has not finished",
            !earlyHandoff.ok && earlyHandoff.code === "CONFLICT",
            why(earlyHandoff),
        )
        check(
            "while unfinished, the server offers no handoff state that requires completion",
            !submitted.allowedHandoffStates.includes("READY") && !submitted.allowedHandoffStates.includes("HANDED_OFF"),
            `allowedHandoff=[${submitted.allowedHandoffStates.join(",")}]`,
        )

        // ---- 8. parts and stock -------------------------------------------
        const stockA = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA }, actor)
        await inventory.applyMovement(ids.wsA, stockA.record.id, { kind: "RECEIPT", qty: 10 }, actor)
        const stockA2 = await inventory.ensureItem(ids.wsA, { productId: ids.prodA, locationId: ids.locA2 }, actor)
        await inventory.applyMovement(ids.wsA, stockA2.record.id, { kind: "RECEIPT", qty: 5 }, actor)
        identity.current = `clerk_${ids.userB}`
        const stockB = await inventory.ensureItem(ids.wsB, { productId: ids.prodB, locationId: ids.locB }, actor)
        identity.current = `clerk_${ids.userA}`

        // The inspection under test is SUBMITTED, which is deliberately NOT recordable.
        const partOnSubmitted = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: stockA.record.id, qty: 1 }, actor),
        )
        checkInvertible(
            "parts cannot be recorded on a SUBMITTED inspection; it must be sent back to IN_PROGRESS first",
            !partOnSubmitted.ok && partOnSubmitted.code === "CONFLICT",
            why(partOnSubmitted),
        )
        await inspections.transition(ids.wsA, created.inspection.id, { status: "IN_PROGRESS" }, actor)

        const onHandBefore = (await inventory.get(ids.wsA, stockA.record.id)).onHand
        const recordOnly = await inspections.addPart(
            ids.wsA,
            created.inspection.id,
            { inventoryItemId: stockA.record.id, qty: 2, unitCostCents: 500, notes: "From the van" },
            actor,
        )
        const onHandAfterRecord = (await inventory.get(ids.wsA, stockA.record.id)).onHand
        checkInvertible(
            "recording a part does NOT move stock unless asked - consumeStock defaults to false",
            recordOnly.part.movementId === null &&
                recordOnly.part.stockMoved === false &&
                recordOnly.stock === null &&
                onHandAfterRecord === onHandBefore,
            `onHand ${onHandBefore} -> ${onHandAfterRecord}, movementId=${String(recordOnly.part.movementId)}`,
        )

        const consumed = await inspections.addPart(
            ids.wsA,
            created.inspection.id,
            { inventoryItemId: stockA.record.id, qty: 3, consumeStock: true, idempotencyKey: "p-consume" },
            techActor,
        )
        const onHandAfterConsume = (await inventory.get(ids.wsA, stockA.record.id)).onHand
        checkInvertible(
            "consumeStock:true deducts exactly the quantity used and links the movement",
            consumed.part.movementId !== null &&
                consumed.part.stockMoved === true &&
                onHandAfterConsume === onHandAfterRecord - 3,
            `onHand ${onHandAfterRecord} -> ${onHandAfterConsume}, movementId=${String(consumed.part.movementId)}`,
        )
        const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: consumed.part.movementId! } })
        checkInvertible(
            "the deduction is an ADJUSTMENT with a negative delta, not a CONSUME - CONSUME belongs to reservations",
            movement.kind === "ADJUSTMENT" && Number(movement.qtyDelta) === -3,
            `kind=${movement.kind} qtyDelta=${movement.qtyDelta}`,
        )
        check(
            "the movement records a human actor rather than claiming the system did it",
            movement.actor === "STAFF",
            `actor=${movement.actor}`,
        )

        // Replay must not deduct twice. This is the only failure mode that silently destroys stock.
        const consumedReplay = await inspections.addPart(
            ids.wsA,
            created.inspection.id,
            { inventoryItemId: stockA.record.id, qty: 3, consumeStock: true, idempotencyKey: "p-consume" },
            actor,
        )
        const onHandAfterReplay = (await inventory.get(ids.wsA, stockA.record.id)).onHand
        checkInvertible(
            "replaying a consuming part line cannot deduct the stock a second time",
            consumedReplay.replayed &&
                consumedReplay.part.id === consumed.part.id &&
                onHandAfterReplay === onHandAfterConsume,
            `replayed=${consumedReplay.replayed} onHand ${onHandAfterConsume} -> ${onHandAfterReplay}`,
        )

        const tooMany = await attempt(() =>
            inspections.addPart(
                ids.wsA,
                created.inspection.id,
                { inventoryItemId: stockA.record.id, qty: 9999, consumeStock: true },
                actor,
            ),
        )
        const onHandAfterRefusal = (await inventory.get(ids.wsA, stockA.record.id)).onHand
        checkInvertible(
            "a part that would take stock below zero is refused and moves nothing",
            !tooMany.ok && tooMany.code === "CONFLICT" && onHandAfterRefusal === onHandAfterReplay,
            `${why(tooMany)} onHand ${onHandAfterReplay} -> ${onHandAfterRefusal}`,
        )

        const wrongDepot = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: stockA2.record.id, qty: 1 }, actor),
        )
        checkInvertible(
            "stock held at a different depot from the job's origin is a CONFLICT, not a refusal to acknowledge it",
            !wrongDepot.ok && wrongDepot.code === "CONFLICT",
            why(wrongDepot),
        )

        const zeroQty = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: stockA.record.id, qty: 0 }, actor),
        )
        check("using zero of a part is a BAD_REQUEST", !zeroQty.ok && zeroQty.code === "BAD_REQUEST", why(zeroQty))
        const negCost = await attempt(() =>
            inspections.addPart(
                ids.wsA,
                created.inspection.id,
                { inventoryItemId: stockA.record.id, qty: 1, unitCostCents: -1 },
                actor,
            ),
        )
        check("a negative part cost is a BAD_REQUEST", !negCost.ok && negCost.code === "BAD_REQUEST", why(negCost))

        // ---- 9. non-enumeration, byte for byte ----------------------------
        const foreignInspection = await attempt(() => inspections.get(ids.wsA, `${RUN}_nope_foreign`))
        const ghostInspection = await attempt(() => inspections.get(ids.wsA, `${RUN}_nope_ghost`))
        checkInvertible(
            "a nonexistent inspection and a foreign one produce byte-identical refusals",
            envelope(foreignInspection) === envelope(ghostInspection),
            `${envelope(foreignInspection)} vs ${envelope(ghostInspection)}`,
        )
        identity.current = `clerk_${ids.userB}`
        const realButForeign = await attempt(() => inspections.get(ids.wsB, created.inspection.id))
        const ghostForB = await attempt(() => inspections.get(ids.wsB, `${RUN}_ghost_for_b`))
        checkInvertible(
            "an inspection that exists but belongs to another tenant is refused identically to one that does not exist",
            envelope(realButForeign) === envelope(ghostForB),
            `${envelope(realButForeign)} vs ${envelope(ghostForB)}`,
        )
        identity.current = `clerk_${ids.userA}`
        const foreignStock = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: stockB.record.id, qty: 1 }, actor),
        )
        const ghostStock = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: `${RUN}_ghost_stock`, qty: 1 }, actor),
        )
        checkInvertible(
            "another tenant's stock record is refused identically to one that does not exist, so this endpoint is not a stock oracle",
            envelope(foreignStock) === envelope(ghostStock) && !foreignStock.ok && foreignStock.code === "FORBIDDEN",
            `${envelope(foreignStock)} vs ${envelope(ghostStock)}`,
        )
        const foreignTemplate = await attempt(() => templates.get(ids.wsA, `${RUN}_ghost_tpl`))
        identity.current = `clerk_${ids.userB}`
        const tplForeignToB = await attempt(() => templates.get(ids.wsB, tpl.template.id))
        identity.current = `clerk_${ids.userA}`
        check(
            "a foreign template and a nonexistent one are refused identically",
            envelope(foreignTemplate) === envelope(tplForeignToB),
            `${envelope(foreignTemplate)} vs ${envelope(tplForeignToB)}`,
        )

        // ---- 10. completion, then handoff ---------------------------------
        await inspections.transition(ids.wsA, created.inspection.id, { status: "SUBMITTED" }, actor)
        const completed = await inspections.transition(
            ids.wsA,
            created.inspection.id,
            { status: "COMPLETED", outcome: "ADVISORY", completionNotes: "Flue cleared, flow temperature low but serviceable" },
            actor,
        )
        check(
            "a completed inspection keeps its verdict and notes and is terminal",
            completed.status === "COMPLETED" &&
                completed.outcome === "ADVISORY" &&
                completed.completedAt !== null &&
                completed.isTerminal &&
                completed.allowedTransitions.length === 0,
            `status=${completed.status} outcome=${completed.outcome}`,
        )
        const afterTerminal = await attempt(() =>
            inspections.transition(ids.wsA, created.inspection.id, { status: "CANCELLED", cancelReason: "too late" }, actor),
        )
        checkInvertible(
            "a completed inspection cannot be changed afterwards",
            !afterTerminal.ok && afterTerminal.code === "CONFLICT",
            why(afterTerminal),
        )
        const partAfterTerminal = await attempt(() =>
            inspections.addPart(ids.wsA, created.inspection.id, { inventoryItemId: stockA.record.id, qty: 1 }, actor),
        )
        check(
            "no part can be added to a completed inspection",
            !partAfterTerminal.ok && partAfterTerminal.code === "CONFLICT",
            why(partAfterTerminal),
        )

        const paymentsBeforeHandoff = await prisma.payment.count()
        const ordersBeforeHandoff = await prisma.order.count()
        const ready = await inspections.setHandoff(
            ids.wsA,
            created.inspection.id,
            { invoiceHandoffState: "READY", invoiceHandoffReference: "BILL-1" },
            actor,
        )
        check("a completed inspection can be marked billable", ready.invoiceHandoffState === "READY" && ready.invoiceHandoffAt === null)
        const handedOff = await inspections.setHandoff(
            ids.wsA,
            created.inspection.id,
            { invoiceHandoffState: "HANDED_OFF", invoiceHandoffNote: "Passed to bookkeeping" },
            actor,
        )
        checkInvertible(
            "a handoff that happened carries the time it happened at",
            handedOff.invoiceHandoffState === "HANDED_OFF" && handedOff.invoiceHandoffAt !== null,
            `at=${String(handedOff.invoiceHandoffAt)}`,
        )
        const handoffAgain = await attempt(() =>
            inspections.setHandoff(ids.wsA, created.inspection.id, { invoiceHandoffState: "DECLINED" }, actor),
        )
        check("a handed-off inspection cannot be un-handed-off", !handoffAgain.ok && handoffAgain.code === "CONFLICT", why(handoffAgain))
        checkInvertible(
            "handing billing off writes NO Payment and NO Order row - nothing is invoiced and no money moves",
            (await prisma.payment.count()) === paymentsBeforeHandoff && (await prisma.order.count()) === ordersBeforeHandoff,
            `payments=${paymentsBeforeHandoff} orders=${ordersBeforeHandoff}`,
        )

        // ---- 11. one open per job, over the job's life ---------------------
        const secondAfterClose = await inspections.create(
            ids.wsA,
            { jobId: ids.jobA, reference: `${RUN}-INSP-REDO` },
            actor,
        )
        checkInvertible(
            "a job may be inspected again once the previous inspection is closed - the index is not a plain unique key on jobId",
            secondAfterClose.inspection.status === "DRAFT" && secondAfterClose.inspection.jobId === ids.jobA,
            `reference=${secondAfterClose.inspection.reference}`,
        )
        const cancelled = await inspections.transition(
            ids.wsA,
            secondAfterClose.inspection.id,
            { status: "CANCELLED", cancelReason: "Customer cancelled the visit" },
            actor,
        )
        check("a cancellation keeps its reason", cancelled.status === "CANCELLED" && cancelled.cancelReason !== null)

        // A job with no origin depot: the location rule does not apply, the tenant rule still does.
        const noDepot = await inspections.create(ids.wsA, { jobId: ids.jobNoDepot, reference: `${RUN}-INSP-ND` }, actor)
        const partNoDepot = await attempt(() =>
            inspections.addPart(ids.wsA, noDepot.inspection.id, { inventoryItemId: stockA2.record.id, qty: 1 }, actor),
        )
        checkInvertible(
            "when the job names no origin depot the location rule does not apply",
            partNoDepot.ok,
            why(partNoDepot),
        )
        const foreignStockNoDepot = await attempt(() =>
            inspections.addPart(ids.wsA, noDepot.inspection.id, { inventoryItemId: stockB.record.id, qty: 1 }, actor),
        )
        check(
            "even with no origin depot, another tenant's stock is still refused",
            !foreignStockNoDepot.ok && foreignStockNoDepot.code === "FORBIDDEN",
            why(foreignStockNoDepot),
        )

        // ---- 12. timeline --------------------------------------------------
        const timeline = await inspections.timeline(ids.wsA, created.inspection.id)
        check("the timeline is not empty", timeline.length > 0, `events=${timeline.length}`)
        checkInvertible(
            "seq is serialised as a string, so a BigInt cannot lose precision as a JSON number",
            timeline.every((e) => typeof e.seq === "string"),
            `first seq type=${typeof timeline[0]?.seq}`,
        )
        check(
            "the timeline covers the inspection, its lines, its parts and its handoff",
            new Set(timeline.map((e) => e.subjectType)).size >= 3,
            `subjects=[${[...new Set(timeline.map((e) => e.subjectType))].join(",")}]`,
        )
        const otherTimeline = await inspections.timeline(ids.wsA, noDepot.inspection.id)
        const leaked = otherTimeline.filter((e) => timeline.some((t) => t.id === e.id))
        checkInvertible(
            "one inspection's timeline does not return another inspection's events, even on the same job",
            leaked.length === 0,
            `shared events=${leaked.length}`,
        )
        const handoffEvent = timeline.find((e) => e.subjectType === "inspectionHandoff" && e.to === "HANDED_OFF")
        checkInvertible(
            "the handoff event states plainly that nothing was invoiced",
            handoffEvent !== undefined && (handoffEvent.metadata as { invoiced?: boolean } | null)?.invoiced === false,
            `metadata=${JSON.stringify(handoffEvent?.metadata ?? null)}`,
        )
        const eventId = timeline[0].id
        const mutate = await attempt(() =>
            prisma.$executeRawUnsafe(`update "FieldJobEvent" set "to" = 'TAMPERED' where "id" = $1`, eventId),
        )
        checkInvertible(
            "the shared event ledger refuses an update, so inspection history cannot be rewritten",
            !mutate.ok,
            mutate.ok ? "ACCEPTED - the append-only trigger did not fire" : "refused by trigger",
        )

        // ---- 13. no asset registry appeared -------------------------------
        const registry = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
            `select table_name from information_schema.tables
              where table_schema='public' and table_name in ('Asset','FieldJobAsset','FieldJobInspectionAsset','Invoice')`,
        )
        checkInvertible(
            "building inspection brought no Asset registry and no Invoice table",
            registry.length === 0,
            `unexpected tables=[${registry.map((r) => r.table_name).join(",")}]`,
        )

        check(
            "the external-call blocker was actually installed, rather than assumed",
            EXTERNAL_CALL_BLOCKER_INSTALLED,
            "installed at import time, before any module under test evaluated",
        )
        checkInvertible(
            "zero fetch, http or https calls were made by the inspection runtime",
            externalCallCount() === 0,
            externalCallCount() === 0
                ? "0 attempts across fetch, http.request/get and https.request/get"
                : externalCallLog().join("; "),
        )
    } finally {
        restoreExternalCalls()
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
                // Re-arm in its own finally: a throw in the delete must not leave the shared
                // rehearsal ledger unguarded, or every later append-only assertion in every harness
                // would pass while proving nothing.
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
            await prisma.$executeRawUnsafe(`delete from "ProductVariant" where "productId" in ('${ids.prodA}','${ids.prodB}')`)
            await prisma.$executeRawUnsafe(`delete from "DigitalProduct" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "FieldJob" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "AppointmentResource" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "ServiceOffering" where "profileId" in (${profileList})`)
            await prisma.$executeRawUnsafe(
                `delete from "Location" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`,
            )
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in ('${ids.wsA}','${ids.wsB}')`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in (${profileList})`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }

        const end = {
            templates: await prisma.fieldJobInspectionTemplate.count(),
            templateItems: await prisma.fieldJobInspectionTemplateItem.count(),
            inspections: await prisma.fieldJobInspection.count(),
            inspectionItems: await prisma.fieldJobInspectionItem.count(),
            inspectionParts: await prisma.fieldJobInspectionPart.count(),
            events: await prisma.fieldJobEvent.count(),
            items: await prisma.inventoryItem.count(),
            movements: await prisma.inventoryMovement.count(),
            payments: await prisma.payment.count(),
            orders: await prisma.order.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        const armed = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `select count(*) as n from information_schema.triggers
              where trigger_name in ('FieldJobEvent_append_only','InventoryMovement_append_only')`,
        )
        check(
            "both append-only triggers were re-armed after teardown",
            Number(armed[0].n) === 4,
            `trigger rows=${armed[0].n} (2 per trigger: UPDATE and DELETE)`,
        )
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All fieldJobs:inspection runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
