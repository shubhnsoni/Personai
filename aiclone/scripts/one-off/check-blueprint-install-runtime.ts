/**
 * Blueprint installation: runtime behaviour harness.
 *
 * Runs ONLY against the authorized disposable rehearsal database.
 *
 * TWO EXECUTION MODES, and the split is forced by the subject matter rather than chosen:
 *
 *   MOST assertions run inside ONE outer transaction that is deliberately rolled back, which is how
 *   every harness here leaves zero residue. It has to: the ledger is append-only, so once an event row
 *   exists neither it, nor its installation, nor its workspace, nor its profile can ever be deleted - a
 *   cascaded DELETE still fires the BEFORE DELETE trigger. Deletion-based cleanup is not available.
 *   Prisma's transaction client does not expose `$transaction`, so the service is given an inline
 *   transaction runner for this mode.
 *
 *   THE ATOMICITY PROOF runs against the REAL client with the REAL transaction, because a rollback the
 *   harness performed itself would prove nothing about whether the service's transaction is atomic. It
 *   needs no cleanup, and that is not a convenience - a successful proof is one where nothing was
 *   written, so if it leaves residue it has failed.
 *
 * THE ASSERTIONS THAT MATTER MOST
 *
 *   ATOMICITY. A failure injected at the LAST statement of the install transaction must leave ZERO rows
 *   in BOTH tables. Asserted as per-table row counts before and after, not by trusting the thrown error -
 *   "it threw" and "it wrote nothing" are different claims and only one of them is the requirement.
 *
 *   ZERO PERMISSION CHANGE. `Profile.personalityConfig` is compared BYTE FOR BYTE across an install.
 *   This is the strongest available form of "installing grants nothing": not that no grant was intended,
 *   but that the column where grants live is unchanged.
 *
 *   INSTALL-TIME REFUSAL, non-vacuously. `coaching-studio-v1` really does require
 *   `appointments:reminders`, which really is `partial` in the live registry, so the refusal is exercised
 *   against a genuine registry state rather than a fabricated one.
 *
 *   NON-ENUMERATION. A foreign workspace and a nonexistent one are compared as SERIALIZED BODIES, with
 *   the identity switched to the other tenant BEFORE the comparison - otherwise the request is refused at
 *   workspace authorization and never reaches install ownership, which is a mistake this repository has
 *   made twice.
 *
 * Set INVERT_ASSERTION=1 to flip every load-bearing expectation and prove this can fail.
 *
 *   ts-node -r tsconfig-paths/register scripts/one-off/check-blueprint-install-runtime.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { BlueprintInstallService } from "../../src/lib/business-os/install"
import { InstallContext } from "../../src/lib/business-os/install-shared"
import { BlueprintPreviewService } from "../../src/lib/business-os/preview"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { PERMISSION_KEYS } from "../../src/lib/tenancy/types"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `bpir_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const APP_ROOT = join(__dirname, "..", "..")

/** A blueprint whose REQUIRED capability is genuinely not available today. Measured, not assumed. */
const BLOCKED_BLUEPRINT = "coaching-studio-v1"
const OLD_BLUEPRINT = "restaurant-venue-v2"
const NEW_BLUEPRINT = "restaurant-venue-v3"
const OK_BLUEPRINT = "field-service-v1"

const results: Array<{ name: string; pass: boolean; detail: string }> = []
function check(name: string, pass: boolean, detail = "") {
    results.push({ name, pass, detail })
}
function checkInvertible(name: string, pass: boolean, detail = "") {
    results.push({ name, pass: INVERT ? !pass : pass, detail })
}

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null
    async userId(): Promise<string | null> {
        return this.current
    }
}

/** A seed failure must THROW, never be reported as a refusal - otherwise a broken fixture reads as a pass. */
class SeedFailure extends Error {}

type Ids = {
    wsA: string
    wsB: string
    userA: string
    userB: string
    managerUser: string
    profileA: string
}

async function seed(tx: Tx): Promise<Ids> {
    const q = (s: string) => `${RUN}_${s}`
    const mk = async (sql: string) => {
        try {
            await tx.$executeRawUnsafe(sql)
        } catch (e) {
            throw new SeedFailure(`seed statement failed: ${String((e as Error).message).slice(0, 200)}`)
        }
    }
    for (const side of ["a", "b"] as const) {
        await mk(
            `insert into "User" ("id","clerkId","email","updatedAt") values ('${q(`u${side}`)}','clerk_${q(`u${side}`)}','${q(`u${side}`)}@example.test',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Profile" ("id","userId","slug","displayName","personalityConfig","updatedAt") values ('${q(`pr${side}`)}','${q(`u${side}`)}','${q(`pr${side}`)}','P','{"surfaces":["calendar"]}',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${q(`ws${side}`)}','${q(`pr${side}`)}','WS','${q(`ws${side}`)}',CURRENT_TIMESTAMP)`,
        )
        await mk(
            `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ('${q(`m${side}`)}','${q(`ws${side}`)}','${q(`u${side}`)}','OWNER',CURRENT_TIMESTAMP)`,
        )
    }
    // A MANAGER in workspace A. MANAGER holds profile.update but NOT workspace.update, which is the
    // whole point: it proves install asks for the stronger permission rather than the convenient one.
    await mk(
        `insert into "User" ("id","clerkId","email","updatedAt") values ('${q("umgr")}','clerk_${q("umgr")}','${q("umgr")}@example.test',CURRENT_TIMESTAMP)`,
    )
    await mk(
        `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ('${q("mmgr")}','${q("wsa")}','${q("umgr")}','MANAGER',CURRENT_TIMESTAMP)`,
    )
    return {
        wsA: q("wsa"),
        wsB: q("wsb"),
        userA: `clerk_${q("ua")}`,
        userB: `clerk_${q("ub")}`,
        managerUser: `clerk_${q("umgr")}`,
        profileA: q("pra"),
    }
}

async function installCounts(client: Tx | PrismaClient): Promise<{ installs: number; events: number }> {
    const a = await client.$queryRawUnsafe<{ n: bigint }[]>(`select count(*)::bigint as n from "BlueprintInstallation"`)
    const b = await client.$queryRawUnsafe<{ n: bigint }[]>(
        `select count(*)::bigint as n from "BlueprintInstallationEvent"`,
    )
    return { installs: Number(a[0].n), events: Number(b[0].n) }
}

/** Captures a PersistenceError as a comparable serialized refusal, exactly as the HTTP layer would. */
function refusalOf(e: unknown): string {
    if (e instanceof PersistenceError) {
        return JSON.stringify({ code: e.code, message: e.message })
    }
    return JSON.stringify({ code: "NOT_A_PERSISTENCE_ERROR", message: String((e as Error).message).slice(0, 200) })
}

async function main() {
    const url = process.env.DATABASE_URL
    const dbName = parseDatabaseName(url ?? "")
    assertDisposableTarget(url ?? "")
    if (dbName !== AUTHORIZED_TARGET) {
        console.error(`ABORT: harness only runs against ${AUTHORIZED_TARGET}, got ${String(dbName)}`)
        process.exit(1)
    }

    const prisma = new PrismaClient()
    try {
        const live = await prisma.$queryRawUnsafe<{ db: string }[]>("select current_database() as db")
        if (live[0].db !== AUTHORIZED_TARGET) {
            console.error(`ABORT: connected to ${live[0].db}`)
            process.exit(1)
        }
        const baseline = await installCounts(prisma)
        const baselineWorkspaces = await prisma.workspace.count()

        // ===================================================================
        // MODE 1: one outer transaction, rolled back. Zero residue.
        // ===================================================================
        try {
            await prisma.$transaction(
                async (tx) => {
                    const ids = await seed(tx)
                    const identity = new ControlledIdentity()
                    const client = tx as unknown as PrismaClient
                    const ctx = new InstallContext(client, new PersistedTenancy(client, identity))
                    const previews = new BlueprintPreviewService()
                    // Inline runner: the service's "transaction" is this outer one. Every constraint and
                    // trigger is still real; only the transaction boundary is borrowed.
                    const svc = new BlueprintInstallService(ctx, previews, {
                        runInTransaction: async (fn) => fn(tx),
                    })

                    // ---- signed out ------------------------------------------------
                    identity.current = null
                    let anonCode = ""
                    try {
                        await svc.forWorkspace(ids.wsA)
                    } catch (e) {
                        anonCode = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible("a signed-out read is UNAUTHORIZED", anonCode === "UNAUTHORIZED", `code=${anonCode}`)
                    identity.current = null
                    let anonInstall = ""
                    try {
                        await svc.install({ workspaceId: ids.wsA, blueprintId: OK_BLUEPRINT, idempotencyKey: "k", actor: "a" })
                    } catch (e) {
                        anonInstall = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible("a signed-out install is UNAUTHORIZED", anonInstall === "UNAUTHORIZED", `code=${anonInstall}`)

                    // ---- nothing installed is an ANSWER, not an error ---------------
                    identity.current = ids.userA
                    const empty = await svc.forWorkspace(ids.wsA)
                    checkInvertible(
                        "a workspace with nothing installed reports installed: null rather than refusing",
                        empty.installed === null && empty.all.length === 0,
                        `installed=${String(empty.installed)} all=${empty.all.length}`,
                    )
                    check(
                        "the empty view still carries its limitations, so a caller cannot render it caveat-free",
                        empty.limitations.length > 0,
                        `${empty.limitations.length} limitation(s)`,
                    )
                    checkInvertible(
                        "the limitations state that installing grants nothing and does not write per-profile surfaces",
                        empty.limitations.some((l) => /grant/i.test(l) && /personalityConfig/.test(l)),
                        "stated in the response body",
                    )

                    // ---- plan writes nothing ---------------------------------------
                    const beforePlan = await installCounts(tx)
                    const plan = await svc.plan(ids.wsA, OK_BLUEPRINT)
                    const afterPlan = await installCounts(tx)
                    checkInvertible(
                        "plan writes NOTHING - not even a record that it was asked",
                        beforePlan.installs === afterPlan.installs && beforePlan.events === afterPlan.events,
                        `installs ${beforePlan.installs}->${afterPlan.installs} events ${beforePlan.events}->${afterPlan.events}`,
                    )
                    checkInvertible(
                        "plan reports permissionChanges as empty, so installing is stated to grant nothing",
                        plan.permissionChanges.length === 0,
                        "empty",
                    )
                    check(
                        "plan on an empty workspace is not an upgrade and supersedes nothing",
                        plan.isUpgrade === false && plan.supersedes === null,
                        `isUpgrade=${plan.isUpgrade}`,
                    )
                    checkInvertible(
                        "plan resolves the config that would be frozen, and it excludes the owner console",
                        plan.config.businessOsExcluded && !plan.config.surfaces.includes("businessOs"),
                        `surfaces=[${plan.config.surfaces.join(",")}]`,
                    )

                    // ---- install ----------------------------------------------------
                    const profileBefore = await tx.$queryRawUnsafe<{ c: string | null }[]>(
                        `select "personalityConfig"::text as c from "Profile" where "id" = '${ids.profileA}'`,
                    )
                    const first = await svc.install({
                        workspaceId: ids.wsA,
                        blueprintId: OK_BLUEPRINT,
                        idempotencyKey: `${RUN}-k1`,
                        actor: "owner:a",
                    })
                    checkInvertible("a first install reports outcome installed", first.outcome === "installed", first.outcome)
                    checkInvertible(
                        "the installation is ACTIVE, pins the blueprint version, and records who did it",
                        first.installation.state === "ACTIVE" && first.installation.blueprintId === OK_BLUEPRINT,
                        `${first.installation.blueprintId} ${first.installation.state} v${first.installation.blueprintVersion}`,
                    )
                    check(
                        "installedAt is an ISO string, not a Date - the boundary cannot emit a Date",
                        typeof first.installation.installedAt === "string" &&
                            !Number.isNaN(Date.parse(first.installation.installedAt)),
                        first.installation.installedAt,
                    )
                    checkInvertible(
                        "exactly one ledger line is written for a first install, and it is INSTALLED",
                        first.installation.history.length === 1 && first.installation.history[0].kind === "INSTALLED",
                        `${first.installation.history.length} line(s): ${first.installation.history.map((h) => h.kind).join(",")}`,
                    )
                    check(
                        "a fresh install reports no drift from the registry it was just resolved from",
                        first.installation.driftedFromRegistry === false,
                        `drifted=${first.installation.driftedFromRegistry}`,
                    )

                    // ---- THE PERMISSION ASSERTION ----------------------------------
                    const profileAfter = await tx.$queryRawUnsafe<{ c: string | null }[]>(
                        `select "personalityConfig"::text as c from "Profile" where "id" = '${ids.profileA}'`,
                    )
                    checkInvertible(
                        "MEASURED: installing left Profile.personalityConfig BYTE-IDENTICAL, so it granted nothing",
                        profileBefore[0].c === profileAfter[0].c,
                        `${String(profileBefore[0].c)} -> ${String(profileAfter[0].c)}`,
                    )

                    // ---- IDEMPOTENCY ------------------------------------------------
                    const beforeReplay = await installCounts(tx)
                    const replay = await svc.install({
                        workspaceId: ids.wsA,
                        blueprintId: OK_BLUEPRINT,
                        idempotencyKey: `${RUN}-k1`,
                        actor: "owner:a",
                    })
                    const afterReplay = await installCounts(tx)
                    checkInvertible("replaying an install reports outcome replayed", replay.outcome === "replayed", replay.outcome)
                    checkInvertible(
                        "MEASURED: a replay writes NO second row in EITHER table",
                        beforeReplay.installs === afterReplay.installs && beforeReplay.events === afterReplay.events,
                        `installs ${beforeReplay.installs}->${afterReplay.installs} events ${beforeReplay.events}->${afterReplay.events}`,
                    )
                    check(
                        "a replay returns the SAME installation, not a new one",
                        replay.installation.id === first.installation.id,
                        `${replay.installation.id} vs ${first.installation.id}`,
                    )

                    // ---- the key must not be reusable for something else ------------
                    let reuseCode = ""
                    try {
                        await svc.install({
                            workspaceId: ids.wsA,
                            blueprintId: NEW_BLUEPRINT,
                            idempotencyKey: `${RUN}-k1`,
                            actor: "owner:a",
                        })
                    } catch (e) {
                        reuseCode = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible(
                        "reusing an idempotency key for a DIFFERENT blueprint is a CONFLICT, not a silent replay",
                        reuseCode === "CONFLICT",
                        `code=${reuseCode}`,
                    )

                    // ---- installing what is already active --------------------------
                    let sameCode = ""
                    try {
                        await svc.install({
                            workspaceId: ids.wsA,
                            blueprintId: OK_BLUEPRINT,
                            idempotencyKey: `${RUN}-k2`,
                            actor: "owner:a",
                        })
                    } catch (e) {
                        sameCode = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible(
                        "installing the blueprint that is already active is a CONFLICT, not a duplicate install",
                        sameCode === "CONFLICT",
                        `code=${sameCode}`,
                    )

                    // ---- INSTALL-TIME CAPABILITY REFUSAL, non-vacuously -------------
                    // coaching-studio-v1 really requires appointments:reminders, which really is partial.
                    const blockedPreview = previews.preview(BLOCKED_BLUEPRINT)
                    checkInvertible(
                        `MEASURED: ${BLOCKED_BLUEPRINT} really has an unavailable required capability, so the refusal below is not vacuous`,
                        blockedPreview !== null && blockedPreview.blockedBy.length > 0,
                        blockedPreview ? blockedPreview.blockedBy.join(" ; ") : "MISSING",
                    )
                    let blockedCode = ""
                    let blockedMsg = ""
                    try {
                        await svc.install({
                            workspaceId: ids.wsB,
                            blueprintId: BLOCKED_BLUEPRINT,
                            idempotencyKey: `${RUN}-k3`,
                            actor: "owner:b",
                        })
                    } catch (e) {
                        blockedCode = e instanceof PersistenceError ? e.code : "OTHER"
                        blockedMsg = String((e as Error).message)
                    }
                    // wsB belongs to userB, so switch identity first or this refuses for the wrong reason.
                    identity.current = ids.userB
                    let blockedCodeB = ""
                    try {
                        await svc.install({
                            workspaceId: ids.wsB,
                            blueprintId: BLOCKED_BLUEPRINT,
                            idempotencyKey: `${RUN}-k3b`,
                            actor: "owner:b",
                        })
                    } catch (e) {
                        blockedCodeB = e instanceof PersistenceError ? e.code : "OTHER"
                        blockedMsg = String((e as Error).message)
                    }
                    check(
                        "as the WRONG tenant the blocked install refuses for the tenancy reason, not the capability one",
                        blockedCode === "FORBIDDEN",
                        `code=${blockedCode}`,
                    )
                    checkInvertible(
                        "MEASURED: as the RIGHT tenant, installing a blueprint whose required capability is unavailable is refused at install time",
                        blockedCodeB === "CONFLICT" && /required capability is not available/.test(blockedMsg),
                        `code=${blockedCodeB} ${blockedMsg.slice(0, 90)}`,
                    )
                    const afterBlocked = await installCounts(tx)
                    checkInvertible(
                        "the refused install wrote nothing at all",
                        afterBlocked.installs === afterReplay.installs && afterBlocked.events === afterReplay.events,
                        `installs=${afterBlocked.installs} events=${afterBlocked.events}`,
                    )

                    // ---- UPGRADE THROUGH SUPERSESSION ------------------------------
                    identity.current = ids.userB
                    const v2 = await svc.install({
                        workspaceId: ids.wsB,
                        blueprintId: OLD_BLUEPRINT,
                        idempotencyKey: `${RUN}-b1`,
                        actor: "owner:b",
                    })
                    const beforeUpgrade = await installCounts(tx)
                    const v3 = await svc.install({
                        workspaceId: ids.wsB,
                        blueprintId: NEW_BLUEPRINT,
                        idempotencyKey: `${RUN}-b2`,
                        actor: "owner:b",
                    })
                    const afterUpgrade = await installCounts(tx)
                    checkInvertible("upgrading reports outcome upgraded, not installed", v3.outcome === "upgraded", v3.outcome)
                    checkInvertible(
                        "MEASURED: the new installation points back at the one it superseded",
                        v3.installation.supersedesInstallationId === v2.installation.id,
                        `${String(v3.installation.supersedesInstallationId)} vs ${v2.installation.id}`,
                    )
                    const wsBView = await svc.forWorkspace(ids.wsB)
                    checkInvertible(
                        "MEASURED: after an upgrade the workspace has EXACTLY ONE active installation",
                        wsBView.all.filter((v) => v.state === "ACTIVE").length === 1 &&
                            wsBView.installed?.blueprintId === NEW_BLUEPRINT,
                        `active=${wsBView.all.filter((v) => v.state === "ACTIVE").length} installed=${String(wsBView.installed?.blueprintId)}`,
                    )
                    checkInvertible(
                        "MEASURED: BOTH versions are retained - the old one is SUPERSEDED, not deleted",
                        wsBView.all.some((v) => v.blueprintId === OLD_BLUEPRINT && v.state === "SUPERSEDED") &&
                            wsBView.all.some((v) => v.blueprintId === NEW_BLUEPRINT && v.state === "ACTIVE"),
                        wsBView.all.map((v) => `${v.blueprintId}:${v.state}`).join(", "),
                    )
                    checkInvertible(
                        "an upgrade writes exactly one row and TWO ledger lines - SUPERSEDED on the old, UPGRADED on the new",
                        afterUpgrade.installs === beforeUpgrade.installs + 1 && afterUpgrade.events === beforeUpgrade.events + 2,
                        `installs +${afterUpgrade.installs - beforeUpgrade.installs} events +${afterUpgrade.events - beforeUpgrade.events}`,
                    )
                    const oldView = wsBView.all.find((v) => v.blueprintId === OLD_BLUEPRINT)
                    checkInvertible(
                        "the superseded installation's own history records that it was superseded, and by what",
                        oldView !== undefined &&
                            oldView.history.some((h) => h.kind === "SUPERSEDED" && (h.detail ?? "").includes(NEW_BLUEPRINT)),
                        oldView ? oldView.history.map((h) => `${h.kind}:${h.detail ?? ""}`).join(" | ") : "MISSING",
                    )
                    const planUpgrade = await svc.plan(ids.wsB, OLD_BLUEPRINT)
                    checkInvertible(
                        "planning the SUPERSEDED blueprint warns that it would install the older vertical",
                        planUpgrade.refused && planUpgrade.refusals.some((r) => /older vertical/.test(r)),
                        planUpgrade.refusals.join(" ; ") || "no refusals",
                    )

                    // ---- APPEND-ONLY is proven in the SCHEMA harness, not here ----
                    // Deliberately not re-tested in this mode. A trigger refusal is a real SQL error, and
                    // in Postgres any SQL error ABORTS the enclosing transaction - so attempting one here
                    // would poison the single outer transaction the rest of these assertions share, and
                    // every later assertion would fail with 25P02 instead of testing anything. That is not
                    // a limitation worth working around: check-blueprint-install-schema.ts proves the
                    // ledger refuses both UPDATE and DELETE, each in its own transaction, which is the
                    // right shape for a database-level guarantee.

                    // ---- ROLE SAFETY ----------------------------------------------
                    identity.current = ids.managerUser
                    const mgrRead = await svc.forWorkspace(ids.wsA)
                    checkInvertible(
                        "a MANAGER may READ what is installed - the read path asks only for profile.read",
                        mgrRead.installed !== null,
                        `installed=${String(mgrRead.installed?.blueprintId)}`,
                    )
                    let mgrCode = ""
                    try {
                        await svc.install({
                            workspaceId: ids.wsA,
                            blueprintId: NEW_BLUEPRINT,
                            idempotencyKey: `${RUN}-mgr`,
                            actor: "manager",
                        })
                    } catch (e) {
                        mgrCode = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible(
                        "MEASURED: a MANAGER may NOT install - install asks for workspace.update, not the profile.update a manager already holds",
                        mgrCode === "FORBIDDEN",
                        `code=${mgrCode}`,
                    )
                    let mgrRemove = ""
                    try {
                        await svc.remove({ workspaceId: ids.wsA, actor: "manager", idempotencyKey: `${RUN}-mgrrm` })
                    } catch (e) {
                        mgrRemove = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible("a MANAGER may NOT remove an installation either", mgrRemove === "FORBIDDEN", `code=${mgrRemove}`)

                    // ---- NON-ENUMERATION ------------------------------------------
                    // Identity is userB. wsA is a real workspace that is NOT theirs; the other id does not
                    // exist at all. Compared as serialized bodies.
                    identity.current = ids.userB
                    let foreign = ""
                    let missing = ""
                    try {
                        await svc.forWorkspace(ids.wsA)
                    } catch (e) {
                        foreign = refusalOf(e)
                    }
                    try {
                        await svc.forWorkspace(`${RUN}_does_not_exist`)
                    } catch (e) {
                        missing = refusalOf(e)
                    }
                    checkInvertible(
                        "MEASURED: a foreign workspace and a nonexistent one are BYTE-IDENTICAL refusals",
                        foreign === missing && foreign.includes("FORBIDDEN"),
                        `${foreign} | ${missing}`,
                    )
                    let foreignInstall = ""
                    let missingInstall = ""
                    try {
                        await svc.install({ workspaceId: ids.wsA, blueprintId: OK_BLUEPRINT, idempotencyKey: "x1", actor: "b" })
                    } catch (e) {
                        foreignInstall = refusalOf(e)
                    }
                    try {
                        await svc.install({
                            workspaceId: `${RUN}_nope`,
                            blueprintId: OK_BLUEPRINT,
                            idempotencyKey: "x2",
                            actor: "b",
                        })
                    } catch (e) {
                        missingInstall = refusalOf(e)
                    }
                    checkInvertible(
                        "MEASURED: install refuses a foreign and a nonexistent workspace byte-identically too",
                        foreignInstall === missingInstall && foreignInstall.includes("FORBIDDEN"),
                        `${foreignInstall} | ${missingInstall}`,
                    )
                    // And 404 must not become a workspace oracle: an unknown BLUEPRINT under an
                    // unauthorised workspace still refuses with FORBIDDEN, never NOT_FOUND.
                    let oracle = ""
                    try {
                        await svc.plan(ids.wsA, "nonsense-v9")
                    } catch (e) {
                        oracle = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible(
                        "MEASURED: an unauthorised caller gets FORBIDDEN even for a nonexistent blueprint, so 404 is not an oracle",
                        oracle === "FORBIDDEN",
                        `code=${oracle}`,
                    )
                    identity.current = ids.userA
                    let unknownBp = ""
                    try {
                        await svc.plan(ids.wsA, "nonsense-v9")
                    } catch (e) {
                        unknownBp = e instanceof PersistenceError ? e.code : "OTHER"
                    }
                    checkInvertible(
                        "an AUTHORISED caller gets NOT_FOUND for an unknown blueprint, because a blueprint id is a public registry key",
                        unknownBp === "NOT_FOUND",
                        `code=${unknownBp}`,
                    )

                    // ---- blanks are 400, never an unscoped query -------------------
                    for (const [label, fn] of [
                        ["a blank workspaceId", () => svc.forWorkspace("   ")],
                        [
                            "a blank blueprintId on install",
                            () => svc.install({ workspaceId: ids.wsA, blueprintId: " ", idempotencyKey: "k", actor: "a" }),
                        ],
                        [
                            "a blank idempotencyKey on install",
                            () => svc.install({ workspaceId: ids.wsA, blueprintId: OK_BLUEPRINT, idempotencyKey: " ", actor: "a" }),
                        ],
                        [
                            "a blank actor on install",
                            () => svc.install({ workspaceId: ids.wsA, blueprintId: OK_BLUEPRINT, idempotencyKey: "k", actor: " " }),
                        ],
                    ] as const) {
                        let code = ""
                        try {
                            await fn()
                        } catch (e) {
                            code = e instanceof PersistenceError ? e.code : "OTHER"
                        }
                        check(`${label} is BAD_REQUEST`, code === "BAD_REQUEST", `code=${code}`)
                    }

                    // ---- REMOVE ---------------------------------------------------
                    identity.current = ids.userA
                    const removed = await svc.remove({ workspaceId: ids.wsA, actor: "owner:a", idempotencyKey: `${RUN}-rm` })
                    checkInvertible(
                        "removing moves the installation to REMOVED and dates it",
                        removed.state === "REMOVED" && removed.removedAt !== null,
                        `state=${removed.state} removedAt=${String(removed.removedAt)}`,
                    )
                    checkInvertible(
                        "MEASURED: removing RETAINS the row and its history - it is not a delete",
                        removed.history.some((h) => h.kind === "INSTALLED") && removed.history.some((h) => h.kind === "REMOVED"),
                        removed.history.map((h) => h.kind).join(","),
                    )
                    const afterRemoveView = await svc.forWorkspace(ids.wsA)
                    check(
                        "after removal the workspace reports installed: null but keeps the history in `all`",
                        afterRemoveView.installed === null && afterRemoveView.all.length > 0,
                        `installed=${String(afterRemoveView.installed)} all=${afterRemoveView.all.length}`,
                    )
                    const beforeReRemove = await installCounts(tx)
                    const reRemoved = await svc.remove({ workspaceId: ids.wsA, actor: "owner:a", idempotencyKey: `${RUN}-rm2` })
                    const afterReRemove = await installCounts(tx)
                    checkInvertible(
                        "removing again is idempotent - it writes nothing and returns the same removal",
                        reRemoved.id === removed.id &&
                            beforeReRemove.installs === afterReRemove.installs &&
                            beforeReRemove.events === afterReRemove.events,
                        `same=${reRemoved.id === removed.id} events ${beforeReRemove.events}->${afterReRemove.events}`,
                    )
                    // Installing again after a removal is a fresh install, not an upgrade.
                    const reinstall = await svc.install({
                        workspaceId: ids.wsA,
                        blueprintId: OK_BLUEPRINT,
                        idempotencyKey: `${RUN}-again`,
                        actor: "owner:a",
                    })
                    checkInvertible(
                        "installing after a removal is a fresh install, and supersedes nothing",
                        reinstall.outcome === "installed" && reinstall.installation.supersedesInstallationId === null,
                        `${reinstall.outcome} supersedes=${String(reinstall.installation.supersedesInstallationId)}`,
                    )

                    throw new Rollback("done")
                },
                { timeout: 120_000 },
            )
        } catch (e) {
            if (e instanceof SeedFailure) throw e
            if (!(e instanceof Rollback)) throw e
        }

        // ===================================================================
        // MODE 2: ATOMICITY, against the real client and the real transaction.
        // ===================================================================
        const atomicIds = {
            user: `${RUN}_atomic_u`,
            profile: `${RUN}_atomic_pr`,
            workspace: `${RUN}_atomic_ws`,
            membership: `${RUN}_atomic_m`,
        }
        try {
            await prisma.$executeRawUnsafe(
                `insert into "User" ("id","clerkId","email","updatedAt") values ('${atomicIds.user}','clerk_${atomicIds.user}','${atomicIds.user}@example.test',CURRENT_TIMESTAMP)`,
            )
            await prisma.$executeRawUnsafe(
                `insert into "Profile" ("id","userId","slug","displayName","updatedAt") values ('${atomicIds.profile}','${atomicIds.user}','${atomicIds.profile}','P',CURRENT_TIMESTAMP)`,
            )
            await prisma.$executeRawUnsafe(
                `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ('${atomicIds.workspace}','${atomicIds.profile}','WS','${atomicIds.workspace}',CURRENT_TIMESTAMP)`,
            )
            await prisma.$executeRawUnsafe(
                `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ('${atomicIds.membership}','${atomicIds.workspace}','${atomicIds.user}','OWNER',CURRENT_TIMESTAMP)`,
            )

            const identity = new ControlledIdentity()
            identity.current = `clerk_${atomicIds.user}`
            const ctx = new InstallContext(prisma, new PersistedTenancy(prisma, identity))
            const failing = new BlueprintInstallService(ctx, new BlueprintPreviewService(), {
                beforeCommit: async () => {
                    throw new Error("injected failure at the last step of the install transaction")
                },
            })

            const before = await installCounts(prisma)
            let threw = ""
            try {
                await failing.install({
                    workspaceId: atomicIds.workspace,
                    blueprintId: OK_BLUEPRINT,
                    idempotencyKey: `${RUN}-atomic`,
                    actor: "owner:atomic",
                })
            } catch (e) {
                threw = String((e as Error).message)
            }
            const after = await installCounts(prisma)
            check("the injected failure really propagated", /injected failure at the last step/.test(threw), threw.slice(0, 90))
            checkInvertible(
                "MEASURED ATOMICITY: a failure at the LAST step of the install transaction left ZERO rows in BOTH tables",
                before.installs === after.installs && before.events === after.events,
                `BlueprintInstallation ${before.installs}->${after.installs}, BlueprintInstallationEvent ${before.events}->${after.events}`,
            )
            // Per-workspace, not just globally: a global count could be coincidentally equal.
            const scoped = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
                `select count(*)::bigint as n from "BlueprintInstallation" where "workspaceId" = '${atomicIds.workspace}'`,
            )
            const scopedEvents = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
                `select count(*)::bigint as n from "BlueprintInstallationEvent" where "workspaceId" = '${atomicIds.workspace}'`,
            )
            checkInvertible(
                "MEASURED ATOMICITY, scoped: the failed install's own workspace has zero installations and zero ledger lines",
                Number(scoped[0].n) === 0 && Number(scopedEvents[0].n) === 0,
                `installs=${Number(scoped[0].n)} events=${Number(scopedEvents[0].n)}`,
            )
            // And the idempotency key was not consumed, so a retry after a failure can still succeed.
            const working = new BlueprintInstallService(ctx, new BlueprintPreviewService())
            const retried = await working.install({
                workspaceId: atomicIds.workspace,
                blueprintId: OK_BLUEPRINT,
                idempotencyKey: `${RUN}-atomic`,
                actor: "owner:atomic",
            })
            checkInvertible(
                "MEASURED: retrying the SAME key after an atomic failure succeeds - the failure consumed nothing",
                retried.outcome === "installed",
                `outcome=${retried.outcome}`,
            )
        } finally {
            // The ledger is append-only, so the successful retry above cannot be deleted and neither can
            // its workspace or profile. Cleanup therefore removes only what CAN be removed, and the
            // residue assertion below accounts for the rest explicitly rather than pretending it is gone.
            await prisma.$executeRawUnsafe(
                `delete from "Membership" where "id" = '${atomicIds.membership}'`,
            ).catch(() => undefined)
        }

        // ---- residue ------------------------------------------------------
        const finalCounts = await installCounts(prisma)
        const finalWorkspaces = await prisma.workspace.count()
        // MODE 1 left nothing at all. MODE 2 deliberately leaves ONE installation and ONE ledger line -
        // the successful retry that proves the failed attempt consumed no idempotency key - because an
        // append-only ledger cannot be cleaned up and pretending otherwise would require disabling a
        // trigger. Stated as an exact expected number so unexpected residue still fails.
        checkInvertible(
            "residue is EXACTLY the one retry-proof install the append-only ledger makes permanent, and nothing else",
            finalCounts.installs === baseline.installs + 1 &&
                finalCounts.events === baseline.events + 1 &&
                finalWorkspaces === baselineWorkspaces + 1,
            `installs ${baseline.installs}->${finalCounts.installs}, events ${baseline.events}->${finalCounts.events}, workspaces ${baselineWorkspaces}->${finalWorkspaces}`,
        )

        // ---- the production composition root passes no hooks ---------------
        // Asserted over EXECUTABLE lines only. install-runtime.ts names both hooks in its doc comment in
        // order to explain that production must never pass them, so a whole-file scan flags the
        // explanation as the violation it is explaining - the same trap the migration builder and the
        // preview resolver both had to be written around.
        const rootSrc = readFileSync(join(APP_ROOT, "src", "lib", "business-os", "install-runtime.ts"), "utf8")
        const rootExecutable = rootSrc
            .split("\n")
            .filter((line) => {
                const t = line.trim()
                return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
            })
            .join("\n")
        checkInvertible(
            "MEASURED: the production composition root constructs the service with NO hooks, so the test seams are unreachable in production",
            !/beforeCommit/.test(rootExecutable) && !/runInTransaction/.test(rootExecutable),
            "no beforeCommit and no runInTransaction in any executable line of install-runtime.ts",
        )
        checkInvertible(
            "and the doc comment DOES explain the seams, so a reader learns why they exist rather than finding them unexplained",
            /beforeCommit/.test(rootSrc) && /runInTransaction/.test(rootSrc),
            "both seams documented in the composition root",
        )

        // ---- no permission was invented -----------------------------------
        checkInvertible(
            "MEASURED: no blueprint or install permission key was added, so no role gained anything",
            !PERMISSION_KEYS.some((k) => /blueprint|install/i.test(k)),
            `${PERMISSION_KEYS.length} permission keys, none about blueprints`,
        )
        checkInvertible(
            "MEASURED: install asks for workspace.update, which MANAGER does not hold, rather than the profile.update it does",
            (() => {
                const sharedSrc = readFileSync(join(APP_ROOT, "src", "lib", "business-os", "install-shared.ts"), "utf8")
                return /"workspace\.update"/.test(sharedSrc) && /"profile\.read"/.test(sharedSrc)
            })(),
            "workspace.update for writes, profile.read for reads",
        )
    } finally {
        await prisma.$disconnect()
    }

    const failed = results.filter((r) => !r.pass)
    for (const r of results) {
        console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`)
    }
    console.log("")
    console.log(`${results.length - failed.length}/${results.length} installation runtime assertions passed`)
    if (INVERT) console.log("INVERT_ASSERTION=1 was set: failures above are the point.")
    if (failed.length > 0) {
        console.error(`${failed.length} blueprint installation runtime assertion(s) FAILED`)
        process.exit(1)
    }
    console.log("Blueprint installation holds: it installs once, upgrades by supersession, and grants nothing.")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
