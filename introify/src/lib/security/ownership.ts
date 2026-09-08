export type OwnershipErrorCode = "UNAUTHORIZED" | "FORBIDDEN"

export type OwnershipRefusal = Readonly<{
  code: OwnershipErrorCode
  status: 401 | 403
  message: string
}>

export type OwnershipResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ ok: false; refusal: OwnershipRefusal }>

export type SecurityProfile = Readonly<{
  id: string
}>

export type SecurityUser<Profile extends SecurityProfile = SecurityProfile> = Readonly<{
  id: string
  profiles: readonly Profile[]
}>

export type AuthenticatedActor<Profile extends SecurityProfile = SecurityProfile> = Readonly<{
  userId: string
  profiles: readonly Profile[]
}>

export type OwnedProfile<Profile extends SecurityProfile = SecurityProfile> = Readonly<{
  actor: AuthenticatedActor<Profile>
  profile: Profile
}>

export interface ServerIdentitySource<Profile extends SecurityProfile = SecurityProfile> {
  resolve(): Promise<SecurityUser<Profile> | null>
}

export type OwnedProfileOptions<Profile extends SecurityProfile> = Readonly<{
  /** A caller value is only checked against the server-derived owned profiles. */
  claimedProfileId?: unknown
  entitlement?: (profile: Profile, actor: AuthenticatedActor<Profile>) => boolean | Promise<boolean>
}>

export type OwnedResourceScope<Profile extends SecurityProfile> = OwnedProfile<Profile> & Readonly<{
  resourceId: string
}>

export type OwnedResourceLookup<Profile extends SecurityProfile, Resource> =
  (scope: OwnedResourceScope<Profile>) => Promise<Resource | null>

export type OwnedResourceWrite<Profile extends SecurityProfile, Result> =
  (scope: OwnedResourceScope<Profile>) => Promise<Result | null>

export type OwnedResourceInput<Profile extends SecurityProfile, Resource> =
  OwnedProfileOptions<Profile> & Readonly<{
    resourceId: unknown
    /** Must perform one lookup constrained by both resourceId and profile.id. */
    findOwned: OwnedResourceLookup<Profile, Resource>
  }>

export type OwnedResourceWriteInput<Profile extends SecurityProfile, Result> =
  OwnedProfileOptions<Profile> & Readonly<{
    resourceId: unknown
    /** Must mutate with both resourceId and profile.id in the same database operation. */
    writeOwned: OwnedResourceWrite<Profile, Result>
  }>

export type OwnershipActionFailure = Readonly<{
  ok: false
  error: Readonly<{
    code: OwnershipErrorCode
    message: string
  }>
}>

const UNAUTHENTICATED: OwnershipRefusal = Object.freeze({
  code: "UNAUTHORIZED",
  status: 401,
  message: "Authentication required",
})

const ACCESS_DENIED: OwnershipRefusal = Object.freeze({
  code: "FORBIDDEN",
  status: 403,
  message: "Access denied",
})

function refuse<Value>(refusal: OwnershipRefusal): OwnershipResult<Value> {
  return Object.freeze({ ok: false, refusal })
}

function allow<Value>(value: Value): OwnershipResult<Value> {
  return Object.freeze({ ok: true, value })
}

/** Opaque ids are exact, bounded, non-blank strings without whitespace/control characters. */
function opaqueId(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 191) return null
  if (value.trim() !== value || /[\s\u0000-\u001f\u007f]/u.test(value)) return null
  return value
}

export function createOwnershipFoundation<Profile extends SecurityProfile>(
  identity: ServerIdentitySource<Profile>,
) {
  async function requireAuthenticatedUser(): Promise<OwnershipResult<AuthenticatedActor<Profile>>> {
    const user = await identity.resolve()
    if (!user || !opaqueId(user.id) || !Array.isArray(user.profiles)) {
      return refuse(UNAUTHENTICATED)
    }

    return allow(Object.freeze({
      userId: user.id,
      profiles: Object.freeze([...user.profiles]),
    }))
  }

  async function requireOwnedProfile(
    options: OwnedProfileOptions<Profile> = {},
  ): Promise<OwnershipResult<OwnedProfile<Profile>>> {
    const authenticated = await requireAuthenticatedUser()
    if (!authenticated.ok) return authenticated

    const { claimedProfileId, entitlement } = options
    const hasClaim = claimedProfileId !== undefined
    const normalizedClaim = hasClaim ? opaqueId(claimedProfileId) : null
    if (hasClaim && !normalizedClaim) return refuse(ACCESS_DENIED)

    const profile = normalizedClaim
      ? authenticated.value.profiles.find((candidate) => opaqueId(candidate.id) === normalizedClaim)
      : authenticated.value.profiles[0]

    if (!profile || !opaqueId(profile.id)) return refuse(ACCESS_DENIED)
    if (entitlement && !await entitlement(profile, authenticated.value)) return refuse(ACCESS_DENIED)

    return allow(Object.freeze({ actor: authenticated.value, profile }))
  }

  async function requireOwnedResource<Resource>(
    input: OwnedResourceInput<Profile, Resource>,
  ): Promise<OwnershipResult<Readonly<{ ownership: OwnedProfile<Profile>; resource: Resource }>>> {
    const ownership = await requireOwnedProfile(input)
    if (!ownership.ok) return ownership

    const resourceId = opaqueId(input.resourceId)
    if (!resourceId) return refuse(ACCESS_DENIED)

    const resource = await input.findOwned(Object.freeze({
      ...ownership.value,
      resourceId,
    }))
    if (resource === null) return refuse(ACCESS_DENIED)

    return allow(Object.freeze({ ownership: ownership.value, resource }))
  }

  async function executeOwnedResourceWrite<Result>(
    input: OwnedResourceWriteInput<Profile, Result>,
  ): Promise<OwnershipResult<Readonly<{ ownership: OwnedProfile<Profile>; result: Result }>>> {
    const ownership = await requireOwnedProfile(input)
    if (!ownership.ok) return ownership

    const resourceId = opaqueId(input.resourceId)
    if (!resourceId) return refuse(ACCESS_DENIED)

    const result = await input.writeOwned(Object.freeze({
      ...ownership.value,
      resourceId,
    }))
    if (result === null) return refuse(ACCESS_DENIED)

    return allow(Object.freeze({ ownership: ownership.value, result }))
  }

  return Object.freeze({
    requireAuthenticatedUser,
    requireOwnedProfile,
    requireOwnedResource,
    executeOwnedResourceWrite,
  })
}

export function toOwnershipActionFailure(refusal: OwnershipRefusal): OwnershipActionFailure {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code: refusal.code, message: refusal.message }),
  })
}

export function ownershipRefusalResponse(refusal: OwnershipRefusal): Response {
  return new Response(JSON.stringify(toOwnershipActionFailure(refusal)), {
    status: refusal.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

export class OwnershipRefusalError extends Error {
  readonly code: OwnershipErrorCode
  readonly status: 401 | 403

  constructor(refusal: OwnershipRefusal) {
    super(refusal.message)
    this.name = "OwnershipRefusalError"
    this.code = refusal.code
    this.status = refusal.status
  }
}

export function unwrapOwnershipResult<Value>(result: OwnershipResult<Value>): Value {
  if (!result.ok) throw new OwnershipRefusalError(result.refusal)
  return result.value
}
