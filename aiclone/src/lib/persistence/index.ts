import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"

import { PersistedActivities } from "./activities"
import { PersistedContacts } from "./contacts"
import { PlatformService } from "./service"
import { PersistedTaskQueue } from "./tasks"
import { PersistedTenancy, type PlatformIdentity } from "./tenancy"

class ClerkPlatformIdentity implements PlatformIdentity {
    async userId(): Promise<string | null> {
        const session = await auth()
        return session.userId
    }
}

const tenancy = new PersistedTenancy(prisma, new ClerkPlatformIdentity())

export const platformService = new PlatformService({
    tenancy,
    contacts: new PersistedContacts(prisma),
    activities: new PersistedActivities(prisma),
    tasks: new PersistedTaskQueue(prisma),
})

export * from "./activities"
export * from "./contacts"
export * from "./errors"
export * from "./service"
export * from "./tasks"
export * from "./tenancy"
