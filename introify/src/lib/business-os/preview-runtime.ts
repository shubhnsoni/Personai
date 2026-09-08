import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { BlueprintPreviewService } from "./preview"
import { BlueprintPreviewApiService } from "./preview-http"
import { PreviewContext } from "./preview-shared"

/**
 * Composition root for blueprint preview. Identity comes from Clerk on the server; nothing accepts a
 * caller-supplied user id.
 *
 * There is no adapter here, and in this domain that is not a preference: the service performs no write
 * and reads no tenant row, so there is nothing for a provider to do. If a mailer, queue or scheduler ever
 * appears in this domain it appears in this file first, which is the one place a reviewer has to read to
 * know that preview has started meaning more than "a question answered when asked".
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new PreviewContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const blueprintPreviewApi = new BlueprintPreviewApiService(ctx, new BlueprintPreviewService())
