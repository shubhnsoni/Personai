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
import { hasPermission } from "../../src/lib/tenancy/permissions"
import { KNOWN_ROLES, PERMISSION_KEYS } from "../../src/lib/tenancy/types"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `ws_surface_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
const FIELD_BLUEPRINT = "field-service-v1"
const RESTAURANT_BLUEPRINT = "restaurant-venue-v3"
const LEGACY_CONFIG = '{"extras":{"surfaces":["businessOs"],"packs":[],"addons":[]}}'

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

    await execute(
        `insert into "User" ("id","clerkId","email","updatedAt") values ` +
            `('${id("user_a")}','clerk_${id("user_a")}','${id("user_a")}@example.test',CURRENT_TIMESTAMP),` +
            `('${id("user_b")}','clerk_${id("user_b")}','${id("user_b")}@example.test',CURRENT_TIMESTAMP)`,
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
            `('${id("membership_b_viewer")}','${id("workspace_b")}','${id("user_a")}','VIEWER',CURRENT_TIMESTAMP)`,
    )

    return Object.freeze({
        workspaceA: id("workspace_a"),
        workspaceB: id("workspace_b"),
        userAClerk: `clerk_${id("user_a")}`,
        userBClerk: `clerk_${id("user_b")}`,
        profileA: id("profile_a"),
        profileB: id("profile_b"),
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

        const permissionsBefore = JSON.stringify(PERMISSION_KEYS)
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

                    const permissionsAfter = JSON.stringify(PERMISSION_KEYS)
                    const serializedResults = JSON.stringify([workspaceA, workspaceB, legacy, afterRemoval, afterUpgrade])
                    const returnsPermission = (PERMISSION_KEYS as readonly string[]).some((permission) =>
                        serializedResults.includes(permission),
                    )
                    check(
                        "7. resolving surfaces neither changes nor returns an RBAC permission",
                        permissionsBefore === permissionsAfter && !returnsPermission && !/"permissions?"\s*:/.test(serializedResults),
                        `catalogUnchanged=${permissionsBefore === permissionsAfter} returnedPermission=${returnsPermission}`,
                    )

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
    console.log(
        `SUMMARY mode=${INVERT ? "inverted" : "normal"} passed=${evaluations.length - failed.length} failed=${failed.length}`,
    )
    process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
