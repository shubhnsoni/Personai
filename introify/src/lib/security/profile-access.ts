import { syncUser } from "@/lib/auth-sync"
import { canAccessProfile, type ProfilePermission } from "@/lib/workspace-access"
import { createOwnershipFoundation, type OwnedProfileOptions, type OwnedResourceInput, type OwnedResourceWriteInput } from "./ownership"

type Profile = NonNullable<Awaited<ReturnType<typeof syncUser>>>["profiles"][number]
type AccessOptions = OwnedProfileOptions<Profile> & { permission?: ProfilePermission }

function foundation(permission: ProfilePermission) {
    return createOwnershipFoundation<Profile>({
        async resolve() {
            const user = await syncUser()
            if (!user) return null
            return {
                id: user.id,
                activeProfileId: user.activeProfile?.id,
                profiles: user.accessibleProfiles.filter((profile) => canAccessProfile(user.profileAccess[profile.id], permission)),
            }
        },
    })
}

/** Membership-derived access. Unlike requireOwnedProfile this never implies ownership. */
export function requireProfileAccess(options: AccessOptions = {}) {
    return foundation(options.permission || "content.write").requireOwnedProfile(options)
}

export function requireProfileResource<Resource>(input: OwnedResourceInput<Profile, Resource> & { permission?: ProfilePermission }) {
    return foundation(input.permission || "content.write").requireOwnedResource(input)
}

export function executeProfileResourceWrite<Result>(input: OwnedResourceWriteInput<Profile, Result> & { permission?: ProfilePermission }) {
    return foundation(input.permission || "content.write").executeOwnedResourceWrite(input)
}
