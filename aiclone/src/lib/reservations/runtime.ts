import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { PersistedReservations } from "./engine"
import { ReservationService } from "./service"

/**
 * Composition root for the reservation surface.
 *
 * Identity comes from Clerk on the server. Nothing here accepts a caller-supplied
 * user id, which is the same rule the security foundation enforces elsewhere.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const tenancy = new PersistedTenancy(prisma, new ClerkPlatformIdentity())

export const reservationService = new ReservationService(new PersistedReservations(prisma, tenancy))
