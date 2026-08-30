import { readFileSync } from "node:fs"
import { join } from "node:path"

import { PrismaClient } from "@prisma/client"

import { BlueprintInstallService } from "../../src/lib/business-os/install"
import { InstallContext } from "../../src/lib/business-os/install-shared"
import { BlueprintPreviewService } from "../../src/lib/business-os/preview"
import { WorkspaceSurfaceApiService } from "../../src/lib/business-os/workspace-surface-http"
import type {
    LegacyProfileSurfaceInput,
    LegacyProfileSurfaceResolution,
    WorkspaceSurfaceResolverPort,
} from "../../src/lib/business-os/workspace-surface-types"
import { WorkspaceSurfaceResolver } from "../../src/lib/business-os/workspace-surfaces"
import { PersistedTenancy, type PlatformIdentity } from "../../src/lib/persistence/tenancy"
import { ROLE_PERMISSION_MATRIX } from "../../src/lib/tenancy/permissions"
import { KNOWN_ROLES, PERMISSION_KEYS, type KnownRole } from "../../src/lib/tenancy/types"
import { assertDisposableTarget, parseDatabaseName } from "../lib/disposable-db"

const AUTHORIZED_TARGET = "personalink_phase0_rehearsal_20260826_210704"
const INVERT = process.env.INVERT_ASSERTION === "1"
const RUN = `s2b_surface_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
const BLUEPRINT_ID = "field-service-v1"
const APP_ROOT = join(__dirname, "..", "..")
const FAKE_DSN = "postgresql://surface_user:s2b-pa55word@surface-db.internal.example:5432/personalink?sslmode=require"

class Rollback extends Error {}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type Captured = Readonly<{ status: number; body: Record<string, unknown>; raw: string }>
type Result = Readonly<{ name: string; pass: boolean; detail: string }>
const results: Result[] = []

function check(name: string, expectation: boolean, detail: string) {
    results.push(Object.freeze({ name, pass: INVERT ? !expectation : expectation, detail }))
}

class ControlledIdentity implements PlatformIdentity {
    current: string | null = null

    async userId(): Promise<string | null> {
        return this.current
    }
}

type FixtureIds = Readonly<{
    workspace: string
    foreignWorkspace: string
    clerkByRole: Readonly<Record<KnownRole, string>>
    foreignClerk: string
}>

function id(suffix: string): string {
    return `${RUN}_${suffix}`
}

async function seed(tx: Tx): Promise<FixtureIds> {
    const clerkByRole = {} as Record<KnownRole, string>
    for (const role of KNOWN_ROLES) {
        const userId = id(`user_${role.toLowerCase()}`)
        const clerkId = `clerk_${userId}`
        clerkByRole[role] = clerkId
        await tx.user.create({
            data: { id: userId, clerkId, email: `${userId}@example.test` },
        })
    }

    const foreignUserId = id("user_foreign")
    const foreignClerk = `clerk_${foreignUserId}`
    await tx.user.create({
        data: { id: foreignUserId, clerkId: foreignClerk, email: `${foreignUserId}@example.test` },
    })

    const ownerUserId = id("user_owner")
    const profileId = id("profile")
    const foreignProfileId = id("profile_foreign")
    await tx.profile.createMany({
        data: [
            { id: profileId, userId: ownerUserId, slug: profileId, displayName: "S2B Workspace" },
            { id: foreignProfileId, userId: foreignUserId, slug: foreignProfileId, displayName: "S2B Foreign" },
        ],
    })

    const workspace = id("workspace")
    const foreignWorkspace = id("workspace_foreign")
    await tx.workspace.createMany({
        data: [
            { id: workspace, profileId, name: "S2B Workspace", slug: workspace },
            { id: foreignWorkspace, profileId: foreignProfileId, name: "S2B Foreign", slug: foreignWorkspace },
        ],
    })

    await tx.membership.createMany({
        data: [
            ...KNOWN_ROLES.map((role) => ({
                id: id(`membership_${role.toLowerCase()}`),
                workspaceId: workspace,
                userId: id(`user_${role.toLowerCase()}`),
                role,
            })),
            {
                id: id("membership_foreign"),
                workspaceId: foreignWorkspace,
                userId: foreignUserId,
                role: "OWNER" as const,
            },
        ],
    })

    return Object.freeze({ workspace, foreignWorkspace, clerkByRole: Object.freeze(clerkByRole), foreignClerk })
}

async function capture(promise: Promise<Response>): Promise<Captured> {
    const response = await promise
    const raw = await response.text()
    return Object.freeze({ status: response.status, raw, body: JSON.parse(raw) as Record<string, unknown> })
}

function errorCode(captured: Captured): string {
    return ((captured.body.error as { code?: string } | undefined)?.code ?? "")
}

function outerKeys(captured: Captured): string {
    return Object.keys(captured.body).sort().join(",")
}

function resolutionOf(captured: Captured): Record<string, unknown> {
    const data = captured.body.data as { resolution?: Record<string, unknown> } | undefined
    return data?.resolution ?? {}
}

function hasForbiddenResponseField(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(hasForbiddenResponseField)
    if (!value || typeof value !== "object") return false
    return Object.entries(value as Record<string, unknown>).some(
        ([key, nested]) => /^(role|roles|permission|permissions|grant|grants|authorization)$/.test(key) || hasForbiddenResponseField(nested),
    )
}

function executableSource(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(/\r?\n/)
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n")
}

function exactSet(left: readonly string[], right: readonly string[]): boolean {
    return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

async function residueCount(prisma: PrismaClient): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `select (` +
            `(select count(*) from "User" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Profile" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Workspace" where "id" like '${RUN}%') + ` +
            `(select count(*) from "Membership" where "id" like '${RUN}%') + ` +
            `(select count(*) from "BlueprintInstallation" where "workspaceId" like '${RUN}%') + ` +
            `(select count(*) from "BlueprintInstallationEvent" where "workspaceId" like '${RUN}%')` +
            `)::bigint as count`,
    )
    return Number(rows[0]?.count ?? -1)
}

function unavailableHarness(): Promise<void> {
    let blankCalls = 0
    const blankResolver: WorkspaceSurfaceResolverPort = {
        async forWorkspace() {
            blankCalls += 1
            throw new Error("blank workspace reached resolver")
        },
        withoutWorkspace(_profile: LegacyProfileSurfaceInput): LegacyProfileSurfaceResolution {
            throw new Error("not used")
        },
    }
    const blankApi = new WorkspaceSurfaceApiService(blankResolver)

    const brokenResolver: WorkspaceSurfaceResolverPort = {
        async forWorkspace() {
            throw new Error(`Prisma driver ECONNREFUSED while connecting to ${FAKE_DSN}`)
        },
        withoutWorkspace(_profile: LegacyProfileSurfaceInput): LegacyProfileSurfaceResolution {
            throw new Error("not used")
        },
    }
    const brokenApi = new WorkspaceSurfaceApiService(brokenResolver)

    return Promise.all([capture(blankApi.forWorkspace(" \t ")), capture(brokenApi.forWorkspace("workspace"))]).then(
        ([blank, unavailable]) => {
            check(
                "7. blank workspaceId is 400 before the resolver can issue an unscoped query",
                blank.status === 400 && errorCode(blank) === "BAD_REQUEST" && blankCalls === 0,
                `status=${blank.status} code=${errorCode(blank)} resolverCalls=${blankCalls}`,
            )

            const fragments = [
                FAKE_DSN,
                "postgresql://",
                "surface_user",
                "s2b-pa55word",
                "surface-db.internal.example",
                "5432",
                "sslmode",
                "Prisma",
                "ECONNREFUSED",
            ]
            const leaked = fragments.filter((fragment) => unavailable.raw.includes(fragment))
            check(
                "8. dependency failure is a 503 and leaks no DSN or driver fragment",
                unavailable.status === 503 && errorCode(unavailable) === "DEPENDENCY_UNAVAILABLE" && leaked.length === 0,
                `status=${unavailable.status} leaked=${leaked.join("|") || "none"}`,
            )
            check(
                "9. the 503 names workspace surfaces rather than a reused helper's surface",
                unavailable.raw.includes("Workspace surfaces are temporarily unavailable"),
                unavailable.raw,
            )
            check(
                "10e. the 503 refusal uses the shared { ok, error } envelope",
                outerKeys(unavailable) === "error,ok" && unavailable.body.ok === false,
                `keys=${outerKeys(unavailable)} ok=${String(unavailable.body.ok)}`,
            )
            check(
                "10b. the 400 refusal uses the shared { ok, error } envelope",
                outerKeys(blank) === "error,ok" && blank.body.ok === false,
                `keys=${outerKeys(blank)} ok=${String(blank.body.ok)}`,
            )
        },
    )
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL
    assertDisposableTarget(databaseUrl)
    const databaseName = parseDatabaseName(databaseUrl)
    if (databaseName !== AUTHORIZED_TARGET) {
        throw new Error(`ABORT: expected ${AUTHORIZED_TARGET}, got ${String(databaseName)}`)
    }

    const routeSource = executableSource(
        readFileSync(join(APP_ROOT, "src/app/api/platform/workspaces/[workspaceId]/surfaces/route.ts"), "utf8"),
    )
    check(
        "11. the route exports GET and no write verb",
        /export\s+async\s+function\s+GET\b/.test(routeSource) &&
            !/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(routeSource),
        "GET only on executable lines",
    )

    await unavailableHarness()

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
                    const api = new WorkspaceSurfaceApiService(new WorkspaceSurfaceResolver(client, tenancy))
                    const installer = new BlueprintInstallService(
                        new InstallContext(client, tenancy),
                        new BlueprintPreviewService(),
                        { runInTransaction: async (operation) => operation(tx) },
                    )

                    const seededMemberships = await tx.membership.findMany({
                        where: { workspaceId: ids.workspace },
                        select: { role: true },
                    })
                    const seededRoles = seededMemberships.map(({ role }) => role)
                    check(
                        "4a. every matrix role has a real seeded Membership row",
                        seededMemberships.length === KNOWN_ROLES.length && exactSet(seededRoles, KNOWN_ROLES),
                        `seeded=${seededRoles.sort().join(",")}`,
                    )

                    identity.current = null
                    const anonymous = await capture(api.forWorkspace(ids.workspace))
                    check(
                        "1. anonymous read is 401",
                        anonymous.status === 401 && errorCode(anonymous) === "UNAUTHORIZED",
                        `status=${anonymous.status} code=${errorCode(anonymous)}`,
                    )

                    identity.current = ids.clerkByRole.OWNER
                    const beforeInstall = await capture(api.forWorkspace(ids.workspace))
                    const emptyResolution = resolutionOf(beforeInstall)
                    check(
                        "2a. no installation is distinguishable from configured-empty",
                        beforeInstall.status === 200 &&
                            emptyResolution.source === "no-active-blueprint-installation" &&
                            emptyResolution.installationId === null &&
                            emptyResolution.blueprintId === null &&
                            Array.isArray(emptyResolution.surfaces) &&
                            emptyResolution.surfaces.length === 0,
                        JSON.stringify(emptyResolution),
                    )

                    const installed = await installer.install({
                        workspaceId: ids.workspace,
                        blueprintId: BLUEPRINT_ID,
                        idempotencyKey: id("install"),
                        actor: "s2b-owner",
                    })
                    const configuredSurfaces = installed.installation.config.surfaces

                    const roleResponses: Array<{ role: KnownRole; response: Captured }> = []
                    for (const role of KNOWN_ROLES) {
                        identity.current = ids.clerkByRole[role]
                        roleResponses.push({ role, response: await capture(api.forWorkspace(ids.workspace)) })
                    }

                    const owner = roleResponses.find(({ role }) => role === "OWNER")?.response
                    if (!owner) throw new Error("fixture error: OWNER response missing")
                    const ownerResolution = resolutionOf(owner)
                    check(
                        "2b. a member receives 200 with this workspace's installed surfaces and provenance",
                        owner.status === 200 &&
                            ownerResolution.workspaceId === ids.workspace &&
                            ownerResolution.source === "active-blueprint-installation" &&
                            ownerResolution.installationId === installed.installation.id &&
                            ownerResolution.blueprintId === BLUEPRINT_ID &&
                            exactSet(ownerResolution.surfaces as string[], configuredSurfaces) &&
                            Array.isArray(ownerResolution.unknownSurfaces),
                        JSON.stringify(ownerResolution),
                    )

                    identity.current = ids.foreignClerk
                    const foreign = await capture(api.forWorkspace(ids.workspace))
                    const nonexistent = await capture(api.forWorkspace(id("does_not_exist")))
                    check(
                        "3. foreign and nonexistent workspaces are byte-identical 403s after identity switches tenants",
                        foreign.status === 403 && nonexistent.status === 403 && foreign.raw === nonexistent.raw,
                        `${foreign.status}/${nonexistent.status} ${foreign.raw} | identity=${ids.foreignClerk}`,
                    )

                    const allowedRoles = KNOWN_ROLES.filter((role) => ROLE_PERMISSION_MATRIX[role].includes("profile.read"))
                    const deniedRoles = KNOWN_ROLES.filter((role) => !ROLE_PERMISSION_MATRIX[role].includes("profile.read"))
                    const roleBehaviorHolds = roleResponses.every(({ role, response }) =>
                        ROLE_PERMISSION_MATRIX[role].includes("profile.read")
                            ? response.status === 200
                            : response.status === 403,
                    )
                    check(
                        "4b. seeded role reads follow ROLE_PERMISSION_MATRIX profile.read exactly",
                        roleBehaviorHolds && allowedRoles.length + deniedRoles.length === KNOWN_ROLES.length,
                        `allowed=${allowedRoles.join(",") || "none"}; denied=${deniedRoles.join(",") || "none"}; statuses=${roleResponses.map(({ role, response }) => `${role}:${response.status}`).join(",")}`,
                    )

                    const allRoleBodies = roleResponses.map(({ response }) => response.raw).join("\n")
                    const permissionsAfter = JSON.stringify(PERMISSION_KEYS)
                    const permissionValueReturned = PERMISSION_KEYS.some((permission) =>
                        roleResponses.some(({ response }) => response.raw.includes(JSON.stringify(permission))),
                    )
                    check(
                        "5. install/read keeps PERMISSION_KEYS byte-identical and returns no role or permission field",
                        permissionsBefore === permissionsAfter &&
                            !permissionValueReturned &&
                            roleResponses.every(({ response }) => !hasForbiddenResponseField(response.body)),
                        `catalogSame=${permissionsBefore === permissionsAfter} permissionValueReturned=${permissionValueReturned}`,
                    )
                    check(
                        "6. businessOs never appears in any installation-derived role response",
                        !allRoleBodies.includes("businessOs") &&
                            configuredSurfaces.length > 0 &&
                            !configuredSurfaces.includes("businessOs"),
                        `roles=${roleResponses.length} configured=[${configuredSurfaces.join(",")}]`,
                    )

                    check(
                        "10a. the 200 response uses { ok, data } and the complete resolution shape",
                        outerKeys(owner) === "data,ok" &&
                            owner.body.ok === true &&
                            Object.keys(ownerResolution).sort().join(",") ===
                                "blueprintId,installationId,notInstallableSurfaces,source,surfaces,unknownSurfaces,workspaceId",
                        `outer=${outerKeys(owner)} resolution=${Object.keys(ownerResolution).sort().join(",")}`,
                    )
                    for (const [label, refusal] of [
                        ["401", anonymous],
                        ["403", foreign],
                    ] as const) {
                        check(
                            `10${label === "401" ? "c" : "d"}. the ${label} refusal uses { ok, error }`,
                            outerKeys(refusal) === "error,ok" && refusal.body.ok === false,
                            `keys=${outerKeys(refusal)} ok=${String(refusal.body.ok)}`,
                        )
                    }

                    throw new Rollback("deliberate rollback of append-only installation ledger")
                },
                { timeout: 120_000 },
            )
        } catch (error) {
            if (!(error instanceof Rollback)) throw error
        }

        const residue = await residueCount(prisma)
        check("12. the unique run prefix has zero residue after rollback", residue === 0, `prefix=${RUN} rows=${residue}`)
    } finally {
        await prisma.$disconnect()
    }

    for (const result of results) {
        console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}  (${result.detail})`)
    }
    const failed = results.filter(({ pass }) => !pass)
    console.log("")
    console.log(`RUN_PREFIX=${RUN}`)
    console.log(`ROLE_MATRIX=${KNOWN_ROLES.map((role) => `${role}:${ROLE_PERMISSION_MATRIX[role].includes("profile.read") ? "allow" : "deny"}`).join(",")}`)
    console.log(`SUMMARY mode=${INVERT ? "inverted" : "normal"} passed=${results.length - failed.length} failed=${failed.length}`)
    if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
