/**
 * Tenancy for blueprint installation.
 *
 * TWO DIFFERENT PERMISSIONS, and the difference is the whole of the role-safety claim.
 *
 *   READING what is installed, and PLANNING an install, ask for `profile.read` - the same permission
 *   preview asks for. Onboarding needs to be able to show an owner what installing would do before they
 *   have any elevated role, and a plan is a read.
 *
 *   INSTALLING and REMOVING ask for `workspace.update`, which by ROLE_PERMISSION_MATRIX is held only by
 *   OWNER and ADMIN. Deliberately NOT `profile.update`, which MANAGER also holds: installing a blueprint
 *   re-terms the entire workspace - what a job is called, which surfaces the vertical implies, which
 *   engines are composed - and that is a workspace-level act, not a profile-level one. A manager being
 *   able to change what the business IS would be a silent permission expansion achieved by picking a
 *   permission that happened to already be there.
 *
 * NO NEW PERMISSION KEY IS INTRODUCED. There is no `blueprint.install`, because adding a key to
 * PERMISSION_KEYS would extend the OWNER and ADMIN closures automatically (both are derived from
 * ALL_PERMISSIONS) and would require a decision about every other role. The installation harness asserts
 * the permission catalogue is byte-identical before and after this package.
 */
import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../persistence/errors"
import type { PersistedTenancy } from "../persistence/tenancy"

export class InstallContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /** Read path. Throws UNAUTHORIZED or FORBIDDEN. Returns the authorised workspace id. */
    async requireReadableWorkspace(workspaceId: string): Promise<string> {
        const access = await this.tenancy.requireAccess(this.required(workspaceId, "workspaceId"), "profile.read")
        return access.workspaceId
    }

    /**
     * Write path. `workspace.update` is OWNER and ADMIN only.
     *
     * A foreign workspace and a nonexistent one both surface as the same FORBIDDEN from the shared
     * tenancy bridge, so this endpoint cannot be used to discover which workspace ids exist.
     */
    async requireWritableWorkspace(workspaceId: string): Promise<string> {
        const access = await this.tenancy.requireAccess(this.required(workspaceId, "workspaceId"), "workspace.update")
        return access.workspaceId
    }

    /** Blank-rejecting reader. A blank id must be a 400, never an unscoped query. */
    required(value: string | null | undefined, field: string): string {
        const trimmed = (value ?? "").trim()
        if (!trimmed) throw new PersistenceError("BAD_REQUEST", `${field} is required`, { field })
        return trimmed
    }
}
