import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { CourseAccessService } from "./access"
import { CohortService } from "./engine"
import { CohortApiService } from "./http"
import { CohortProgressService } from "./progress"
import { CohortContext } from "./shared"
import { CohortWorkflowService } from "./workflow"

/**
 * Composition root for the cohort surface. Identity comes from Clerk on the server;
 * nothing accepts a caller-supplied user id.
 *
 * There are no external adapters here on purpose: the cohort engine performs no storage,
 * payment, messaging or AI call. A renewal reminder enqueues a TaskJob row and stops
 * there; certificates and submissions reference existing ProfileDocument uploads.
 *
 * CourseAccessService is composed here for the OWNER access-level surface. LearnerAccessService
 * is deliberately NOT composed here: it answers to a Member cookie rather than a Clerk session,
 * and it is constructed at the library page that serves lesson content.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const identity = new ClerkPlatformIdentity()
const ctx = new CohortContext(prisma, new PersistedTenancy(prisma, identity))
const progress = new CohortProgressService(ctx)

export const cohortApi = new CohortApiService(
    new CohortService(ctx, progress),
    new CohortWorkflowService(ctx, progress),
    new CourseAccessService(ctx),
    identity,
)
