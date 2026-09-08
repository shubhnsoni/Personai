import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { WorkspaceSurfaceApiService } from "./workspace-surface-http"
import { WorkspaceSurfaceResolver } from "./workspace-surfaces"

/** Production identity is server-derived; callers cannot supply or override a user id. */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const tenancy = new PersistedTenancy(prisma, new ClerkPlatformIdentity())

export const workspaceSurfaceApi = new WorkspaceSurfaceApiService(new WorkspaceSurfaceResolver(prisma, tenancy))
