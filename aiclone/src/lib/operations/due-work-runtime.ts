import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { DueWorkApiService } from "./due-work-http"
import { OperationsService } from "./engine"
import { OperationsContext } from "./shared"

/**
 * Composition root for the due-work preview. Identity comes from Clerk on the server; nothing accepts a
 * caller-supplied user id.
 *
 * THERE IS NO ADAPTER HERE, AND THAT IS THE POINT OF THE FILE.
 *
 * No scheduler. No timer. No interval. No cron. No queue or queue client. No mailer. No payment client.
 * No carrier. No push or notification transport. The preview reads and returns; there is nothing for a
 * provider to do, so there is nothing to inject.
 *
 * This is the one file a reviewer has to read to know whether that is still true. If "due work" ever
 * starts meaning something more than "a question answered when somebody asks it", the dependency
 * appears HERE first - before any route, any component or any document mentions it. So the harness
 * asserts the absence against this file by name, over executable lines, and a new import that looks like
 * a provider fails the gate rather than shipping quietly.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new OperationsContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const dueWorkApi = new DueWorkApiService(new OperationsService(ctx))
