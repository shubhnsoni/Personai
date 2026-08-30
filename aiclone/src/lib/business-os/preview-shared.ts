/**
 * Tenancy for blueprint preview.
 *
 * The same `PersistedTenancy` bridge every other surface uses. It asks for `profile.read` and nothing
 * else, because preview is read-only - there is no `profile.update` path in this domain at all, so a
 * caller cannot be argued into a write because there is nothing to call.
 *
 * IT RESOLVES A WORKSPACE, NOT A PROFILE, AND THAT IS THE WHOLE OF WHAT IT NEEDS. Preview data comes
 * from the static registry, so no tenant row is read. The only question is whether the caller is
 * entitled to use this surface at all - which is checked before the registry is touched, so the
 * endpoint cannot be used as a registry oracle by somebody with no workspace access.
 *
 * Unlike the record contexts there is no `denied()` helper and no owned-row resolver, because there is
 * no caller-supplied record id to resolve. A blueprint id is a public static key, and the boundary turns
 * an unknown one into a 404 rather than a refusal - see the comment in preview-http.ts for why that is
 * correct here and wrong everywhere else.
 */
import type { PrismaClient } from "@prisma/client"

import type { PersistedTenancy } from "../persistence/tenancy"

export class PreviewContext {
    constructor(
        readonly db: PrismaClient,
        private readonly tenancy: PersistedTenancy,
    ) {}

    /** Throws FORBIDDEN or UNAUTHORIZED. Returns the authorised workspace id. */
    async requireWorkspace(workspaceId: string): Promise<string> {
        const access = await this.tenancy.requireAccess(workspaceId, "profile.read")
        return access.workspaceId
    }
}
