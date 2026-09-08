import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { CaseIntakeService, CaseProjectService } from "./engine"
import { CaseApiService } from "./http"
import { CaseRetainerService } from "./retainers"
import { CaseContext } from "./shared"
import { CaseWorkflowService } from "./workflow"

/**
 * Composition root for the cases surface. Identity comes from Clerk on the server;
 * nothing accepts a caller-supplied user id.
 *
 * There are no external adapters here on purpose: the cases engine performs no storage,
 * payment, messaging or AI call. Invoices record state and reference existing Payment rows
 * rather than moving money, and retainers do the same - a retainer period's billing state
 * points at a CaseInvoice and never at a charge.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new CaseContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const caseApi = new CaseApiService(
    new CaseIntakeService(ctx),
    new CaseProjectService(ctx),
    new CaseWorkflowService(ctx),
    new CaseRetainerService(ctx),
)
