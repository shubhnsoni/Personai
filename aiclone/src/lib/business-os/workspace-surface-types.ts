import type { Surface } from "../surfaces"

/**
 * Effective product surfaces for a caller in one explicit workspace.
 *
 * WHAT THIS IS: a workspace-scoped PRODUCT projection selected after tenancy authorization.
 *
 * WHAT THIS IS NOT: an authorization result or permission grant. Membership and
 * ROLE_PERMISSION_MATRIX remain authoritative for security. A surface may hide or show product UI,
 * but it cannot make an operation legal.
 *
 * WHAT THIS IS NOT: a profile preference. Profile.personalityConfig is shared by one profile while
 * Membership is keyed by (workspaceId, userId), so using profile extras in a workspace would leak one
 * decision across every workspace the user can reach.
 */
export type WorkspaceSurfaceResolution = Readonly<{
    workspaceId: string
    installationId: string | null
    blueprintId: string | null
    source: "active-blueprint-installation" | "no-active-blueprint-installation"
    surfaces: readonly Surface[]
    /**
     * Strings present in the frozen config that THIS BUILD does not recognise as product surfaces.
     * Dropped from `surfaces`, and reported here rather than discarded silently.
     *
     * This exists because a frozen config is designed to OUTLIVE the code that wrote it. The day a
     * surface is retired from the `Surface` union, every workspace installed before that release holds a
     * config naming it. Refusing the whole config then would take those workspaces down on deploy - a
     * self-inflicted outage caused by data that was valid when it was written. Dropping is also the
     * fail-SAFE direction: an unrecognised string cannot be granted, so a permission-shaped value in a
     * surfaces array is ignored rather than honoured.
     *
     * STRUCTURAL corruption is different and still throws: a config that is not an object, whose
     * `surfaces` is not an array, that does not assert `businessOsExcluded`, or that contains a
     * non-string element, is not outdated - it is wrong, and guessing at its meaning would be worse
     * than refusing it.
     */
    unknownSurfaces: readonly string[]
}>

/**
 * The only input accepted by the legacy, no-workspace path.
 *
 * The caller must already have the profile values. There is deliberately no user id, membership id,
 * workspace id, or database lookup here: without an explicit workspace, selecting an arbitrary
 * membership would make iteration order a security boundary.
 */
export type LegacyProfileSurfaceInput = Readonly<{
    roleTemplate: string | null
    personalityConfig: string | null
}>

/** Legacy profile-level product surfaces, valid only when no workspace context exists. */
export type LegacyProfileSurfaceResolution = Readonly<{
    workspaceId: null
    installationId: null
    blueprintId: null
    source: "legacy-profile"
    surfaces: readonly Surface[]
}>

/**
 * Candidate resolver boundary. Its return types intentionally have no role, permission, grant, or
 * authorization field. Authorization happens before a workspace result is produced.
 */
export type WorkspaceSurfaceResolverPort = Readonly<{
    forWorkspace(workspaceId: string): Promise<WorkspaceSurfaceResolution>
    withoutWorkspace(profile: LegacyProfileSurfaceInput): LegacyProfileSurfaceResolution
}>

/**
 * Executable-contract labels pinned by check-workspace-surface-contract.ts.
 *
 * These are invariants, not desired behaviour:
 *
 * 1. An authorized workspace resolves from that workspace's ACTIVE installation, never globally from
 *    Profile.personalityConfig.
 * 2. Two workspaces reached by the same user remain isolated; neither installation can contribute a
 *    surface to the other.
 * 3. The ACTIVE row's frozen configJson.surfaces is the complete workspace source of truth. The live
 *    blueprint registry is not re-resolved and profile extras are not merged.
 * 4. REMOVED and SUPERSEDED rows contribute zero surfaces. With no ACTIVE row, a workspace result is
 *    explicitly empty rather than falling back to profile state.
 * 5. An upgrade replaces the effective set with the new ACTIVE row's frozen set; old and new sets are
 *    never unioned.
 * 6. Missing and foreign workspace ids fail closed with byte-identical serialized refusals. The
 *    resolver authorizes before reading installation state, preventing workspace enumeration.
 * 7. Surfaces never grant RBAC permissions: PERMISSION_KEYS is unchanged, the resolver returns no
 *    permission field, and permission-shaped strings are invalid installation surfaces.
 * 8. Installing or resolving surfaces cannot mutate Profile.personalityConfig. Installation is already
 *    workspace-scoped and this resolver is read-only; the harness compares the stored column byte for
 *    byte across the full flow.
 */
export const WORKSPACE_SURFACE_INVARIANTS = Object.freeze([
    "active installation is workspace-scoped",
    "workspace installations are isolated for multi-workspace users",
    "active configJson surfaces are authoritative",
    "removed and superseded installations contribute nothing",
    "upgrades replace rather than union surface sets",
    "missing and foreign workspaces fail closed identically",
    "surfaces never grant RBAC permissions",
    "profile personalityConfig remains byte-identical",
] as const)
