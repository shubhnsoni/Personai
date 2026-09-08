import { syncUser } from "@/lib/auth-sync"

import {
  createOwnershipFoundation,
  type SecurityProfile,
  type SecurityUser,
  type ServerIdentitySource,
} from "./ownership"

type SyncedUser = NonNullable<Awaited<ReturnType<typeof syncUser>>>
type SyncedProfile = SyncedUser["profiles"][number]

const syncUserIdentity: ServerIdentitySource<SyncedProfile> = {
  async resolve(): Promise<SecurityUser<SyncedProfile> | null> {
    const user = await syncUser()
    if (!user) return null
    return user
  },
}

export const serverOwnership = createOwnershipFoundation(syncUserIdentity)

export const requireAuthenticatedUser = serverOwnership.requireAuthenticatedUser
export const requireOwnedProfile = serverOwnership.requireOwnedProfile
export const requireOwnedResource = serverOwnership.requireOwnedResource
export const executeOwnedResourceWrite = serverOwnership.executeOwnedResourceWrite

export type ServerSecurityProfile = SyncedProfile & SecurityProfile
