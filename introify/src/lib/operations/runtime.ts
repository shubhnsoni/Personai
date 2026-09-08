import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { OperationsService } from "./engine"
import { OperationsApiService } from "./http"
import { OperationsContext } from "./shared"

/**
 * Composition root for the operations view. Identity comes from Clerk on the server; nothing accepts
 * a caller-supplied user id.
 *
 * There is no adapter here of any kind, and in this domain that is not merely a design preference:
 * this engine performs no write, so there is nothing for a provider to do. No scheduler, no queue, no
 * mailer, no payment client. If any of those ever appear, they appear in this file first, which is the
 * one place a reviewer has to read to know whether "operations" has started meaning something more
 * than "a question answered when asked".
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new OperationsContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const operationsApi = new OperationsApiService(new OperationsService(ctx))
