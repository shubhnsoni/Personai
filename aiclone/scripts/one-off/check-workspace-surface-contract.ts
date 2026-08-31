/**
 * Workspace surface contract evaluation.
 *
 * Runs only against personalink_phase0_rehearsal_20260826_210704. Every fixture and installation lives
 * in one outer transaction that is deliberately rolled back; no append-only ledger row survives.
 *
 * INVERT_ASSERTION=1 flips every load-bearing expectation. A healthy harness therefore exits non-zero
 * in inversion mode.
 */
import { PrismaClient } from "@prisma/client"

import { BlueprintInstallService } from "../../src/lib/business-os/install"
import { InstallContext } from "../../src/lib/business-os/install-shared"
import { BlueprintPreviewService } from "../../src/lib/business-os/preview"
import { WORKSPACE_SURFACE_INVARIANTS } from "../../src/lib/business-os/workspace-surface-types"
import { WorkspaceSurfaceResolver } from "../../src/lib/business-os/workspace-surfaces"
import { PersistenceError } from "../../src/lib/persistence/errors"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import {
    BOUNDARY_CLOSURE_DIGEST,
    boundaryClosureDigest,
    canonicalBoundaryClosure,
    catalogueUniverse,
    leastPrivilegeViolations,
    observeBoundaryClosure,
    observedUniverse,
    ROLE_PRIVILEGE_LADDER,
    type BoundaryProbe,
} from "../../src/lib/tenancy/boundary"
import { hasPermission } from "../../src/lib/tenancy/permissions"
import { KNOWN_ROLES, PERMISSION_KEYS, type KnownRole, type PermissionKey } from "../../src/lib/tenancy/types"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `ws_surface_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const FIELD_BLUEPRINT = "field-service-v1"
const RESTAURANT_BLUEPRINT = "restaurant-venue-v3"
const LEGACY_CONFIG = '{"extras":{"surfaces":["businessOs"],"packs":[],"addons":[]}}'

/** Deliberately not a catalogue key. Asserted absent rather than assumed absent. */
const ABSENT_PERMISSION = "s1b.absent.permission"

/** Printed once at the end, so the digest assertion's preimage is never taken on trust. */
const closureEvidence: string[] = []

class Rollback extends Error {}
class SeedFailure extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type Evaluation = Readonly<{ property: string; pass: boolean; detail: string }>
const evaluations: Evaluation[] = []

function check(property: string, expectation: boolean, detail: string) {
    evaluations.push(Object.freeze({ property, pass: INVERT ? !expectation : expectation, detail }))
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null

    async userId(): Promise<string | null> {
        return this.current
    }
}

type FixtureIds = Readonly<{
    workspaceA: string
    workspaceB: string
    userAClerk: string
    userBClerk: string
    profileA: string
    profileB: string
    /**
     * One real Membership row on Workspace B per role, so this harness can interrogate the whole
     * authorization boundary rather than only the two roles the surface fixtures happen to need.
     * A total Record, so tsc refuses a new role that is not given a fixture.
     */
    clerkByRole: Readonly<Record<KnownRole, string>>
}>

async function seed(tx: Tx): Promise<FixtureIds> {
    const id = (suffix: string) => `${RUN}_${suffix}`
    const execute = async (sql: string) => {
        try {
            await tx.$executeRawUnsafe(sql)
        } catch (error) {
            throw new SeedFailure(`seed failed: ${String((error as Error).message).slice(0, 240)}`)
        }
    }

    // Workspace B already carries user_b as OWNER and user_a as VIEWER; these are the rest of the
    // ladder, so all five roles are backed by a row that Prisma and the enum both accept.
    const ladderExtras = ROLE_PRIVILEGE_LADDER.filter((role) => role !== "OWNER" && role !== "VIEWER")
    const extraUser = (role: KnownRole) => id(`user_${role.toLowerCase()}`)

    await execute(
        `insert into "User" ("id","clerkId","email","updatedAt") values ` +
            `('${id("user_a")}','clerk_${id("user_a")}','${id("user_a")}@example.test',CURRENT_TIMESTAMP),` +
            `('${id("user_b")}','clerk_${id("user_b")}','${id("user_b")}@example.test',CURRENT_TIMESTAMP),` +
            ladderExtras
                .map((role) =>
                    `('${extraUser(role)}','clerk_${extraUser(role)}','${extraUser(role)}@example.test',CURRENT_TIMESTAMP)`,
                )
                .join(","),
    )
    await execute(
        `insert into "Profile" ("id","userId","slug","displayName","roleTemplate","personalityConfig","updatedAt") values ` +
            `('${id("profile_a")}','${id("user_a")}','${id("profile_a")}','A','DESIGNER','${LEGACY_CONFIG}',CURRENT_TIMESTAMP),` +
            `('${id("profile_b")}','${id("user_b")}','${id("profile_b")}','B','RESTAURANT','{"surfaces":["leads"]}',CURRENT_TIMESTAMP)`,
    )
    await execute(
        `insert into "Workspace" ("id","profileId","name","slug","updatedAt") values ` +
            `('${id("workspace_a")}','${id("profile_a")}','Workspace A','${id("workspace_a")}',CURRENT_TIMESTAMP),` +
            `('${id("workspace_b")}','${id("profile_b")}','Workspace B','${id("workspace_b")}',CURRENT_TIMESTAMP)`,
    )
    await execute(
        `insert into "Membership" ("id","workspaceId","userId","role","updatedAt") values ` +
            `('${id("membership_a_owner")}','${id("workspace_a")}','${id("user_a")}','OWNER',CURRENT_TIMESTAMP),` +
            `('${id("membership_b_owner")}','${id("workspace_b")}','${id("user_b")}','OWNER',CURRENT_TIMESTAMP),` +
            `('${id("membership_b_viewer")}','${id("workspace_b")}','${id("user_a")}','VIEWER',CURRENT_TIMESTAMP),` +
            ladderExtras
                .map((role) =>
                    `('${id(`membership_b_${role.toLowerCase()}`)}','${id("workspace_b")}','${extraUser(role)}','${role}',CURRENT_TIMESTAMP)`,
                )
                .join(","),
    )

    const clerkByRole: Record<KnownRole, string> = {
        OWNER: `clerk_${id("user_b")}`,
        ADMIN: `clerk_${extraUser("ADMIN")}`,
        MANAGER: `clerk_${extraUser("MANAGER")}`,
        STAFF: `clerk_${extraUser("STAFF")}`,
        VIEWER: `clerk_${id("user_a")}`,
    }

    return Object.freeze({
        workspaceA: id("workspace_a"),
        workspaceB: id("workspace_b"),
        userAClerk: `clerk_${id("user_a")}`,
        userBClerk: `clerk_${id("user_b")}`,
        profileA: id("profile_a"),
        profileB: id("profile_b"),
        clerkByRole: Object.freeze(clerkByRole),
    })
}

function sorted(values: readonly string[]): string[] {
    return [...values].sort()
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
    return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function refusalOf(error: unknown): string {
    if (error instanceof PersistenceError) {
        return JSON.stringify({ code: error.code, message: error.message })
    }
    return JSON.stringify({ code: "NOT_A_PERSISTENCE_ERROR", message: String((error as Error).message).slice(0, 200) })
}

async function captureRefusal(action: () => Promise<unknown>): Promise<string> {
    try {
        await action()
        return "NO_REFUSAL"
    } catch (error) {
        return refusalOf(error)
    }
}

// ---------------------------------------------------------------------------------------------
// observing the authorization boundary
//
// `PersistedTenancy.requireAccess` is where a role becomes an admit-or-refuse verdict for a named
// permission. The verdict comes back out of a live call that matched a real Membership row in the
// rehearsal database; it is not a re-read of the `PERMISSION_KEYS` import, which is what the assertion
// this block replaces was doing. See src/lib/tenancy/boundary.ts.
// ---------------------------------------------------------------------------------------------

/** Only the boundary's own FORBIDDEN counts as a refusal; anything else is rethrown, never recorded. */
async function admits(tenancy: PersistedTenancy, workspaceId: string, permission: string): Promise<boolean> {
    try {
        await tenancy.requireAccess(workspaceId, permission as PermissionKey)
        return true
    } catch (error) {
        if (error instanceof PersistenceError && error.code === "FORBIDDEN") return false
        throw error
    }
}

async function refusalFor(tenancy: PersistedTenancy, workspaceId: string, permission: string): Promise<string> {
    try {
        await tenancy.requireAccess(workspaceId, permission as PermissionKey)
        return "ADMITTED"
    } catch (error) {
        return refusalOf(error)
    }
}

/**
 * A refusal with the caller's OWN input edited out. Echoing back the key a caller just asked for tells
 * it nothing new; any OTHER difference between "real but ungranted" and "does not exist" would.
 */
function withoutEchoedInput(refusal: string, echoed: string): string {
    return refusal.split(echoed).join("<input>")
}

function boundaryProbe(
    tenancy: PersistedTenancy,
    identity: ControlledIdentity,
    workspaceId: string,
    clerkByRole: Readonly<Record<KnownRole, string>>,
): BoundaryProbe {
    return async (role, permission) => {
        identity.current = clerkByRole[role]
        return admits(tenancy, workspaceId, permission)
    }
}

async function profileBytes(tx: Tx, profileIds: readonly string[]): Promise<readonly string[]> {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; config: string | null }>>(
        `select "id", "personalityConfig"::text as config from "Profile" ` +
            `where "id" in ('${profileIds.join("','")}') order by "id"`,
    )
    return Object.freeze(rows.map((row) => `${row.id}:${row.config ?? "<null>"}`))
}

async function residueCount(prisma: PrismaClient): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `select (` +
            `(select count(*) from "User" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Profile" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Membership" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Workspace" where "id" like '${RUN}%') + ` +
            `(select count(*) from "BlueprintInstallation" where "workspaceId" like '${RUN}%') + ` +
            `(select count(*) from "BlueprintInstallationEvent" where "workspaceId" like '${RUN}%')` +
            `)::bigint as count`,
    )
    return Number(rows[0]?.count ?? -1)
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL
    assertDisposableTarget(databaseUrl)
    const parsedDatabase = parseDatabaseName(databaseUrl)
    if (parsedDatabase !== AUTHORIZED_TARGET) {
        throw new Error(`ABORT: expected ${AUTHORIZED_TARGET}, got ${String(parsedDatabase)}`)
    }
    if (WORKSPACE_SURFACE_INVARIANTS.length !== 8) {
        throw new Error(`contract must document exactly eight invariants, got ${WORKSPACE_SURFACE_INVARIANTS.length}`)
    }

    const prisma = new PrismaClient()
    try {
        const current = await prisma.$queryRawUnsafe<Array<{ database: string }>>("select current_database() as database")
        if (current[0]?.database !== AUTHORIZED_TARGET) {
            throw new Error(`ABORT: connected to ${String(current[0]?.database)}`)
        }

        // NOTE: there is deliberately no `permissionsBefore = JSON.stringify(PERMISSION_KEYS)` here.
        // Comparing that against the same expression after the transaction is `x === x` on a frozen
        // import. Checks 7b-7f below observe the boundary instead.
        try {
            await prisma.$transaction(
                async (tx) => {
                    const ids = await seed(tx)
                    const identity = new ControlledIdentity()
                    const client = tx as unknown as PrismaClient
                    const tenancy = new PersistedTenancy(client, identity)
                    const resolver = new WorkspaceSurfaceResolver(client, tenancy)
                    const installer = new BlueprintInstallService(
                        new InstallContext(client, tenancy),
                        new BlueprintPreviewService(),
                        { runInTransaction: async (operation) => operation(tx) },
                    )
                    const profilesBefore = await profileBytes(tx, [ids.profileA, ids.profileB])

                    identity.current = ids.userAClerk
                    const installA = await installer.install({
                        workspaceId: ids.workspaceA,
                        blueprintId: FIELD_BLUEPRINT,
                        idempotencyKey: `${RUN}_install_a_1`,
                        actor: "owner:a",
                    })
                    identity.current = ids.userBClerk
                    const installB = await installer.install({
                        workspaceId: ids.workspaceB,
                        blueprintId: RESTAURANT_BLUEPRINT,
                        idempotencyKey: `${RUN}_install_b_1`,
                        actor: "owner:b",
                    })

                    // User A belongs to both workspaces, so both successful reads below exercise surface
                    // selection rather than tenancy refusal. Their blueprints have genuinely distinct sets.
                    identity.current = ids.userAClerk
                    const workspaceA = await resolver.forWorkspace(ids.workspaceA)
                    const workspaceB = await resolver.forWorkspace(ids.workspaceB)
                    const legacy = resolver.withoutWorkspace({
                        roleTemplate: "DESIGNER",
                        personalityConfig: LEGACY_CONFIG,
                    })

                    check(
                        "1. ACTIVE workspace surfaces resolve instead of global profile surfaces",
                        workspaceA.source === "active-blueprint-installation" &&
                            workspaceA.installationId === installA.installation.id &&
                            sameSet(workspaceA.surfaces, installA.installation.config.surfaces) &&
                            !sameSet(workspaceA.surfaces, legacy.surfaces),
                        `workspace=[${workspaceA.surfaces.join(",")}] legacy=[${legacy.surfaces.join(",")}]`,
                    )

                    const distinctFixtures = !sameSet(
                        installA.installation.config.surfaces,
                        installB.installation.config.surfaces,
                    )
                    const onlyInA = installA.installation.config.surfaces.filter(
                        (surface) => !installB.installation.config.surfaces.includes(surface),
                    )
                    check(
                        "2. one user's Workspace A surfaces do not leak into Workspace B",
                        distinctFixtures &&
                            onlyInA.length > 0 &&
                            sameSet(workspaceB.surfaces, installB.installation.config.surfaces) &&
                            onlyInA.every((surface) => !(workspaceB.surfaces as readonly string[]).includes(surface)),
                        `distinct=${distinctFixtures} onlyInA=[${onlyInA.join(",")}] B=[${workspaceB.surfaces.join(",")}]`,
                    )

                    check(
                        "3. the ACTIVE installation's frozen configJson is the exact source of truth",
                        workspaceA.blueprintId === FIELD_BLUEPRINT &&
                            workspaceB.blueprintId === RESTAURANT_BLUEPRINT &&
                            sameSet(workspaceA.surfaces, installA.installation.config.surfaces) &&
                            sameSet(workspaceB.surfaces, installB.installation.config.surfaces),
                        `A=${workspaceA.blueprintId}/${workspaceA.surfaces.join(",")} B=${workspaceB.blueprintId}/${workspaceB.surfaces.join(",")}`,
                    )

                    identity.current = ids.userAClerk
                    await installer.remove({
                        workspaceId: ids.workspaceA,
                        actor: "owner:a",
                        idempotencyKey: `${RUN}_remove_a`,
                    })
                    const afterRemoval = await resolver.forWorkspace(ids.workspaceA)
                    check(
                        "4. REMOVED installations contribute no surfaces and do not trigger profile fallback",
                        afterRemoval.source === "no-active-blueprint-installation" &&
                            afterRemoval.installationId === null &&
                            afterRemoval.surfaces.length === 0,
                        `source=${afterRemoval.source} surfaces=[${afterRemoval.surfaces.join(",")}]`,
                    )

                    const reinstalled = await installer.install({
                        workspaceId: ids.workspaceA,
                        blueprintId: FIELD_BLUEPRINT,
                        idempotencyKey: `${RUN}_install_a_2`,
                        actor: "owner:a",
                    })
                    const upgraded = await installer.install({
                        workspaceId: ids.workspaceA,
                        blueprintId: RESTAURANT_BLUEPRINT,
                        idempotencyKey: `${RUN}_upgrade_a`,
                        actor: "owner:a",
                    })
                    const afterUpgrade = await resolver.forWorkspace(ids.workspaceA)
                    const oldOnly = reinstalled.installation.config.surfaces.filter(
                        (surface) => !upgraded.installation.config.surfaces.includes(surface),
                    )
                    check(
                        "5. upgrade uses only the new frozen config and never unions old surfaces",
                        upgraded.outcome === "upgraded" &&
                            oldOnly.length > 0 &&
                            sameSet(afterUpgrade.surfaces, upgraded.installation.config.surfaces) &&
                            oldOnly.every((surface) => !(afterUpgrade.surfaces as readonly string[]).includes(surface)),
                        `oldOnly=[${oldOnly.join(",")}] effective=[${afterUpgrade.surfaces.join(",")}]`,
                    )

                    // Switch to tenant B before comparing: Workspace A is real but foreign to B, while
                    // the other id is absent. Both must stop at the same authorization boundary.
                    identity.current = ids.userBClerk
                    const foreign = await captureRefusal(() => resolver.forWorkspace(ids.workspaceA))
                    const missing = await captureRefusal(() => resolver.forWorkspace(`${RUN}_missing`))
                    check(
                        "6. foreign and missing workspace refusals are byte-identical and fail closed",
                        foreign === missing && foreign.includes('"code":"FORBIDDEN"'),
                        `${foreign} | ${missing}`,
                    )

                    const serializedResults = JSON.stringify([workspaceA, workspaceB, legacy, afterRemoval, afterUpgrade])
                    const returnsPermission = (PERMISSION_KEYS as readonly string[]).some((permission) =>
                        serializedResults.includes(permission),
                    )
                    check(
                        "7a. SERIALISATION boundary: resolving surfaces returns no RBAC permission",
                        !returnsPermission && !/"permissions?"\s*:/.test(serializedResults),
                        `returnedPermission=${returnsPermission} bytes=${serializedResults.length}`,
                    )

                    // ---- 7b-7f. AUTHORIZATION boundary: what the catalogue actually decides -------
                    // What was here compared JSON.stringify(PERMISSION_KEYS) taken before the
                    // transaction against the same expression taken after it. PERMISSION_KEYS is a
                    // frozen import, so both operands were one immutable value read twice in a single
                    // process: `x === x`, unfalsifiable, and it never touched the boundary whose
                    // behaviour it was named after.
                    //
                    // This harness now observes the boundary itself, through ITS OWN fixtures - five
                    // Membership rows on Workspace B, seeded by raw SQL - and pins the result to the
                    // same reviewed digest that check-workspace-surface-boundary.ts pins. Two
                    // independent fixtures, one expectation.
                    const closure = await observeBoundaryClosure(
                        boundaryProbe(tenancy, identity, ids.workspaceB, ids.clerkByRole),
                    )
                    const observedDigest = boundaryClosureDigest(closure)
                    closureEvidence.push(
                        `BOUNDARY_CLOSURE_DECISIONS=${closure.length}`,
                        `BOUNDARY_CLOSURE_DIGEST_OBSERVED=${observedDigest}`,
                        `BOUNDARY_CLOSURE_DIGEST_PINNED=${BOUNDARY_CLOSURE_DIGEST}`,
                        "BOUNDARY_CLOSURE_CANONICAL_OBSERVED:",
                        canonicalBoundaryClosure(closure),
                    )
                    check(
                        "7b. the closure the boundary ACTUALLY enforces fingerprints to the reviewed pin",
                        closure.length === KNOWN_ROLES.length * PERMISSION_KEYS.length &&
                            observedDigest === BOUNDARY_CLOSURE_DIGEST,
                        `decisions=${closure.length} observed=${observedDigest} pinned=${BOUNDARY_CLOSURE_DIGEST}`,
                    )

                    const policyViolations = leastPrivilegeViolations(closure)
                    check(
                        "7c. the OBSERVED closure satisfies the least-privilege ladder, so a re-pinned digest cannot hide a widening",
                        policyViolations.length === 0,
                        policyViolations.length === 0
                            ? `ladder=${ROLE_PRIVILEGE_LADDER.join("<")} clean over ${closure.length} live decisions`
                            : policyViolations.join(" | "),
                    )

                    const reachable = observedUniverse(closure)
                    const catalogue = catalogueUniverse()
                    const unreachable = catalogue.filter((permission) => !reachable.includes(permission))
                    check(
                        "7d. every permission in the catalogue is reachable through the boundary by at least one role",
                        catalogue.length > 0 && sameSet(reachable, catalogue) && unreachable.length === 0,
                        `catalogue=${catalogue.length} reachable=${reachable.length} unreachable=[${unreachable.join(",") || "none"}]`,
                    )

                    // ---- 7e. no permission-catalogue enumeration, inside the tenant ---------------
                    identity.current = ids.clerkByRole.VIEWER
                    const ungrantedRefusal = await refusalFor(tenancy, ids.workspaceB, "workspace.delete")
                    const absentRefusal = await refusalFor(tenancy, ids.workspaceB, ABSENT_PERMISSION)
                    const absentIsAbsent = !(PERMISSION_KEYS as readonly string[]).includes(ABSENT_PERMISSION)
                    check(
                        "7e. a member cannot tell a real-but-ungranted permission from one that does not exist",
                        absentIsAbsent &&
                            ungrantedRefusal !== "ADMITTED" &&
                            absentRefusal !== "ADMITTED" &&
                            ungrantedRefusal.includes('"code":"FORBIDDEN"') &&
                            withoutEchoedInput(ungrantedRefusal, "workspace.delete") ===
                                withoutEchoedInput(absentRefusal, ABSENT_PERMISSION),
                        `ungranted=${ungrantedRefusal} absent=${absentRefusal} absentIsAbsent=${absentIsAbsent}`,
                    )

                    // ---- 7f. no workspace OR permission enumeration, across tenants ---------------
                    // Workspace A is real but foreign to user B; the other id is absent. Probed with a
                    // permission user B holds in its own workspace, one only an OWNER ever holds, and
                    // one that is not a catalogue key at all. All six refusals must be the same bytes,
                    // which also pins the ORDER of the two checks inside requireAccess: membership is
                    // settled before any permission is consulted.
                    identity.current = ids.userBClerk
                    const probedKeys = ["workspace.read", "workspace.delete", ABSENT_PERMISSION]
                    const probedTargets = [ids.workspaceA, `${RUN}_absent_workspace`]
                    const crossTenantRefusals: string[] = []
                    for (const target of probedTargets) {
                        for (const permission of probedKeys) {
                            crossTenantRefusals.push(await refusalFor(tenancy, target, permission))
                        }
                    }
                    const distinctRefusals = [...new Set(crossTenantRefusals)]
                    const leakedKeys = probedKeys.filter((permission) =>
                        distinctRefusals.some((refusal) => refusal.includes(permission)),
                    )
                    const leakedIds = probedTargets.filter((target) =>
                        distinctRefusals.some((refusal) => refusal.includes(target)),
                    )
                    check(
                        "7f. across tenants, existence of a workspace OR of a permission is not observable",
                        probedKeys.length === 3 &&
                            crossTenantRefusals.length === 6 &&
                            distinctRefusals.length === 1 &&
                            distinctRefusals[0].includes('"code":"FORBIDDEN"') &&
                            leakedKeys.length === 0 &&
                            leakedIds.length === 0,
                        `refusals=${crossTenantRefusals.length} distinct=${distinctRefusals.length} value=${distinctRefusals[0]} leakedKeys=[${leakedKeys.join(",") || "none"}] leakedIds=${leakedIds.length}`,
                    )

                    // The remaining checks read Workspace B as its owner.
                    identity.current = ids.userBClerk

                    const profilesAfter = await profileBytes(tx, [ids.profileA, ids.profileB])
                    check(
                        "8. installs and surface resolution leave Profile.personalityConfig byte-identical",
                        JSON.stringify(profilesBefore) === JSON.stringify(profilesAfter),
                        `${JSON.stringify(profilesBefore)} -> ${JSON.stringify(profilesAfter)}`,
                    )

                    // ---- 9-11. a frozen config OUTLIVES the code that wrote it -------------
                    // Root added these after S1-A. Its resolver threw CONFLICT on ANY unrecognised
                    // surface string, which is the wrong failure mode for the case that will actually
                    // happen: the day a surface is retired from the Surface union, every workspace
                    // installed before that release holds a config naming it, and refusing the whole
                    // config would take all of them down on deploy over data that was valid when
                    // written. Unrecognised strings are now DROPPED and REPORTED; structural corruption
                    // still throws.
                    const activeRow = await tx.blueprintInstallation.findFirst({
                        where: { workspaceId: ids.workspaceB, state: "ACTIVE" },
                        select: { id: true, configJson: true },
                    })
                    if (!activeRow) throw new Error("fixture error: workspace B has no ACTIVE installation")
                    const baseConfig = activeRow.configJson as Record<string, unknown>
                    const knownSurfaces = [...(baseConfig.surfaces as string[])]

                    // A retired surface plus a permission-shaped string. Neither may reach `surfaces`.
                    await tx.$executeRawUnsafe(
                        `update "BlueprintInstallation" set "configJson" = $1::jsonb where "id" = $2`,
                        JSON.stringify({ ...baseConfig, surfaces: [...knownSurfaces, "retiredSurface", "workspace.update"] }),
                        activeRow.id,
                    )
                    const withUnknown = await resolver.forWorkspace(ids.workspaceB)
                    check(
                        "9. an unrecognised surface in a frozen config is DROPPED, not honoured, and the workspace still resolves",
                        withUnknown.surfaces.length === knownSurfaces.length &&
                            !(withUnknown.surfaces as readonly string[]).includes("retiredSurface") &&
                            !(withUnknown.surfaces as readonly string[]).includes("workspace.update"),
                        `surfaces=[${withUnknown.surfaces.join(",")}]`,
                    )
                    check(
                        "10. the dropped values are REPORTED rather than discarded silently",
                        withUnknown.unknownSurfaces.length === 2 &&
                            withUnknown.unknownSurfaces.includes("retiredSurface") &&
                            withUnknown.unknownSurfaces.includes("workspace.update"),
                        `unknownSurfaces=[${withUnknown.unknownSurfaces.join(",")}]`,
                    )

                    // 10b/10c. `businessOs` is NOT an unknown surface. Independent review caught this: it
                    // is a perfectly valid Surface that installations may never contribute, so classifying
                    // it as "no longer recognised" told an owner that wrong-now data was merely an outdated
                    // config. Both are dropped, so the security behaviour is unchanged - but the diagnosis
                    // must be right, or reassuring copy hides a real problem.
                    await tx.$executeRawUnsafe(
                        `update "BlueprintInstallation" set "configJson" = $1::jsonb where "id" = $2`,
                        JSON.stringify({ ...baseConfig, surfaces: [...knownSurfaces, "businessOs", "retiredSurface"] }),
                        activeRow.id,
                    )
                    const withBusinessOs = await resolver.forWorkspace(ids.workspaceB)
                    check(
                        "10b. businessOs is reported as RECOGNISED-BUT-NOT-INSTALLABLE, never as an unknown surface",
                        withBusinessOs.notInstallableSurfaces.includes("businessOs") &&
                            !withBusinessOs.unknownSurfaces.includes("businessOs") &&
                            withBusinessOs.unknownSurfaces.includes("retiredSurface"),
                        `notInstallable=[${withBusinessOs.notInstallableSurfaces.join(",")}] unknown=[${withBusinessOs.unknownSurfaces.join(",")}]`,
                    )
                    check(
                        "10c. and businessOs is still DROPPED, so the sharper diagnosis did not weaken the refusal",
                        !(withBusinessOs.surfaces as readonly string[]).includes("businessOs"),
                        `surfaces=[${withBusinessOs.surfaces.join(",")}]`,
                    )

                    // Structural corruption is a different thing and must still refuse.
                    await tx.$executeRawUnsafe(
                        `update "BlueprintInstallation" set "configJson" = $1::jsonb where "id" = $2`,
                        JSON.stringify({ ...baseConfig, businessOsExcluded: false }),
                        activeRow.id,
                    )
                    let structuralCode = "NO_REFUSAL"
                    try {
                        await resolver.forWorkspace(ids.workspaceB)
                    } catch (error) {
                        structuralCode = error instanceof PersistenceError ? error.code : "OTHER"
                    }
                    check(
                        "11. a config that does not assert businessOsExcluded is STRUCTURALLY corrupt and is refused",
                        structuralCode === "CONFLICT",
                        `code=${structuralCode}`,
                    )
                    await tx.$executeRawUnsafe(
                        `update "BlueprintInstallation" set "configJson" = $1::jsonb where "id" = $2`,
                        JSON.stringify(baseConfig),
                        activeRow.id,
                    )

                    // ---- 12-13. what "every role can read surfaces" actually rests on ------
                    // S2-B's boundary harness proved all five membership roles get 200, then reported
                    // honestly that the COMPLEMENT is untestable: `ROLE_PERMISSION_MATRIX` grants
                    // profile.read to every value of the MembershipRole enum, so there is no denied role
                    // to exercise. It declined to seed a fake one, which was right.
                    //
                    // That leaves a real gap. "All roles can read" is currently TRUE BY ACCIDENT of the
                    // matrix rather than by a checked decision, and the deny path is never exercised at
                    // all. These two assertions close both halves: the openness becomes a MEASURED fact
                    // that fails loudly if a future role lacks profile.read, and the deny branch is
                    // proven reachable via the one input that can still reach it - an unrecognised role
                    // string, which `resolveRolePermissions` treats as deniedByDefault.
                    const rolesWithoutRead = KNOWN_ROLES.filter((role) => !hasPermission(role, "profile.read"))
                    check(
                        "12. MEASURED: every current MembershipRole holds profile.read, which is WHY the boundary lets all five read",
                        rolesWithoutRead.length === 0,
                        rolesWithoutRead.length === 0
                            ? `all of ${KNOWN_ROLES.join(",")} hold profile.read`
                            : `these roles do NOT: ${rolesWithoutRead.join(",")} - the boundary must now refuse them`,
                    )
                    check(
                        "13. the deny path is real: an unrecognised role holds no permission, so it is denied by default",
                        !hasPermission("NOT_A_ROLE", "profile.read") && !hasPermission("", "profile.read"),
                        "unknown and blank roles both denied",
                    )

                    throw new Rollback("deliberate rollback")
                },
                { timeout: 120_000 },
            )
        } catch (error) {
            if (error instanceof SeedFailure) throw error
            if (!(error instanceof Rollback)) throw error
        }

        const residue = await residueCount(prisma)
        check("ROLLBACK. the harness leaves zero database residue", residue === 0, `rows=${residue}`)
    } finally {
        await prisma.$disconnect()
    }

    for (const evaluation of evaluations) {
        console.log(`${evaluation.pass ? "PASS" : "FAIL"} ${evaluation.property} :: ${evaluation.detail}`)
    }
    const failed = evaluations.filter((evaluation) => !evaluation.pass)
    for (const line of closureEvidence) console.log(line)
    console.log(
        `SUMMARY mode=${INVERT ? "inverted" : "normal"} passed=${evaluations.length - failed.length} failed=${failed.length}`,
    )
    process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
