/**
 * Wave G3 / part one: retainer runtime harness.
 *
 * Executes the REAL CaseRetainerService against the authorized disposable rehearsal database with
 * a controlled identity. Executable boundary evidence, not prose.
 *
 * Four negative claims are measured rather than asserted:
 *   * zero external calls - global fetch is replaced with a counting blocker
 *   * zero side effects on refusal - counts are compared either side of every refusal
 *   * zero residue - every fixture row is removed and counts return to baseline
 *   * no payment execution - the Payment table count is captured at the start and re-checked
 *     after the entire billing lifecycle has run
 *
 * The two claims most worth measuring rather than trusting:
 *   * CONCURRENCY. Two draws fired genuinely in parallel against one open period must BOTH land,
 *     with after-balances that chain correctly. This is the opposite of the inventory case, where
 *     exactly one writer wins: consumption is additive, so losing one would silently forget work.
 *   * THE LEDGER CHECKS ITSELF. Replaying every delta must reproduce the period's used balance.
 *
 * Set INVERT_ASSERTION=1 to flip one expectation and prove the harness fails loudly.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-retainer-runtime.ts
 */
import { PrismaClient } from "@prisma/client"

import { CaseProjectService } from "../../src/lib/cases/engine"
import {
    RETAINER_PERIOD_STATES,
    RETAINER_STATES,
    retainerFlow,
    retainerPeriodFlow,
} from "../../src/lib/cases/lifecycle"
import { CaseRetainerService } from "../../src/lib/cases/retainers"
import { CaseContext } from "../../src/lib/cases/shared"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `wg3rr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
/** Flipped individually by INVERT_ASSERTION=1; identical to checkInvertible() otherwise. */
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

type RetainerLockObservation = Readonly<{
    lockWaiters: number
    ungranted: number
    idleInTransaction: number
    backends: number
    lockTypes: string
}>

/**
 * Positive evidence that T2 REACHED the database and is blocked on a LOCK.
 *
 * Added for the same reason as the equivalent probe in check-inventory-runtime.ts: the interleaving
 * proof below rested on an ABSENCE of signal - "T2 did not reach its second read within 300ms" - and
 * that one observation is produced identically by a row-lock wait, a connection-pool wait, a slow
 * pre-transaction preamble, or event-loop starvation. Asking Postgres what T2 is waiting ON turns the
 * absence into a measurement.
 */
async function observeRetainerLocks(observer: PrismaClient): Promise<RetainerLockObservation> {
    const rows = await observer.$queryRawUnsafe<
        Array<{ lockwaiters: bigint; ungranted: bigint; idleintx: bigint; backends: bigint; locktypes: string | null }>
    >(`
        select
            (select count(*) from pg_stat_activity a
              where a.datname = current_database() and a.wait_event_type = 'Lock') as lockwaiters,
            (select count(*) from pg_locks l join pg_stat_activity a on a.pid = l.pid
              where not l.granted and a.datname = current_database()) as ungranted,
            (select count(*) from pg_stat_activity a
              where a.datname = current_database() and a.state = 'idle in transaction') as idleintx,
            (select count(*) from pg_stat_activity a
              where a.datname = current_database()) as backends,
            (select string_agg(distinct l.locktype, ',') from pg_locks l join pg_stat_activity a on a.pid = l.pid
              where not l.granted and a.datname = current_database()) as locktypes
    `)
    const row = rows[0]
    return Object.freeze({
        lockWaiters: Number(row?.lockwaiters ?? 0),
        ungranted: Number(row?.ungranted ?? 0),
        idleInTransaction: Number(row?.idleintx ?? 0),
        backends: Number(row?.backends ?? 0),
        lockTypes: row?.locktypes ?? "",
    })
}

async function awaitRetainerLockWaiter(observer: PrismaClient, milliseconds: number): Promise<RetainerLockObservation> {
    const deadline = Date.now() + milliseconds
    let best = await observeRetainerLocks(observer)
    while (Date.now() < deadline) {
        if (best.lockWaiters > 0) return best
        await new Promise((resolve) => setTimeout(resolve, 50))
        const next = await observeRetainerLocks(observer)
        if (next.lockWaiters > best.lockWaiters || next.ungranted > best.ungranted) best = next
    }
    return best
}

async function settlesWithin(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
    return Promise.race([
        promise.then(
            () => true,
            () => true,
        ),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), milliseconds)),
    ])
}

type ReadInterleaving = {
    periodId: string
    reads: number
    firstRead: ReturnType<typeof deferred<void>>
    secondRead: ReturnType<typeof deferred<void>>
    releaseFirst: ReturnType<typeof deferred<void>>
}

let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (...args: unknown[]) => {
    fetchCalls += 1
    throw new Error(`BLOCKED external call: ${String(args[0])}`)
}) as unknown as typeof fetch

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

type Envelope = { ok: true } | { ok: false; code: string; message: string }
async function attempt(fn: () => Promise<unknown>): Promise<Envelope> {
    try {
        await fn()
        return { ok: true }
    } catch (e) {
        if (e instanceof PersistenceError) return { ok: false, code: e.code, message: e.message }
        return { ok: false, code: "UNEXPECTED", message: (e as Error).message.split("\n")[0] }
    }
}
function why(o: Envelope): string {
    return o.ok ? "ACCEPTED" : `${o.code}: ${o.message}`
}

const actor = { actorType: "STAFF" as const, actorId: "harness" }

async function main() {
    const url = process.env.DATABASE_URL
    const db = parseDatabaseName(url)
    assertDisposableTarget(url)
    if (db !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${db}`)
        process.exit(1)
    }

    // The pool is PINNED and a separate observer client added, for the reason documented on
    // observeRetainerLocks: with Prisma's machine-dependent default pool, a parked T1 could starve T2
    // of a CONNECTION and the proof below could not tell that apart from a row-lock wait.
    const retainerPinnedUrl = `${url}${url!.includes("?") ? "&" : "?"}connection_limit=5`
    const prisma = new PrismaClient({ datasources: { db: { url: retainerPinnedUrl } } })
    const observer = new PrismaClient({
        datasources: { db: { url: `${url}${url!.includes("?") ? "&" : "?"}connection_limit=2` } },
    })
    let interleaving: ReadInterleaving | null = null
    prisma.$use(async (params, next) => {
        const output = await next(params)
        const gate = interleaving
        const args = params.args as { where?: { id?: unknown } } | undefined
        if (
            gate &&
            params.model === "CaseRetainerPeriod" &&
            (params.action === "findUnique" || params.action === "findUniqueOrThrow") &&
            args?.where?.id === gate.periodId
        ) {
            gate.reads += 1
            if (gate.reads === 1) {
                gate.firstRead.resolve()
                // This runs after recordDraw has read the balance but before it calculates or writes.
                // The transaction, and therefore its source-level FOR UPDATE locks, remain open here.
                await gate.releaseFirst.promise
            } else if (gate.reads === 2) {
                gate.secondRead.resolve()
            }
        }
        return output
    })
    const identity = new ControlledIdentity()
    const ctx = new CaseContext(prisma, new PersistedTenancy(prisma, identity))
    const cases = new CaseProjectService(ctx)
    const retainers = new CaseRetainerService(ctx)

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
        contactA: `${RUN}_ca`,
    }
    const base = { retainers: 0, periods: 0, draws: 0, links: 0, events: 0, cases: 0, payments: 0, invoices: 0 }

    try {
        base.retainers = await prisma.caseRetainer.count()
        base.periods = await prisma.caseRetainerPeriod.count()
        base.draws = await prisma.caseRetainerDraw.count()
        base.links = await prisma.caseRetainerCaseLink.count()
        base.events = await prisma.caseRetainerEvent.count()
        base.cases = await prisma.caseProject.count()
        base.payments = await prisma.payment.count()
        base.invoices = await prisma.caseInvoice.count()

        // ---- 0. the two lifecycle tables are total and terminal-correct -----
        for (const { label, all, can } of [
            { label: "retainer", all: RETAINER_STATES, can: (a: string, b: string) => retainerFlow.can(a as never, b as never) },
            { label: "period", all: RETAINER_PERIOD_STATES, can: (a: string, b: string) => retainerPeriodFlow.can(a as never, b as never) },
        ]) {
            let legal = 0
            let illegal = 0
            for (const from of all) {
                for (const to of all) {
                    if (can(from, to)) legal += 1
                    else illegal += 1
                }
            }
            checkInvertible(
                `${label} transition table is total over ${all.length}x${all.length} pairs`,
                legal + illegal === all.length ** 2,
                `legal=${legal} illegal=${illegal}`,
            )
        }
        checkInvertible(
            "EXPIRED and CANCELLED retainers are terminal, so a cancelled agreement cannot be revived",
            retainerFlow.isTerminal("EXPIRED") && retainerFlow.isTerminal("CANCELLED"),
        )
        checkInvertible(
            "every ended period state is terminal, so a closed window cannot silently reopen",
            retainerPeriodFlow.isTerminal("CLOSED") &&
                retainerPeriodFlow.isTerminal("RENEWED") &&
                retainerPeriodFlow.isTerminal("LAPSED"),
        )
        checkInvertible("PAUSED is reachable from ACTIVE and back", retainerFlow.can("ACTIVE", "PAUSED") && retainerFlow.can("PAUSED", "ACTIVE"))
        checkInvertible("CANCELLED is not reachable from EXPIRED", !retainerFlow.can("EXPIRED", "CANCELLED"))

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
        await prisma.contact.create({
            data: { id: ids.contactA, workspaceId: ids.wsA, displayName: "Client", confidence: "CONFIRMED" },
        })

        // ---- 1. anonymous is refused and writes nothing ---------------------
        identity.current = null
        const beforeAnon = await prisma.caseRetainer.count()
        const anonCreate = await attempt(() =>
            retainers.create(ids.wsA, { reference: "R", title: "T", basis: "UNITS", includedUnits: 10 }, actor),
        )
        const anonList = await attempt(() => retainers.list(ids.wsA))
        const afterAnon = await prisma.caseRetainer.count()
        checkInvertible("anonymous create refused UNAUTHORIZED", !anonCreate.ok && anonCreate.code === "UNAUTHORIZED", why(anonCreate))
        checkInvertible("anonymous list refused UNAUTHORIZED", !anonList.ok && anonList.code === "UNAUTHORIZED", why(anonList))
        checkInvertible("anonymous wrote zero retainers", beforeAnon === afterAnon, `before=${beforeAnon} after=${afterAnon}`)

        // ---- 2. the agreement cannot be self-contradictory at the engine ----
        identity.current = `clerk_${ids.userA}`
        const bothBases = await attempt(() =>
            retainers.create(
                ids.wsA,
                { reference: "BAD1", title: "T", basis: "UNITS", includedUnits: 10, includedValueCents: 500 },
                actor,
            ),
        )
        checkInvertible(
            "a retainer denominated in both units and money is refused with a named conflict, not a constraint violation",
            !bothBases.ok && bothBases.code === "CONFLICT",
            why(bothBases),
        )
        const monthlyDays = await attempt(() =>
            retainers.create(
                ids.wsA,
                { reference: "BAD2", title: "T", basis: "UNITS", includedUnits: 10, periodKind: "MONTHLY", periodDays: 30 },
                actor,
            ),
        )
        checkInvertible("a MONTHLY retainer carrying periodDays is refused", !monthlyDays.ok && monthlyDays.code === "CONFLICT", why(monthlyDays))
        const customNoDays = await attempt(() =>
            retainers.create(ids.wsA, { reference: "BAD3", title: "T", basis: "UNITS", includedUnits: 10, periodKind: "CUSTOM" }, actor),
        )
        checkInvertible("a CUSTOM retainer with no periodDays is refused", !customNoDays.ok && customNoDays.code === "CONFLICT", why(customNoDays))
        const afterBad = await prisma.caseRetainer.count()
        checkInvertible("three refused agreements wrote zero rows", afterBad === afterAnon, `count=${afterBad}`)

        // ---- 3. create, idempotency, derived period length ------------------
        const created = await retainers.create(
            ids.wsA,
            {
                reference: "RET-1",
                title: "Monthly advisory",
                basis: "UNITS",
                includedUnits: 40,
                contactId: ids.contactA,
                idempotencyKey: "k1",
            },
            actor,
        )
        checkInvertible("retainer created DRAFT", created.record.state === "DRAFT", `state=${created.record.state}`)
        checkInvertible("period length is derived from MONTHLY, not stored", created.record.periodLengthDays === 30, `days=${created.record.periodLengthDays}`)
        const replay = await retainers.create(
            ids.wsA,
            { reference: "RET-DIFFERENT", title: "different", basis: "VALUE", includedValueCents: 999, idempotencyKey: "k1" },
            actor,
        )
        checkInvertible(
            "replaying the idempotency key returns the original agreement, not a second one",
            replay.replayed && replay.record.id === created.record.id && replay.record.reference === "RET-1",
            `replayed=${replay.replayed} reference=${replay.record.reference}`,
        )
        const dupReference = await attempt(() =>
            retainers.create(ids.wsA, { reference: "RET-1", title: "clash", basis: "UNITS", includedUnits: 5 }, actor),
        )
        checkInvertible("a duplicate reference in the same workspace is a CONFLICT", !dupReference.ok && dupReference.code === "CONFLICT", why(dupReference))

        const retainerId = created.record.id

        // ---- 4. a DRAFT agreement cannot be used ---------------------------
        const draftPeriod = await attempt(() => retainers.openPeriod(ids.wsA, retainerId, {}, actor))
        checkInvertible("a DRAFT retainer cannot open a period", !draftPeriod.ok && draftPeriod.code === "CONFLICT", why(draftPeriod))
        const draftDraw = await attempt(() => retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 1 }, actor))
        checkInvertible("a DRAFT retainer cannot accept a draw", !draftDraw.ok && draftDraw.code === "CONFLICT", why(draftDraw))

        // ---- 5. activation, cases, and coverage ----------------------------
        const activated = await retainers.transition(ids.wsA, retainerId, "ACTIVE", actor)
        checkInvertible("activation stamps activatedAt", activated.activatedAt !== null, `activatedAt=${activated.activatedAt}`)
        checkInvertible(
            "an ACTIVE retainer exposes only its real next moves",
            [...activated.allowedTransitions].sort().join(",") === "CANCELLED,EXPIRED,PAUSED",
            activated.allowedTransitions.join(","),
        )

        const caseA = await cases.create(ids.wsA, { reference: "C-1", title: "Advisory work" }, actor)
        const caseA2 = await cases.create(ids.wsA, { reference: "C-2", title: "Unlinked work" }, actor)
        identity.current = `clerk_${ids.userB}`
        const caseB = await cases.create(ids.wsB, { reference: "C-B", title: "Other tenant" }, actor)
        identity.current = `clerk_${ids.userA}`

        const linked = await retainers.linkCase(ids.wsA, retainerId, caseA.record.id, actor)
        checkInvertible("linking a case in the same workspace succeeds", linked.linked)
        const relink = await retainers.linkCase(ids.wsA, retainerId, caseA.record.id, actor)
        checkInvertible("re-linking the same case is a no-op rather than a duplicate or an error", relink.linked === false)
        const foreignLink = await attempt(() => retainers.linkCase(ids.wsA, retainerId, caseB.record.id, actor))
        checkInvertible(
            "linking another tenant's case is FORBIDDEN, and indistinguishable from a case that does not exist",
            !foreignLink.ok && foreignLink.code === "FORBIDDEN",
            why(foreignLink),
        )
        const ghostLink = await attempt(() => retainers.linkCase(ids.wsA, retainerId, `${RUN}_nope`, actor))
        checkInvertible(
            "linking a nonexistent case produces the identical refusal",
            !ghostLink.ok && ghostLink.code === "FORBIDDEN" && ghostLink.message === (foreignLink as { message: string }).message,
            why(ghostLink),
        )

        // ---- 6. periods ----------------------------------------------------
        const period1 = await retainers.openPeriod(ids.wsA, retainerId, {}, actor)
        checkInvertible("the first period is ordinal 1 and OPEN", period1.ordinal === 1 && period1.state === "OPEN", `ordinal=${period1.ordinal}`)
        checkInvertible("the allowance is snapshot onto the period", period1.includedUnits === 40, `included=${period1.includedUnits}`)
        checkInvertible("remaining is derived on read", period1.remaining === 40 && period1.overage === 0, `remaining=${period1.remaining}`)
        checkInvertible(
            "the period is dated 30 days long, from the derived MONTHLY length",
            Math.round((period1.endsOn.getTime() - period1.startsOn.getTime()) / 86_400_000) === 30,
        )
        const secondOpen = await attempt(() => retainers.openPeriod(ids.wsA, retainerId, {}, actor))
        checkInvertible("a second open period is refused while one is open", !secondOpen.ok && secondOpen.code === "CONFLICT", why(secondOpen))

        // ---- 7. draws ------------------------------------------------------
        const unlinkedDraw = await attempt(() =>
            retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 2, caseId: caseA2.record.id }, actor),
        )
        checkInvertible(
            "a draw naming a case the retainer does not cover is refused",
            !unlinkedDraw.ok && unlinkedDraw.code === "CONFLICT",
            why(unlinkedDraw),
        )
        const wrongBasis = await attempt(() => retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", valueCents: 500 }, actor))
        checkInvertible("a money draw against a unit period is refused", !wrongBasis.ok && wrongBasis.code === "CONFLICT", why(wrongBasis))
        const negativeDraw = await attempt(() => retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: -3 }, actor))
        checkInvertible("a negative DRAW is refused and pointed at CREDIT", !negativeDraw.ok && negativeDraw.code === "CONFLICT", why(negativeDraw))
        const zeroDraw = await attempt(() => retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 0 }, actor))
        checkInvertible("a zero draw is refused", !zeroDraw.ok && zeroDraw.code === "CONFLICT", why(zeroDraw))

        const drawsBeforeRefusals = await prisma.caseRetainerDraw.count()
        const usedBefore = (await prisma.caseRetainerPeriod.findUniqueOrThrow({ where: { id: period1.id } })).usedUnits
        checkInvertible("four refused draws wrote no ledger row", drawsBeforeRefusals === base.draws, `draws=${drawsBeforeRefusals}`)
        checkInvertible("four refused draws left the balance untouched", usedBefore === 0, `used=${usedBefore}`)

        const d1 = await retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 6, caseId: caseA.record.id, note: "review" }, actor)
        checkInvertible("a draw against a covered case is accepted", d1.draw.unitsDelta === 6, `delta=${d1.draw.unitsDelta}`)
        checkInvertible("the draw records the balance it produced", d1.draw.usedUnitsAfter === 6, `after=${d1.draw.usedUnitsAfter}`)
        checkInvertible("the period reflects the draw in the same transaction", d1.period.usedUnits === 6 && d1.period.remaining === 34, `used=${d1.period.usedUnits}`)

        const idem1 = await retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 5, idempotencyKey: "d-1" }, actor)
        const idem2 = await retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 5, idempotencyKey: "d-1" }, actor)
        checkInvertible(
            "replaying a draw idempotency key returns the original and consumes nothing further",
            idem2.replayed && idem2.draw.id === idem1.draw.id && idem2.period.usedUnits === 11,
            `replayed=${idem2.replayed} used=${idem2.period.usedUnits}`,
        )

        const credit = await retainers.recordDraw(ids.wsA, retainerId, { kind: "CREDIT", units: -4, note: "engagement cancelled" }, actor)
        checkInvertible("a CREDIT returns allowance and is recorded as its own kind", credit.period.usedUnits === 7 && credit.draw.kind === "CREDIT", `used=${credit.period.usedUnits}`)
        const overCredit = await attempt(() => retainers.recordDraw(ids.wsA, retainerId, { kind: "CREDIT", units: -100 }, actor))
        checkInvertible(
            "a credit larger than what was used is refused, so the balance cannot go negative",
            !overCredit.ok && overCredit.code === "CONFLICT",
            why(overCredit),
        )

        // ---- 8. OVERAGE is accepted and reported ---------------------------
        const over = await retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 40, caseId: caseA.record.id }, actor)
        checkInvertible(
            "a draw past the allowance is ACCEPTED, because refusing work that was done would be a lie",
            over.period.usedUnits === 47,
            `used=${over.period.usedUnits}`,
        )
        checkInvertible("the overage is reported, not hidden", over.period.overage === 7 && over.period.remaining === 0, `overage=${over.period.overage}`)

        // ---- 9. CONCURRENCY: both parallel draws must land -----------------
        const beforeParallel = (await prisma.caseRetainerPeriod.findUniqueOrThrow({ where: { id: period1.id } })).usedUnits
        const parallel = await Promise.allSettled([
            retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 3 }, actor),
            retainers.recordDraw(ids.wsA, retainerId, { kind: "DRAW", units: 5 }, actor),
        ])
        const landed = parallel.filter((p) => p.status === "fulfilled").length
        const afterParallel = (await prisma.caseRetainerPeriod.findUniqueOrThrow({ where: { id: period1.id } })).usedUnits
        checkInvertible(
            "MEASURED: two genuinely parallel draws BOTH land - consumption is additive, so a lost writer would forget real work",
            landed === 2,
            `landed=${landed}/2`,
        )
        checkInvertible(
            "the two parallel draws sum correctly, so neither overwrote the other's balance",
            afterParallel === beforeParallel + 8,
            `${beforeParallel} -> ${afterParallel}`,
        )

        // ---- 10. the ledger checks itself ---------------------------------
        const ledger = await prisma.caseRetainerDraw.findMany({
            where: { periodId: period1.id },
            orderBy: { seq: "asc" },
            select: { unitsDelta: true, usedUnitsAfter: true },
        })
        let running = 0
        let mismatch = ""
        for (const row of ledger) {
            running += row.unitsDelta ?? 0
            if (running !== row.usedUnitsAfter) mismatch = `expected ${running}, stored ${row.usedUnitsAfter}`
        }
        checkInvertible(
            "replaying every delta reproduces every stored after-balance, and the final one matches the period",
            // The row-count pin belongs in THIS condition, not only in the sibling
            // assertion below it. On an empty ledger the loop never runs, so `mismatch`
            // stays "" and `running` stays 0 - and if the period also read 0 this would
            // report that replay reproduces every balance without replaying one.
            ledger.length === 6 && mismatch === "" && running === afterParallel,
            mismatch || `rows=${ledger.length} replay=${running} period=${afterParallel}`,
        )
        checkInvertible("the ledger has a row per accepted draw and no more", ledger.length === 6, `rows=${ledger.length}`)

        // ---- 10. deterministic read interleaving proves lock necessity -----
        // Promise.all alone may serialize by scheduling. Here the middleware above pauses T1 only
        // after recordDraw has read this period's balance. T2 then calls the same service method.
        // With FOR UPDATE it cannot reach its own balance read until T1 commits; without both locks
        // it reads the same stale balance, commits first, and T1 overwrites that balance after release.
        const interleaved = await retainers.create(
            ids.wsA,
            { reference: "RET-INTERLEAVE", title: "Forced read interleaving", basis: "UNITS", includedUnits: 40 },
            actor,
        )
        await retainers.transition(ids.wsA, interleaved.record.id, "ACTIVE", actor)
        const interleavedPeriod = await retainers.openPeriod(ids.wsA, interleaved.record.id, {}, actor)
        const interleaveBefore = interleavedPeriod.usedUnits
        const gate: ReadInterleaving = {
            periodId: interleavedPeriod.id,
            reads: 0,
            firstRead: deferred<void>(),
            secondRead: deferred<void>(),
            releaseFirst: deferred<void>(),
        }
        interleaving = gate
        // WHAT THIS SECTION ESTABLISHES, measured rather than assumed, and NARROWED after review.
        //
        // `recordDraw` executes exactly two of the four `for update` clauses in
        // src/lib/cases/retainers.ts: the open-period lock at :713 and the retainer lock at :928. The
        // other two (:542 in transitionPeriod, :623 in setBilling) are NOT on this path, so removing
        // them could not have changed the result and is no evidence of anything. An earlier version of
        // this comment claimed all four were individually redundant on the strength of four mutations,
        // two of which were vacuous by construction - the same overclaim this harness's own defect was.
        //
        // What the mutations actually show: removing either :713 or :928 alone leaves this harness green
        // at 90/90 exit 0, and removing both together turns it red - lockWaiters drops to 0 and `used`
        // goes 0->3 instead of 0->8, which is the lost update, one draw's absolute write overwriting the
        // other's. So of the two locks recordDraw executes, EITHER ALONE serialises these two draws.
        //
        // That is still materially different from inventory, where the single `for update` in
        // InventoryContext.lockItem() is individually necessary and removing just that one flips the
        // result. Note also that joint necessity is established by an out-of-band mutation this
        // assertion cannot see; the assertion below measures serialisation, and its name says so.
        const t1 = retainers.recordDraw(ids.wsA, interleaved.record.id, { kind: "DRAW", units: 3 }, actor)
        const firstReadReached = await settlesWithin(gate.firstRead.promise, 1_500)
        let t2: Promise<unknown> | null = null
        let secondReadBeforeRelease = false
        let retainerLockEvidence: RetainerLockObservation = {
            lockWaiters: 0,
            ungranted: 0,
            idleInTransaction: 0,
            backends: 0,
            lockTypes: "",
        }
        try {
            if (firstReadReached) {
                t2 = retainers.recordDraw(ids.wsA, interleaved.record.id, { kind: "DRAW", units: 5 }, actor)
                // POSITIVE evidence first, and T2 gets the same budget T1 got. The removed conjunct
                // `!t2CommittedBeforeRelease` was assigned only inside `if (secondReadBeforeRelease)`,
                // which is false on every passing run, so it held its initialiser and asserted nothing.
                retainerLockEvidence = await awaitRetainerLockWaiter(observer, 1_500)
                secondReadBeforeRelease = await settlesWithin(gate.secondRead.promise, 300)
            }
        } finally {
            // This is an application-level barrier, not a database timeout: no SQL error is used
            // as evidence, and releasing it always lets both transactions commit or report normally.
            gate.releaseFirst.resolve()
        }
        const outcomes = await Promise.allSettled(t2 ? [t1, t2] : [t1])
        interleaving = null
        const interleaveAfter = (await prisma.caseRetainerPeriod.findUniqueOrThrow({ where: { id: interleavedPeriod.id } })).usedUnits
        checkInvertible(
            "MEASURED: while T1 is parked, Postgres reports T2 blocked on a TRANSACTIONID lock - not merely absent",
            firstReadReached &&
                retainerLockEvidence.lockWaiters >= 1 &&
                retainerLockEvidence.lockTypes.includes("transactionid"),
            `lockWaiters=${retainerLockEvidence.lockWaiters} ungranted=${retainerLockEvidence.ungranted} types=${retainerLockEvidence.lockTypes}`,
        )
        checkInvertible(
            "MEASURED: T2 reached the database, so it was not starved of a pooled connection",
            // >= 3, not >= 2. The observer client running this probe always counts itself, and the
            // second conjunct already requires a distinct backend for parked T1, so `>= 2` was entailed
            // by its own sibling and could never fail. See the same correction in
            // check-inventory-runtime.ts, from which this probe was copied along with the defect.
            retainerLockEvidence.backends >= 3 && retainerLockEvidence.idleInTransaction >= 1,
            `backends=${retainerLockEvidence.backends} idleInTx=${retainerLockEvidence.idleInTransaction} (pool pinned to 5)`,
        )
        checkInvertible(
            "MEASURED: the two draws serialize - one lands, the other reads the updated balance, and the total is 8",
            firstReadReached &&
                !secondReadBeforeRelease &&
                outcomes.length === 2 &&
                outcomes.every((outcome) => outcome.status === "fulfilled") &&
                interleaveAfter === interleaveBefore + 8,
            `T1 balance read=${firstReadReached}; T2 balance read before release=${secondReadBeforeRelease}; lockWaiters=${retainerLockEvidence.lockWaiters}; used=${interleaveBefore}->${interleaveAfter}`,
        )

        // ---- 11. unlinking is refused once history exists ------------------
        const unlink = await attempt(() => retainers.unlinkCase(ids.wsA, retainerId, caseA.record.id, actor))
        checkInvertible(
            "a case that has drawn cannot be unlinked, because the ledger names it",
            !unlink.ok && unlink.code === "CONFLICT",
            why(unlink),
        )

        // ---- 12. billing state moves; no payment happens ------------------
        const invoice = await prisma.caseInvoice.create({
            data: { id: `${RUN}_inv`, caseId: caseA.record.id, reference: "INV-1", amountCents: 400000, state: "DRAFT" },
        })
        const foreignInvoice = await prisma.caseInvoice.create({
            data: { id: `${RUN}_inv2`, caseId: caseA2.record.id, reference: "INV-2", amountCents: 100, state: "DRAFT" },
        })
        const badBilling = await attempt(() => retainers.setBilling(ids.wsA, retainerId, period1.id, "ISSUED", actor))
        checkInvertible("moving billing straight to ISSUED from NONE is refused", !badBilling.ok && badBilling.code === "CONFLICT", why(badBilling))
        const draftBilling = await retainers.setBilling(ids.wsA, retainerId, period1.id, "DRAFT", actor)
        checkInvertible("billing enters DRAFT first, using the existing invoice vocabulary", draftBilling.billingState === "DRAFT")
        const uncoveredInvoice = await attempt(() =>
            retainers.setBilling(ids.wsA, retainerId, period1.id, "ISSUED", actor, { invoiceId: foreignInvoice.id }),
        )
        checkInvertible(
            "an invoice on a case the retainer does not cover is refused",
            !uncoveredInvoice.ok && uncoveredInvoice.code === "CONFLICT",
            why(uncoveredInvoice),
        )
        const issued = await retainers.setBilling(ids.wsA, retainerId, period1.id, "ISSUED", actor, { invoiceId: invoice.id })
        checkInvertible("a covered invoice is recorded against the period", issued.invoiceId === invoice.id && issued.billingState === "ISSUED")
        const paid = await retainers.setBilling(ids.wsA, retainerId, period1.id, "PAID", actor)
        checkInvertible("billing can reach PAID and is then terminal", paid.billingState === "PAID" && paid.allowedBillingTransitions.length === 0)
        const paymentsNow = await prisma.payment.count()
        checkInvertible(
            "the entire billing lifecycle created no Payment row",
            paymentsNow === base.payments,
            `payments ${base.payments} -> ${paymentsNow}`,
        )

        // ---- 13. renewal creates the next period atomically ---------------
        const renewed = await retainers.transitionPeriod(ids.wsA, retainerId, period1.id, "RENEWED", actor)
        checkInvertible("the renewed period is terminal", renewed.period.state === "RENEWED" && renewed.period.allowedTransitions.length === 0)
        checkInvertible("renewal produced the next period in the same call", renewed.next !== null && renewed.next.ordinal === 2, `next=${renewed.next?.ordinal}`)
        checkInvertible(
            "the next period starts where the last one ended, so there is no gap in coverage",
            renewed.next!.startsOn.getTime() === period1.endsOn.getTime(),
        )
        checkInvertible(
            "the new period starts with a fresh allowance and no rollover, because the agreement forbids it",
            renewed.next!.includedUnits === 40 && renewed.next!.usedUnits === 0,
            `included=${renewed.next!.includedUnits}`,
        )
        const reRenew = await attempt(() => retainers.transitionPeriod(ids.wsA, retainerId, period1.id, "CLOSED", actor))
        checkInvertible("a renewed period cannot then be closed", !reRenew.ok && reRenew.code === "CONFLICT", why(reRenew))

        // ---- 14. rollover, on a second agreement that allows it -----------
        const roll = await retainers.create(
            ids.wsA,
            { reference: "RET-ROLL", title: "Rollover", basis: "VALUE", includedValueCents: 100000, rolloverAllowed: true },
            actor,
        )
        await retainers.transition(ids.wsA, roll.record.id, "ACTIVE", actor)
        const rp1 = await retainers.openPeriod(ids.wsA, roll.record.id, {}, actor)
        await retainers.recordDraw(ids.wsA, roll.record.id, { kind: "DRAW", valueCents: 30000 }, actor)
        const rolled = await retainers.transitionPeriod(ids.wsA, roll.record.id, rp1.id, "RENEWED", actor)
        checkInvertible(
            "rollover carries the unused remainder forward, so 100000 + 70000 unused = 170000",
            rolled.next!.includedValueCents === 170000,
            `included=${rolled.next!.includedValueCents}`,
        )
        const rollBalance = await retainers.balance(ids.wsA, roll.record.id)
        checkInvertible(
            "lifetime totals span every period, so a closed period's consumption is not forgotten",
            rollBalance.lifetimeUsed === 30000 && rollBalance.periodCount === 2,
            `used=${rollBalance.lifetimeUsed} periods=${rollBalance.periodCount}`,
        )
        checkInvertible("balance names the open period", rollBalance.openPeriod?.id === rolled.next!.id)

        // ---- 15. a paused agreement stops accepting work ------------------
        await retainers.transition(ids.wsA, roll.record.id, "PAUSED", actor)
        const pausedDraw = await attempt(() => retainers.recordDraw(ids.wsA, roll.record.id, { kind: "DRAW", valueCents: 100 }, actor))
        checkInvertible("a PAUSED retainer cannot accept a draw", !pausedDraw.ok && pausedDraw.code === "CONFLICT", why(pausedDraw))
        const pausedRenew = await attempt(() => retainers.transitionPeriod(ids.wsA, roll.record.id, rolled.next!.id, "RENEWED", actor))
        checkInvertible("a PAUSED retainer cannot be renewed", !pausedRenew.ok && pausedRenew.code === "CONFLICT", why(pausedRenew))
        const lapsed = await retainers.transitionPeriod(ids.wsA, roll.record.id, rolled.next!.id, "LAPSED", actor)
        checkInvertible("a paused agreement's period can still be marked LAPSED, which is what actually happened", lapsed.period.state === "LAPSED")
        checkInvertible("lapsing does not create a next period", lapsed.next === null)

        // ---- 16. tenant isolation and non-enumeration ---------------------
        identity.current = `clerk_${ids.userB}`
        const foreignGet = await attempt(() => retainers.get(ids.wsB, retainerId))
        const ghostGet = await attempt(() => retainers.get(ids.wsB, `${RUN}_ghost`))
        checkInvertible("another tenant reading the retainer is FORBIDDEN", !foreignGet.ok && foreignGet.code === "FORBIDDEN", why(foreignGet))
        checkInvertible(
            "a foreign retainer and a nonexistent one produce the identical refusal",
            !foreignGet.ok && !ghostGet.ok && foreignGet.code === ghostGet.code && foreignGet.message === ghostGet.message,
            `${why(foreignGet)} vs ${why(ghostGet)}`,
        )
        const crossWorkspace = await attempt(() => retainers.get(ids.wsA, retainerId))
        checkInvertible(
            "naming someone else's workspace is refused before the retainer is even read",
            !crossWorkspace.ok && crossWorkspace.code === "FORBIDDEN",
            why(crossWorkspace),
        )
        const bList = await retainers.list(ids.wsB)
        checkInvertible("the other tenant's list is empty rather than filtered from a shared page", bList.length === 0, `n=${bList.length}`)
        identity.current = `clerk_${ids.userA}`

        // ---- 17. the agreement history is complete and append-only --------
        const timeline = await retainers.timeline(ids.wsA, retainerId)
        const subjects = new Set(timeline.map((e) => e.subjectType))
        checkInvertible(
            "the history covers the agreement, its periods, its case links, its billing and its draws",
            ["agreement", "period", "caseLink", "billing", "draw"].every((s) => subjects.has(s)),
            [...subjects].join(","),
        )
        checkInvertible("history is ordered by a monotonic sequence", timeline.length > 0 && timeline.every((e, i) => i === 0 || BigInt(e.seq) > BigInt(timeline[i - 1].seq)))
        const rewrite = await attempt(() =>
            prisma.$executeRawUnsafe(`update "CaseRetainerEvent" set "to" = 'TAMPERED' where "retainerId" = '${retainerId}'`),
        )
        checkInvertible("the database refuses to rewrite the agreement history", !rewrite.ok, why(rewrite))
        const eraseDraw = await attempt(() =>
            prisma.$executeRawUnsafe(`delete from "CaseRetainerDraw" where "retainerId" = '${retainerId}'`),
        )
        checkInvertible("the database refuses to erase the draw ledger", !eraseDraw.ok, why(eraseDraw))

        // ---- 18. a case event is written where the reader will look -------
        const caseEvents = await prisma.caseEvent.count({ where: { caseId: caseA.record.id, kind: "RETAINER" } })
        checkInvertible(
            "retainer activity involving a case also lands on that case's timeline",
            caseEvents >= 2,
            `retainer events on the case=${caseEvents}`,
        )

        // ---- 19. cancellation is final -----------------------------------
        await retainers.transition(ids.wsA, retainerId, "CANCELLED", actor, "client ended the engagement")
        const revive = await attempt(() => retainers.transition(ids.wsA, retainerId, "ACTIVE", actor))
        checkInvertible("a cancelled retainer cannot be revived", !revive.ok && revive.code === "CONFLICT", why(revive))

        // ---- 20. zero external calls -------------------------------------
        checkInvertible("zero external calls were made by the retainer runtime", fetchCalls === 0, `fetchCalls=${fetchCalls}`)
    } finally {
        globalThis.fetch = realFetch
        const wsList = `'${ids.wsA}','${ids.wsB}'`
        try {
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerEvent" disable trigger "CaseRetainerEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerEvent" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerEvent" enable trigger "CaseRetainerEvent_append_only"`)
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerDraw" disable trigger "CaseRetainerDraw_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerDraw" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseRetainerDraw" enable trigger "CaseRetainerDraw_append_only"`)
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" disable trigger "CaseEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseEvent" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`alter table "CaseEvent" enable trigger "CaseEvent_append_only"`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerPeriod" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(
                `delete from "CaseRetainerCaseLink" where "retainerId" in (select "id" from "CaseRetainer" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "CaseRetainer" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(
                `delete from "CaseInvoice" where "caseId" in (select "id" from "CaseProject" where "workspaceId" in (${wsList}))`,
            )
            await prisma.$executeRawUnsafe(`delete from "CaseProject" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Contact" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Membership" where "workspaceId" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Workspace" where "id" in (${wsList})`)
            await prisma.$executeRawUnsafe(`delete from "Profile" where "id" in ('${ids.profileA}','${ids.profileB}')`)
            await prisma.$executeRawUnsafe(`delete from "User" where "id" in ('${ids.userA}','${ids.userB}')`)
        } catch (e) {
            console.error(`teardown warning: ${(e as Error).message.split("\n")[0]}`)
        }

        const end = {
            retainers: await prisma.caseRetainer.count(),
            periods: await prisma.caseRetainerPeriod.count(),
            draws: await prisma.caseRetainerDraw.count(),
            links: await prisma.caseRetainerCaseLink.count(),
            events: await prisma.caseRetainerEvent.count(),
            cases: await prisma.caseProject.count(),
            payments: await prisma.payment.count(),
            invoices: await prisma.caseInvoice.count(),
        }
        for (const key of Object.keys(base) as Array<keyof typeof base>) {
            check(`${key} rows returned to baseline`, end[key] === base[key], `baseline=${base[key]} end=${end[key]}`)
        }
        const armed = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `select count(*) as n from information_schema.triggers
              where trigger_name in ('CaseRetainerDraw_append_only','CaseRetainerEvent_append_only','CaseEvent_append_only')`,
        )
        // Three triggers, each firing on two events, so six information_schema rows.
        check("every append-only trigger was re-armed after teardown", Number(armed[0].n) === 6, `rows=${armed[0].n}`)
        await prisma.$disconnect()
        await observer.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set - a failure here is the expected proof")
    if (failed.length) process.exit(1)
    console.log("All retainer runtime boundaries hold.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
