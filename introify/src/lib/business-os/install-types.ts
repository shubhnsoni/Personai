/**
 * Blueprint INSTALLATION contract.
 *
 * Phase 1 shipped preview (`preview-types.ts`), which answers "what would choosing this blueprint
 * mean" and is incapable of writing. This file is the durable half: what an install actually records,
 * and - just as load-bearing - what it deliberately does NOT do.
 *
 * This is a TYPE FILE rather than a design document on purpose. A document describing a shape can be
 * ignored, misread, or drift silently, and the drift only surfaces at runtime. The UI and the runtime
 * both import from here, so `tsc` exit 0 is itself evidence that they agree. That is not theoretical:
 * in Phase 1 the UI worker reported it could not verify its response shape against the resolver, and
 * the mismatch closed itself at compile time because both sides imported the same types.
 *
 * ---------------------------------------------------------------------------------------------------
 * WHAT AN INSTALL IS
 *
 * A durable, workspace-scoped record that a specific blueprint VERSION is the one this workspace runs,
 * plus the configuration resolved at the moment it was installed, plus an append-only history of how it
 * got that way.
 *
 * WHAT AN INSTALL IS NOT, each for a measured reason:
 *
 *   IT DOES NOT COPY WORKFLOW DECLARATIONS INTO THE DATABASE. There is no template table and no second
 *   workflow engine. The static registry IS the template: `blueprint.id` encodes the version
 *   (`restaurant-venue-v2` vs `-v3`), and the registry RETAINS deprecated entries rather than deleting
 *   them - which is precisely what makes pinning an id sufficient for immutability. Copying the
 *   declarations would create a second source of truth that can disagree with the first.
 *
 *   IT DOES NOT MUTATE `Profile.personalityConfig`, SO IT GRANTS NOTHING. Surfaces and field packs are
 *   stored per PROFILE as JSON on that column, while an installation is per WORKSPACE, and a user
 *   reaches many workspaces through `Membership` (keyed by userId, not profileId). Writing
 *   workspace-scoped intent into a profile-scoped store would change what that user sees in workspaces
 *   the install said nothing about. So installing changes ZERO permissions, and the runtime harness
 *   proves it by comparing the profile's stored config BYTE FOR BYTE across an install.
 *
 *   IT DOES NOT RECORD REFUSALS. A refused install must leave zero rows in every table it touches; a
 *   refusal row would be a partial write, and the atomicity proof would have to carve out an exception
 *   for it. Refusals surface as errors to the caller, not as durable state.
 *
 *   IT DOES NOT NOTIFY, CHARGE OR PUBLISH. Installing configures. No messaging, payment, carrier or
 *   provider call, and no scheduler.
 *
 * ---------------------------------------------------------------------------------------------------
 * ONE ACTIVE INSTALLATION PER WORKSPACE
 *
 * Enforced in the DATABASE by a partial unique index on `("workspaceId") WHERE state = 'ACTIVE'`, the
 * same mechanism that already enforces one default variant per product. A blueprint carries terminology
 * for a whole vertical - the calendar noun is "job" or "booking" or "reservation", not all three - so
 * two simultaneously active blueprints would leave the product unable to say what a thing is called.
 *
 * The consequence is the behaviour the directive asks for: changing blueprint is an UPGRADE THROUGH
 * SUPERSESSION, never a second install. The old row moves to SUPERSEDED and the new row points back at
 * it through `supersedesInstallationId`, so the chain is walkable in both directions.
 */
import type { BlueprintPreviewView } from "./preview-types"

/**
 * Lifecycle of one installation row.
 *
 * There is no FAILED state. A failed install leaves no row at all - see the atomicity note above.
 */
export type BlueprintInstallationState = "ACTIVE" | "SUPERSEDED" | "REMOVED"

/** What happened. Append-only; no kind describes a refusal, because a refusal writes nothing. */
export type BlueprintInstallationEventKind = "INSTALLED" | "UPGRADED" | "SUPERSEDED" | "REMOVED"

/**
 * The configuration resolved AT INSTALL TIME and frozen onto the row.
 *
 * Frozen rather than re-derived, because the point of recording it is to be able to answer "what did
 * this workspace agree to" after the registry has moved on. The live derivation is what preview shows;
 * this is what was true when the owner said yes. When they differ, that difference is itself the useful
 * signal, and `InstalledBlueprintView.driftedFromRegistry` reports it rather than hiding it.
 *
 * Every value here is role-derived, exactly as in preview - no blueprint declares terminology.
 */
export type InstalledConfig = Readonly<{
    /** The onboarding role the blueprint corresponded to when installed, or null if none did. */
    role: string | null
    /** Navigation surfaces the corresponding role kit implies. RECORDED, not granted. */
    surfaces: readonly string[]
    /** Field packs the corresponding role kit implies. RECORDED, not granted. */
    fieldPacks: readonly string[]
    /** Label overrides: what this vertical calls its calendar, its shop, its default fulfilment. */
    terminology: Readonly<Record<string, string>>
    /** Engine ids the blueprint composes, required or not, in declaration order. */
    engineIds: readonly string[]
    /**
     * True when `businessOs` is absent from `surfaces`, asserted on every install. The owner console is
     * never granted by a role kit and must never become grantable by installing a blueprint.
     */
    businessOsExcluded: boolean
}>

/** One line of the append-only history. */
export type InstallationEventView = Readonly<{
    id: string
    kind: BlueprintInstallationEventKind
    /** Who did it. An identity string, never a display name resolved from another table. */
    actor: string
    blueprintId: string
    blueprintVersion: string
    /** Free text explaining a transition whose reason is not obvious from `kind` alone. */
    detail: string | null
    /** ISO 8601. A serialised boundary never emits a Date object. */
    occurredAt: string
}>

/** An installation as the owner console and the API report it. */
export type InstalledBlueprintView = Readonly<{
    id: string
    workspaceId: string
    blueprintId: string
    blueprintVersion: string
    state: BlueprintInstallationState
    config: InstalledConfig
    /** The installation this one replaced, when it was an upgrade rather than a first install. */
    supersedesInstallationId: string | null
    /** ISO 8601. */
    installedAt: string
    /** ISO 8601, or null while still ACTIVE. */
    removedAt: string | null
    /**
     * True when re-resolving the blueprint TODAY would not produce `config`. Reported rather than
     * silently corrected: a capability can regress, and a role kit can change, after an install.
     */
    driftedFromRegistry: boolean
    /**
     * Why the workspace is not currently installable at this blueprint even though it is installed -
     * empty in the normal case. A required capability that has regressed to `partial` appears here, so
     * an owner learns their installed vertical has lost ground rather than finding out from a failure.
     */
    currentBlockers: readonly string[]
    /** History, newest first. Append-only in the database, enforced by trigger. */
    history: readonly InstallationEventView[]
}>

/**
 * What a caller must supply to install. `idempotencyKey` is REQUIRED, not optional: every engine in
 * this repository uses `(scope, idempotencyKey)` uniqueness, and making it optional would make the
 * replay guarantee depend on caller diligence.
 */
export type InstallRequest = Readonly<{
    workspaceId: string
    blueprintId: string
    idempotencyKey: string
    /** Identity performing the install, recorded in the ledger. */
    actor: string
}>

/**
 * The result of an install attempt that SUCCEEDED. A refusal is thrown as a `PersistenceError`, not
 * returned, so a caller cannot accidentally treat a refusal as an install by ignoring a field.
 */
export type InstallResult = Readonly<{
    installation: InstalledBlueprintView
    /**
     * How this call resolved. `replayed` means the idempotency key had already been used and NO new row
     * was written anywhere - the caller gets the original installation back. `upgraded` means an
     * earlier installation was superseded in the same transaction.
     */
    outcome: "installed" | "replayed" | "upgraded"
}>

/**
 * The read model for "what is installed here", including the honest empty answer.
 *
 * `installed: null` when nothing is installed - the same shape discipline preview uses, so a caller
 * cannot tell "nothing installed" apart from "field omitted" by accident.
 */
export type WorkspaceInstallationView = Readonly<{
    workspaceId: string
    installed: InstalledBlueprintView | null
    /** Every installation this workspace has ever had, newest first, including superseded and removed. */
    all: readonly InstalledBlueprintView[]
    /** What this view cannot tell you, in the response rather than in a document. */
    limitations: readonly string[]
}>

/**
 * Preview, extended with what install would do - WITHOUT installing.
 *
 * This is the "preview before install" requirement, and it reuses `BlueprintPreviewView` rather than
 * redeclaring it, so the two can never disagree about what a blueprint resolves to.
 */
export type InstallPlanView = Readonly<{
    preview: BlueprintPreviewView
    /** What the install would freeze onto the row. */
    config: InstalledConfig
    /** True when this would supersede an existing installation rather than be a first install. */
    isUpgrade: boolean
    /** The installation that would be superseded, when `isUpgrade`. */
    supersedes: Readonly<{ id: string; blueprintId: string; blueprintVersion: string }> | null
    /** True when an install right now would be refused, with the reasons in `refusals`. */
    refused: boolean
    /**
     * Why an install would be refused right now: an unavailable required capability, an unknown
     * blueprint, a deprecated blueprint superseded by a newer one. Empty when the install would proceed.
     */
    refusals: readonly string[]
    /**
     * Permissions this install would change. **Asserted to always be empty.** Present as a field rather
     * than omitted so that a reader can see the question was asked and answered, and so a future change
     * that starts granting something has to make this non-empty and fail the harness that pins it.
     */
    permissionChanges: readonly []
}>

/**
 * The write surface. Deliberately narrow: install, and remove. There is no "update the config" method,
 * because editing a frozen record of what was agreed to is how an audit trail stops being one - a
 * change of configuration is an upgrade, and upgrades go through `install`.
 */
export type BlueprintInstallPort = {
    /** Idempotent on `(workspaceId, idempotencyKey)`. Throws `PersistenceError` on refusal. */
    install(request: InstallRequest): Promise<InstallResult>
    /** Moves the active installation to REMOVED and appends to the ledger. Idempotent. */
    remove(request: Readonly<{ workspaceId: string; actor: string; idempotencyKey: string }>): Promise<InstalledBlueprintView>
    /** Read-only. Never writes, even to record that it was asked. */
    forWorkspace(workspaceId: string): Promise<WorkspaceInstallationView>
    /** Read-only. What install WOULD do. */
    plan(workspaceId: string, blueprintId: string): Promise<InstallPlanView>
}

/**
 * Error codes this surface uses, mapped to the shared `PersistenceError` vocabulary so the HTTP layer
 * needs no special cases:
 *
 *   BAD_REQUEST 400            - blank workspaceId, blank blueprintId, blank idempotencyKey
 *   UNAUTHORIZED 401           - no identity
 *   FORBIDDEN 403              - a workspace that is not the caller's, AND a workspace that does not
 *                                exist, byte-identically, because a workspace id is not public
 *   NOT_FOUND 404              - an unknown BLUEPRINT id only, which is a public static registry key.
 *                                Never used for a workspace.
 *   CONFLICT 409               - the same idempotency key reused with DIFFERENT arguments, and an
 *                                install attempted over an active installation of the SAME blueprint
 *                                version that is not a replay
 *   DEPENDENCY_UNAVAILABLE 503 - the database is unreachable; the body must leak no DSN
 */
export const INSTALL_ERROR_CODES = Object.freeze([
    "BAD_REQUEST",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "DEPENDENCY_UNAVAILABLE",
] as const)

/** Table names the runtime writes. The atomicity harness counts rows in EVERY one of these. */
export const INSTALL_TABLES = Object.freeze(["BlueprintInstallation", "BlueprintInstallationEvent"] as const)

/**
 * Tables this package must NOT create, from the design's forbidden list plus the two temptations that
 * came up while designing it. Asserted by the schema harness, so the refusal is enforced rather than
 * remembered.
 */
export const FORBIDDEN_TABLES = Object.freeze([
    // Workflows are reused from WorkflowRun/WorkflowStep/Approval. A blueprint-specific workflow table
    // would be a second workflow engine.
    "BlueprintWorkflow",
    "BlueprintWorkflowTemplate",
    "InstalledWorkflow",
    // Surfaces already exist per profile in src/lib/surfaces.ts. A table here would be a second
    // representation of the same concept.
    "BlueprintSurface",
    "InstalledSurface",
    // Terminology must be scoped to an installation. As its own table it would be global, which is the
    // specific shape the design forbids.
    "Terminology",
    "TerminologyPack",
    // A second task queue. TaskJob exists.
    "BlueprintTask",
    "InstallTask",
    // Vertical-specific forks - the thing the whole shared-engine thesis exists to prevent.
    "SalonConfig",
    "RestaurantConfig",
    "FieldServiceConfig",
    "ClinicConfig",
] as const)
