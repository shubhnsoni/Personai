import type { PrismaClient } from "@prisma/client"

import { extrasOf, surfacesFor, type Surface } from "../surfaces"
import { PersistenceError } from "../persistence/errors"
import type { PersistedTenancy } from "../persistence/tenancy"
import type {
    LegacyProfileSurfaceInput,
    LegacyProfileSurfaceResolution,
    WorkspaceSurfaceResolution,
    WorkspaceSurfaceResolverPort,
} from "./workspace-surface-types"

/**
 * Surfaces an installation is allowed to contribute. businessOs is deliberately absent: installation
 * records assert businessOsExcluded=true, and the owner console remains a separate explicit opt-in.
 */
const INSTALLABLE_SURFACES = Object.freeze([
    "home",
    "profile",
    "inbox",
    "leads",
    "shop",
    "services",
    "calendar",
    "courses",
    "events",
    "sales",
] as const satisfies readonly Surface[])

const INSTALLABLE_SURFACE_SET: ReadonlySet<string> = new Set(INSTALLABLE_SURFACES)

type FrozenInstallationConfig = Readonly<{
    surfaces: readonly Surface[]
}>

/**
 * Fail closed on malformed frozen data. Filtering unknown values would silently broaden the meaning of
 * a partially corrupt config, while accepting permission-shaped strings would collapse product and
 * authorization concerns.
 */
function frozenConfig(value: unknown, installationId: string): FrozenInstallationConfig {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw invalidConfig(installationId)
    }

    const candidate = value as { surfaces?: unknown; businessOsExcluded?: unknown }
    if (!Array.isArray(candidate.surfaces) || candidate.businessOsExcluded !== true) {
        throw invalidConfig(installationId)
    }

    const surfaces: Surface[] = []
    for (const surface of candidate.surfaces) {
        if (typeof surface !== "string" || !INSTALLABLE_SURFACE_SET.has(surface)) {
            throw invalidConfig(installationId)
        }
        if (!surfaces.includes(surface as Surface)) surfaces.push(surface as Surface)
    }

    return Object.freeze({ surfaces: Object.freeze(surfaces) })
}

function invalidConfig(installationId: string): PersistenceError {
    return new PersistenceError("CONFLICT", "Active workspace surface configuration is invalid", {
        installationId,
    })
}

/**
 * Candidate bridge from the existing BlueprintInstallation ledger to effective product surfaces.
 *
 * Security is intentionally delegated to PersistedTenancy rather than restated here. The installation
 * query happens only after profile.read succeeds, and it is pinned to both the authorized workspace id
 * and state=ACTIVE. The database partial unique index makes that row singular.
 */
export class WorkspaceSurfaceResolver implements WorkspaceSurfaceResolverPort {
    constructor(
        private readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    async forWorkspace(workspaceId: string): Promise<WorkspaceSurfaceResolution> {
        const access = await this.tenancy.requireAccess(workspaceId, "profile.read")
        const installation = await this.db.blueprintInstallation.findFirst({
            where: { workspaceId: access.workspaceId, state: "ACTIVE" },
            select: { id: true, blueprintId: true, configJson: true },
        })

        if (!installation) {
            return Object.freeze({
                workspaceId: access.workspaceId,
                installationId: null,
                blueprintId: null,
                source: "no-active-blueprint-installation" as const,
                surfaces: Object.freeze([]) as readonly Surface[],
            })
        }

        const config = frozenConfig(installation.configJson, installation.id)
        return Object.freeze({
            workspaceId: access.workspaceId,
            installationId: installation.id,
            blueprintId: installation.blueprintId,
            source: "active-blueprint-installation" as const,
            surfaces: config.surfaces,
        })
    }

    /**
     * Compatibility path for a caller that genuinely has no workspace. It cannot query memberships or
     * installations and therefore cannot guess which workspace the caller meant.
     */
    withoutWorkspace(profile: LegacyProfileSurfaceInput): LegacyProfileSurfaceResolution {
        return Object.freeze({
            workspaceId: null,
            installationId: null,
            blueprintId: null,
            source: "legacy-profile" as const,
            surfaces: Object.freeze([
                ...surfacesFor(profile.roleTemplate, extrasOf(profile.personalityConfig)),
            ]),
        })
    }
}
