/**
 * Blueprint installation runtime.
 *
 * Preview answers "what would this mean". This is the half that writes it down. Everything it writes is
 * one transaction, and everything it refuses leaves nothing behind.
 *
 * WHAT IT WRITES: a `BlueprintInstallation` row, and one or two `BlueprintInstallationEvent` lines.
 * That is the entire footprint. It touches no other table, and specifically it does NOT write
 * `Profile.personalityConfig`, so no permission changes - see install-types.ts for why that is
 * structural rather than cautious.
 *
 * THE FOUR REFUSALS, and the code each carries:
 *
 *   unknown blueprint id                            404, because a blueprint id is a public static key
 *   foreign or nonexistent workspace                403, byte-identically, because a workspace id is not
 *   a required capability is not `available`         409, refused AT INSTALL TIME and not merely at
 *                                                   declaration time, because a capability can regress
 *                                                   after a blueprint was declared active
 *   the same idempotency key with different args     409, because silently returning the first result
 *                                                   would make the key a lie
 *
 * IDEMPOTENCY IS A REPLAY, NOT A NO-OP. A repeat call returns the ORIGINAL installation with
 * `outcome: "replayed"` and writes nothing - no second row in either table. The uniqueness is enforced
 * by the database on `(workspaceId, idempotencyKey)`, so two concurrent callers cannot both win.
 *
 * UPGRADE, NOT RE-INSTALL. Only one ACTIVE installation may exist per workspace - a partial unique index
 * enforces it - so installing a different blueprint over an existing one moves the old row to SUPERSEDED
 * and points the new one back at it. Installing the SAME blueprint that is already active is a 409
 * rather than a silent no-op, because "nothing happened" and "you already have this" are different
 * answers and the caller acted on one of them.
 */
import { PersistenceError } from "../persistence/errors"

import type { PrismaClient } from "@prisma/client"

import type {
    BlueprintInstallPort,
    InstallPlanView,
    InstallRequest,
    InstallResult,
    InstallationEventView,
    InstalledBlueprintView,
    InstalledConfig,
    WorkspaceInstallationView,
} from "./install-types"
import type { InstallContext } from "./install-shared"
import { BlueprintPreviewService } from "./preview"
import type { BlueprintPreviewView } from "./preview-types"

/**
 * What this view cannot tell you, shipped in the response rather than in a document.
 *
 * The surfaces sentence is the one that matters: an owner reading "surfaces: fieldJobs" would
 * reasonably conclude their navigation changed. It did not.
 */
const INSTALL_LIMITATIONS: readonly string[] = Object.freeze([
    "Installing records configuration. It does not grant anything: surfaces and field packs are stored per PROFILE (JSON on Profile.personalityConfig) and this install does not write them, because a workspace-scoped decision must not change what a user sees in their other workspaces.",
    "The owner console surface (businessOs) is never granted by a blueprint. It requires a separate explicit per-profile opt-in, and installing does not perform one.",
    "Workflows are not copied into the database. They are read from the static registry at the pinned blueprint version, so there is no second copy to drift.",
    "Nothing here schedules, notifies, charges or publishes. Installing configures.",
    "config is frozen at install time. Where re-resolving the blueprint today would produce something different, that is reported as drift rather than silently corrected.",
])

type InstallTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * How the install transaction is opened.
 *
 * Production uses the real `$transaction`. The harness needs to substitute it for one reason: Prisma's
 * interactive transaction client does not expose `$transaction`, so a harness that wraps its assertions
 * in one rolled-back transaction - which is how every other harness here leaves zero residue - cannot
 * also let this service open its own. And it must leave zero residue, because the ledger is append-only:
 * once an event row exists it cannot be deleted, and neither can its installation, its workspace or its
 * profile, since a cascaded DELETE still fires the BEFORE DELETE trigger.
 *
 * The ATOMICITY proof deliberately does NOT substitute this. It uses the real transaction with a throwing
 * `beforeCommit`, because a rollback that the harness performed itself would prove nothing about whether
 * the service's own transaction is atomic. That test needs no cleanup either - a successful proof is one
 * where nothing was written.
 */
type InstallTxRunner = <T>(fn: (tx: InstallTx) => Promise<T>) => Promise<T>

type InstallHooks = Readonly<{
    /**
     * Called as the LAST statement inside the install transaction, after every write.
     *
     * This exists for exactly one reason: the atomicity claim - "a failure at the last step leaves zero
     * partial rows" - cannot be proven without being able to cause a failure at the last step. Every
     * other way of forcing one either fails earlier (a bad argument is rejected before any write) or
     * requires faking the database, which would prove something about the fake.
     *
     * Production passes nothing. `install-runtime.ts` constructs the service with no hooks at all, and
     * the runtime harness asserts that by reading the composition root's source.
     */
    beforeCommit?: () => Promise<void>
    /** Substitutes how the transaction is opened. See InstallTxRunner. Production passes nothing. */
    runInTransaction?: InstallTxRunner
}>

type InstallationRow = {
    id: string
    workspaceId: string
    profileId: string | null
    blueprintId: string
    blueprintVersion: string
    state: string
    configJson: unknown
    supersedesInstallationId: string | null
    installedAt: Date
    removedAt: Date | null
}

type EventRow = {
    id: string
    kind: string
    actor: string
    blueprintId: string
    blueprintVersion: string
    detail: string | null
    createdAt: Date
}

/** Resolves the config an install would freeze, from the live registry. */
export function configFor(preview: BlueprintPreviewView): InstalledConfig {
    return Object.freeze({
        role: preview.presentation.role,
        surfaces: Object.freeze([...preview.presentation.surfaces]),
        fieldPacks: Object.freeze([...preview.presentation.fieldPacks]),
        terminology: Object.freeze({ ...preview.presentation.terminology }),
        engineIds: Object.freeze(preview.engines.map((engine) => engine.engineId)),
        // Asserted rather than assumed. If a role kit ever starts implying the owner console, this
        // becomes false and the install harness fails instead of the grant happening quietly.
        businessOsExcluded: !preview.presentation.surfaces.includes("businessOs"),
    })
}

/** Stable JSON, so drift comparison is about content and not key order. */
function canonical(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
}

export class BlueprintInstallService implements BlueprintInstallPort {
    constructor(
        private readonly ctx: InstallContext,
        private readonly previews: BlueprintPreviewService = new BlueprintPreviewService(),
        private readonly hooks: InstallHooks = {},
    ) {}

    /** The real transaction unless a harness substituted one. See InstallTxRunner. */
    private get tx(): InstallTxRunner {
        return this.hooks.runInTransaction ?? ((fn) => this.ctx.db.$transaction(fn))
    }

    /** Throws NOT_FOUND for an unknown id. The blueprint registry is public and static. */
    private requireBlueprint(blueprintId: string): BlueprintPreviewView {
        const id = this.ctx.required(blueprintId, "blueprintId")
        const preview = this.previews.preview(id)
        if (preview === null) {
            throw new PersistenceError("NOT_FOUND", `No blueprint is registered with id ${id}`, { blueprintId: id })
        }
        return preview
    }

    async install(request: InstallRequest): Promise<InstallResult> {
        const workspaceId = await this.ctx.requireWritableWorkspace(request.workspaceId)
        const key = this.ctx.required(request.idempotencyKey, "idempotencyKey")
        const actor = this.ctx.required(request.actor, "actor")
        const preview = this.requireBlueprint(request.blueprintId)

        // A REPLAY is decided before anything else is considered, so a repeat of a call that succeeded
        // stays successful even if the registry has since regressed. Refusing a replay because a
        // capability degraded after the fact would make retry-after-timeout unsafe.
        const prior = await this.ctx.db.blueprintInstallation.findUnique({
            where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } },
        })
        if (prior) {
            const row = prior as unknown as InstallationRow
            if (row.blueprintId !== preview.id) {
                throw new PersistenceError(
                    "CONFLICT",
                    "This idempotency key was already used to install a different blueprint",
                    { idempotencyKey: key, installed: row.blueprintId, requested: preview.id },
                )
            }
            return Object.freeze({
                installation: await this.view(row.id),
                outcome: "replayed" as const,
            })
        }

        // Refused at INSTALL time, not merely at declaration time: validateBusinessBlueprint checks this
        // when a blueprint is marked active, but a capability can regress afterwards and the blueprint
        // would still claim to be active.
        if (preview.blockedBy.length > 0) {
            throw new PersistenceError(
                "CONFLICT",
                `Cannot install ${preview.id}: a required capability is not available`,
                { blueprintId: preview.id, blockedBy: [...preview.blockedBy] },
            )
        }

        const active = (await this.ctx.db.blueprintInstallation.findFirst({
            where: { workspaceId, state: "ACTIVE" },
        })) as unknown as InstallationRow | null

        if (active && active.blueprintId === preview.id) {
            throw new PersistenceError("CONFLICT", `${preview.id} is already the active blueprint for this workspace`, {
                blueprintId: preview.id,
                installationId: active.id,
            })
        }

        const config = configFor(preview)
        const profileId = active?.profileId ?? (await this.workspaceProfileId(workspaceId))
        const isUpgrade = active !== null

        const createdId = await this.tx(async (tx) => {
            if (active) {
                // The old row must leave ACTIVE before the new one enters it: the partial unique index
                // permits exactly one, so doing this in the other order is refused by the database.
                await tx.blueprintInstallation.update({
                    where: { id: active.id },
                    data: { state: "SUPERSEDED" },
                })
                await tx.blueprintInstallationEvent.create({
                    data: {
                        installationId: active.id,
                        workspaceId,
                        kind: "SUPERSEDED",
                        blueprintId: active.blueprintId,
                        blueprintVersion: active.blueprintVersion,
                        actor,
                        detail: `Superseded by ${preview.id}`,
                    },
                })
            }

            const created = await tx.blueprintInstallation.create({
                data: {
                    workspaceId,
                    profileId,
                    blueprintId: preview.id,
                    blueprintVersion: preview.versioning.version,
                    state: "ACTIVE",
                    idempotencyKey: key,
                    configJson: config as unknown as object,
                    supersedesInstallationId: active?.id ?? null,
                    installedBy: actor,
                },
            })

            await tx.blueprintInstallationEvent.create({
                data: {
                    installationId: created.id,
                    workspaceId,
                    kind: isUpgrade ? "UPGRADED" : "INSTALLED",
                    blueprintId: preview.id,
                    blueprintVersion: preview.versioning.version,
                    actor,
                    detail: isUpgrade && active ? `Upgraded from ${active.blueprintId}` : null,
                },
            })

            // Last statement in the transaction. See InstallHooks.
            if (this.hooks.beforeCommit) await this.hooks.beforeCommit()

            return created.id
        })

        return Object.freeze({
            installation: await this.view(createdId),
            outcome: (isUpgrade ? "upgraded" : "installed") as "upgraded" | "installed",
        })
    }

    async remove(request: Readonly<{ workspaceId: string; actor: string; idempotencyKey: string }>): Promise<InstalledBlueprintView> {
        const workspaceId = await this.ctx.requireWritableWorkspace(request.workspaceId)
        const actor = this.ctx.required(request.actor, "actor")
        this.ctx.required(request.idempotencyKey, "idempotencyKey")

        const active = (await this.ctx.db.blueprintInstallation.findFirst({
            where: { workspaceId, state: "ACTIVE" },
        })) as unknown as InstallationRow | null

        if (!active) {
            // Idempotent: removing when nothing is installed returns the most recent removal rather than
            // refusing, so a retried DELETE is safe. Only a workspace that never installed anything is a
            // 409, because there is no removal to describe.
            const last = (await this.ctx.db.blueprintInstallation.findFirst({
                where: { workspaceId, state: "REMOVED" },
                orderBy: { removedAt: "desc" },
            })) as unknown as InstallationRow | null
            if (last) return this.view(last.id)
            throw new PersistenceError("CONFLICT", "This workspace has no installed blueprint to remove", { workspaceId })
        }

        await this.tx(async (tx) => {
            await tx.blueprintInstallation.update({
                where: { id: active.id },
                data: { state: "REMOVED", removedAt: new Date() },
            })
            await tx.blueprintInstallationEvent.create({
                data: {
                    installationId: active.id,
                    workspaceId,
                    kind: "REMOVED",
                    blueprintId: active.blueprintId,
                    blueprintVersion: active.blueprintVersion,
                    actor,
                    detail: "Removed by owner. The installation row and its history are retained.",
                },
            })
            if (this.hooks.beforeCommit) await this.hooks.beforeCommit()
        })

        return this.view(active.id)
    }

    async forWorkspace(workspaceId: string): Promise<WorkspaceInstallationView> {
        const scoped = await this.ctx.requireReadableWorkspace(workspaceId)
        const rows = (await this.ctx.db.blueprintInstallation.findMany({
            where: { workspaceId: scoped },
            orderBy: { installedAt: "desc" },
        })) as unknown as InstallationRow[]

        const all: InstalledBlueprintView[] = []
        for (const row of rows) all.push(await this.viewFromRow(row))

        return Object.freeze({
            workspaceId: scoped,
            installed: all.find((view) => view.state === "ACTIVE") ?? null,
            all: Object.freeze(all),
            limitations: INSTALL_LIMITATIONS,
        })
    }

    async plan(workspaceId: string, blueprintId: string): Promise<InstallPlanView> {
        const scoped = await this.ctx.requireReadableWorkspace(workspaceId)
        const preview = this.requireBlueprint(blueprintId)

        const active = (await this.ctx.db.blueprintInstallation.findFirst({
            where: { workspaceId: scoped, state: "ACTIVE" },
        })) as unknown as InstallationRow | null

        const refusals: string[] = []
        for (const blocker of preview.blockedBy) refusals.push(blocker)
        if (active && active.blueprintId === preview.id) {
            refusals.push(`${preview.id} is already the active blueprint for this workspace`)
        }
        // Choosing a superseded blueprint is allowed but surfaced: an owner picking v2 when v3 exists
        // should be told, not stopped.
        if (preview.versioning.isSuperseded) {
            refusals.push(
                `${preview.id} is superseded by ${preview.versioning.supersededBy.join(", ")}; installing it would install the older vertical`,
            )
        }

        return Object.freeze({
            preview,
            config: configFor(preview),
            isUpgrade: active !== null && active.blueprintId !== preview.id,
            supersedes:
                active && active.blueprintId !== preview.id
                    ? Object.freeze({
                          id: active.id,
                          blueprintId: active.blueprintId,
                          blueprintVersion: active.blueprintVersion,
                      })
                    : null,
            refused: refusals.length > 0,
            refusals: Object.freeze(refusals),
            // Always empty, and typed that way. Installing grants nothing.
            permissionChanges: Object.freeze([]) as readonly [],
        })
    }

    private async workspaceProfileId(workspaceId: string): Promise<string | null> {
        const workspace = await this.ctx.db.workspace.findUnique({
            where: { id: workspaceId },
            select: { profileId: true },
        })
        return workspace?.profileId ?? null
    }

    private async view(installationId: string): Promise<InstalledBlueprintView> {
        const row = (await this.ctx.db.blueprintInstallation.findUnique({
            where: { id: installationId },
        })) as unknown as InstallationRow | null
        if (!row) {
            throw new PersistenceError("NOT_FOUND", "Installation not found", { installationId })
        }
        return this.viewFromRow(row)
    }

    private async viewFromRow(row: InstallationRow): Promise<InstalledBlueprintView> {
        const events = (await this.ctx.db.blueprintInstallationEvent.findMany({
            where: { installationId: row.id },
            orderBy: { createdAt: "desc" },
        })) as unknown as EventRow[]

        // Re-resolve from the registry to report drift. A blueprint that has since been removed from the
        // registry entirely counts as drifted, and its blockers are unknowable rather than empty - so the
        // absence is reported instead of being flattened into "fine".
        const current = this.previews.preview(row.blueprintId)
        const frozen = canonical(row.configJson)
        const drifted = current === null || canonical(configFor(current)) !== frozen

        return Object.freeze({
            id: row.id,
            workspaceId: row.workspaceId,
            blueprintId: row.blueprintId,
            blueprintVersion: row.blueprintVersion,
            state: row.state as InstalledBlueprintView["state"],
            config: row.configJson as InstalledConfig,
            supersedesInstallationId: row.supersedesInstallationId,
            installedAt: row.installedAt.toISOString(),
            removedAt: row.removedAt ? row.removedAt.toISOString() : null,
            driftedFromRegistry: drifted,
            currentBlockers: Object.freeze(
                current === null
                    ? [`${row.blueprintId} is no longer in the blueprint registry, so its capabilities cannot be checked`]
                    : [...current.blockedBy],
            ),
            history: Object.freeze(events.map(toEventView)),
        })
    }
}

function toEventView(row: EventRow): InstallationEventView {
    return Object.freeze({
        id: row.id,
        kind: row.kind as InstallationEventView["kind"],
        actor: row.actor,
        blueprintId: row.blueprintId,
        blueprintVersion: row.blueprintVersion,
        detail: row.detail,
        occurredAt: row.createdAt.toISOString(),
    })
}

export { INSTALL_LIMITATIONS }
