import { syncUser } from "@/lib/auth-sync"
import { extrasOf, hasSurface } from "@/lib/surfaces"
import { businessOsError } from "./responses"

/**
 * Authorization for the Business OS API.
 *
 * The routes enforce the same `businessOs` surface as the dashboard page. Without this,
 * a profile that is redirected away from `/dashboard/business-os` could still read the
 * registry over HTTP, which would make the page gate cosmetic.
 */
export type BusinessOsAccess =
    | { ok: true }
    | { ok: false; response: ReturnType<typeof businessOsError> }

export async function requireBusinessOsAccess(): Promise<BusinessOsAccess> {
    const user = await syncUser()
    if (!user) {
        return {
            ok: false,
            response: businessOsError("UNAUTHORIZED", "Sign in to read Business OS blueprints"),
        }
    }

    const profile = user.profiles[0]
    if (!profile) {
        return {
            ok: false,
            response: businessOsError("FORBIDDEN", "This account has no profile yet"),
        }
    }

    if (!hasSurface(profile.roleTemplate, "businessOs", extrasOf(profile))) {
        return {
            ok: false,
            response: businessOsError("FORBIDDEN", "This profile does not have the Business OS surface"),
        }
    }

    return { ok: true }
}
