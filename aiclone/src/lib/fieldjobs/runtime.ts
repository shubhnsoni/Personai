import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { FieldJobIntakeService, FieldJobService } from "./engine"
import { FieldJobApiService } from "./http"
import { FieldJobContext } from "./shared"

/**
 * Composition root for the fieldJobs surface. Identity comes from Clerk on the server; nothing
 * accepts a caller-supplied user id.
 *
 * There are no adapters here, and their absence is the design rather than an omission. A field
 * service product is where you would expect a map provider, a routing engine and an SMS gateway.
 * This engine has none: no route is optimised, no distance is computed, and no technician is
 * notified. Adding any of them means adding a client here, which is the one place a reviewer has to
 * look to know whether that has happened.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new FieldJobContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const fieldJobApi = new FieldJobApiService(new FieldJobIntakeService(ctx), new FieldJobService(ctx))
