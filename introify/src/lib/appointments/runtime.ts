import { auth } from "@clerk/nextjs/server"

import { PersistedTenancy, type PlatformIdentity } from "@/lib/persistence/tenancy"
import { prisma } from "@/lib/prisma"

import { PersistedAppointments } from "./engine"
import { AppointmentApiService } from "./http"
import { unconfiguredProviders } from "./providers"
import { AppointmentServices } from "./services"

/**
 * Composition root for the appointments surface.
 *
 * Identity comes from Clerk on the server; nothing accepts a caller-supplied user id.
 *
 * Providers are the UNCONFIGURED defaults on purpose. Wiring a live payment or messaging
 * provider requires an explicit code change here, so no deployment can start charging
 * cards or sending messages by accident. Until then a deposit stays REQUIRED and a
 * reminder stays SCHEDULED — the ledger never claims something that did not happen.
 */
class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const tenancy = new PersistedTenancy(prisma, new ClerkPlatformIdentity())
const engine = new PersistedAppointments(prisma, tenancy)
const services = new AppointmentServices(prisma, tenancy, engine, unconfiguredProviders())

export const appointmentApi = new AppointmentApiService(engine, services)
