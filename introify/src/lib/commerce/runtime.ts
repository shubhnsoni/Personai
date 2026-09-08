import { auth } from "@clerk/nextjs/server"

import { InventoryService } from "@/lib/inventory/engine"
import { InventoryContext } from "@/lib/inventory/shared"
import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { FulfilmentService } from "./fulfilment"
import { CommerceApiService } from "./http"
import { ReturnService } from "./returns"
import { CommerceContext } from "./shared"
import { VariantService } from "./variants"

/**
 * Composition root for the commerce surface. Identity comes from Clerk on the server;
 * nothing accepts a caller-supplied user id.
 *
 * The inventory engine is composed in rather than reimplemented: shipping consumes holds
 * through it and restocking credits stock through it, so there is exactly one place that
 * moves a balance.
 *
 * There are no external adapters here on purpose. Carrier and tracking fields are
 * owner-entered strings, refunds are pointers to Payment rows created elsewhere, and
 * nothing in this surface performs a payment, carrier or messaging call.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const tenancy = new PersistedTenancy(prisma, new ClerkPlatformIdentity())
const inventory = new InventoryService(new InventoryContext(prisma, tenancy))
const ctx = new CommerceContext(prisma, tenancy)

export const commerceApi = new CommerceApiService(
    new VariantService(ctx),
    new FulfilmentService(ctx, inventory),
    new ReturnService(ctx, inventory),
)
