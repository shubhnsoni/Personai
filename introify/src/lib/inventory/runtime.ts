import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { InventoryService } from "./engine"
import { InventoryApiService } from "./http"
import { InventoryContext } from "./shared"

/**
 * Composition root for the inventory surface. Identity comes from Clerk on the server;
 * nothing accepts a caller-supplied user id.
 *
 * There are no external adapters here on purpose: inventory performs no storage, payment,
 * messaging or AI call. It moves numbers between on-hand and reserved and writes a ledger.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const ctx = new InventoryContext(prisma, new PersistedTenancy(prisma, new ClerkPlatformIdentity()))

export const inventoryApi = new InventoryApiService(new InventoryService(ctx))
