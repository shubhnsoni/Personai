import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { BlueprintInstallService } from "./install"
import { BlueprintInstallApiService } from "./install-http"
import { InstallContext } from "./install-shared"
import { BlueprintPreviewService } from "./preview"

/**
 * Composition root for blueprint installation. Identity comes from Clerk on the server; nothing accepts a
 * caller-supplied user id.
 *
 * THE SERVICE IS CONSTRUCTED WITH NO HOOKS. `BlueprintInstallService` accepts two optional test seams,
 * and production must pass neither:
 *
 *   `beforeCommit` runs as the last statement inside the install transaction. It exists so the harness
 *   can force a failure at the last step, which is the only way to prove "a failure at the last step
 *   leaves zero partial rows" without faking the database and proving something about the fake.
 *
 *   `runInTransaction` substitutes how the transaction is opened. The harness needs it because Prisma's
 *   interactive transaction client does not expose `$transaction`, so a harness wrapping its assertions
 *   in one rolled-back transaction cannot also let this service open its own. It has to wrap them: the
 *   installation ledger is append-only, so once an event row exists neither it, nor its installation,
 *   nor its workspace can be deleted, and rollback is the only cleanup available.
 *
 * Both are absent below, and the runtime harness asserts that by reading this file's EXECUTABLE lines
 * rather than by trusting this comment - which is also why naming them here is safe.
 *
 * There is no mailer, queue, scheduler or payment client here, and that absence is the point: installing
 * a blueprint configures a workspace, it does not notify anybody or charge anything. If such a dependency
 * ever appears in this domain it appears in this file first, which is the one place a reviewer has to
 * read to know installation has started meaning more than it says.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new InstallContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const blueprintInstallApi = new BlueprintInstallApiService(
    new BlueprintInstallService(ctx, new BlueprintPreviewService()),
)
