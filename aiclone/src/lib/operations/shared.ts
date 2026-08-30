/**
 * Tenancy for the operations view.
 *
 * The same profileId bridge every other engine in this repository uses, and deliberately the same
 * shape as FieldJobContext: PersistedTenancy.requireAccess does the signed-in, provisioned, member
 * and permission work, and this class only turns its answer into a profileId.
 *
 * It asks for `profile.read` and nothing else, because the operations view is read-only. There is no
 * `profile.update` path in this domain at all - not gated, not present - so a caller with read access
 * cannot be tricked into a write by any argument, because there is nothing to call.
 *
 * There is no `denied()` helper here, unlike the other contexts, and its absence is deliberate: this
 * engine never resolves a caller-supplied record id. It only ever asks "everything for MY profile",
 * so there is no foreign-row case to refuse and therefore no non-enumeration surface to get wrong.
 */
import type { PrismaClient } from "@prisma/client"

import { PersistenceError } from "../persistence/errors"
import type { PersistedTenancy } from "../persistence/tenancy"

export class OperationsContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /**
     * Resolves the caller's workspace to the profileId whose records the view aggregates.
     *
     * Only `profile.read` is accepted. Widening this to `profile.update` would be a signal that
     * something in this domain writes, and nothing does.
     */
    async requireProfile(workspaceId: string, permission: "profile.read"): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, permission)
        const workspace = await this.db.workspace.findUnique({
            where: { id: access.workspaceId },
            select: { profileId: true },
        })
        if (!workspace?.profileId) {
            throw new PersistenceError("FORBIDDEN", "This workspace is not linked to a profile that owns operations")
        }
        return workspace.profileId
    }
}
