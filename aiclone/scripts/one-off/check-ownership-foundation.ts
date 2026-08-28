import {
  createOwnershipFoundation,
  ownershipRefusalResponse,
  toOwnershipActionFailure,
  type OwnershipResult,
  type SecurityProfile,
  type SecurityUser,
  type ServerIdentitySource,
} from "../../src/lib/security/ownership"

type TestProfile = SecurityProfile & Readonly<{
  role: "OWNER" | "VIEWER" | "UNKNOWN"
}>

type TestResource = Readonly<{
  id: string
  profileId: string
  value: string
}>

const failures: string[] = []
const checks: string[] = []
const invert = process.env.INVERT_ASSERTION === "1"

function check(name: string, condition: unknown, central = false): void {
  checks.push(name)
  const passed = central && invert ? !condition : Boolean(condition)
  if (!passed) failures.push(name)
}

function refusalOf<Value>(result: OwnershipResult<Value>) {
  if (result.ok) throw new Error("Expected refusal")
  return result.refusal
}

class MutableIdentity implements ServerIdentitySource<TestProfile> {
  current: SecurityUser<TestProfile> | null = null

  async resolve(): Promise<SecurityUser<TestProfile> | null> {
    return this.current
  }
}

async function responseSnapshot<Value>(result: OwnershipResult<Value>) {
  const response = ownershipRefusalResponse(refusalOf(result))
  return Object.freeze({ status: response.status, body: await response.text() })
}

async function main(): Promise<void> {
  const identity = new MutableIdentity()
  const foundation = createOwnershipFoundation(identity)
  const resources = new Map<string, TestResource>([
    ["document-a", { id: "document-a", profileId: "profile-a", value: "owner value" }],
    ["document-b", { id: "document-b", profileId: "profile-b", value: "foreign value" }],
  ])
  let lookupCalls = 0
  let writeCalls = 0

  const findOwned = async ({ resourceId, profile }: { resourceId: string; profile: TestProfile }) => {
    lookupCalls += 1
    const resource = resources.get(resourceId)
    return resource?.profileId === profile.id ? resource : null
  }
  const writeOwned = async ({ resourceId, profile }: { resourceId: string; profile: TestProfile }) => {
    writeCalls += 1
    const resource = resources.get(resourceId)
    if (!resource || resource.profileId !== profile.id) return null
    const updated = Object.freeze({ ...resource, value: "updated by owner" })
    resources.set(resourceId, updated)
    return updated
  }

  const anonymous = await foundation.requireOwnedResource({ resourceId: "document-a", findOwned })
  check("anonymous request is refused with 401 UNAUTHORIZED", !anonymous.ok
    && anonymous.refusal.status === 401 && anonymous.refusal.code === "UNAUTHORIZED", true)
  check("anonymous refusal performs no lookup or write", lookupCalls === 0 && writeCalls === 0)

  identity.current = Object.freeze({
    id: "user-a",
    profiles: Object.freeze([{ id: "profile-a", role: "OWNER" } satisfies TestProfile]),
  })

  const wrongTenantProfile = await foundation.requireOwnedResource({
    resourceId: "document-b",
    claimedProfileId: "profile-b",
    findOwned,
  })
  check("caller-supplied foreign profile is refused", !wrongTenantProfile.ok
    && wrongTenantProfile.refusal.status === 403)
  check("wrong-profile refusal performs no resource lookup or write", lookupCalls === 0 && writeCalls === 0)

  const wrongEntitlement = await foundation.executeOwnedResourceWrite({
    resourceId: "document-a",
    entitlement: (profile) => profile.role === "VIEWER",
    writeOwned,
  })
  check("authenticated wrong entitlement is refused with 403 FORBIDDEN", !wrongEntitlement.ok
    && wrongEntitlement.refusal.status === 403 && wrongEntitlement.refusal.code === "FORBIDDEN")
  check("wrong-entitlement refusal performs no write", writeCalls === 0
    && resources.get("document-a")?.value === "owner value")

  const ownRead = await foundation.requireOwnedResource({ resourceId: "document-a", findOwned })
  check("valid owner read succeeds", ownRead.ok && ownRead.value.resource.id === "document-a")

  const foreignRead = await foundation.requireOwnedResource({ resourceId: "document-b", findOwned })
  const missingRead = await foundation.requireOwnedResource({ resourceId: "document-missing", findOwned })
  const foreignSnapshot = await responseSnapshot(foreignRead)
  const missingSnapshot = await responseSnapshot(missingRead)
  check("wrong-tenant and missing resource API refusals are byte-identical",
    JSON.stringify(foreignSnapshot) === JSON.stringify(missingSnapshot))
  check("wrong-tenant and missing action refusals are byte-identical",
    JSON.stringify(toOwnershipActionFailure(refusalOf(foreignRead)))
      === JSON.stringify(toOwnershipActionFailure(refusalOf(missingRead))))
  check("wrong-tenant and missing both use the same composite lookup path", lookupCalls === 3)

  const beforeForeignWrite = resources.get("document-b")
  const refusedWrite = await foundation.executeOwnedResourceWrite({
    resourceId: "document-b",
    writeOwned,
  })
  check("wrong-tenant write is refused", !refusedWrite.ok && refusedWrite.refusal.status === 403)
  check("refused write has no effect", resources.get("document-b") === beforeForeignWrite)

  const ownWrite = await foundation.executeOwnedResourceWrite({
    resourceId: "document-a",
    writeOwned,
  })
  check("valid owner write succeeds", ownWrite.ok
    && resources.get("document-a")?.value === "updated by owner")

  const forgedCallerIdentity = await foundation.requireOwnedProfile({
    claimedProfileId: "profile-a",
    callerSuppliedUserId: "user-b",
  } as { claimedProfileId: string; callerSuppliedUserId: string })
  check("caller-supplied user id is never honoured as identity", forgedCallerIdentity.ok
    && forgedCallerIdentity.value.actor.userId === "user-a")

  identity.current = Object.freeze({ id: "", profiles: Object.freeze([]) })
  const emptyIdentity = await foundation.requireAuthenticatedUser()
  check("empty server identity fails closed", !emptyIdentity.ok && emptyIdentity.refusal.status === 401)

  identity.current = Object.freeze({
    id: "user-a",
    profiles: Object.freeze([{ id: " profile-a", role: "OWNER" } satisfies TestProfile]),
  })
  const malformedProfile = await foundation.requireOwnedProfile()
  check("malformed owned profile identity fails closed", !malformedProfile.ok
    && malformedProfile.refusal.status === 403)

  console.log(JSON.stringify({
    result: failures.length === 0 ? "PASS" : "FAIL",
    assertions: checks.length,
    coverage: [
      "anonymous refusal",
      "wrong-tenant and wrong-entitlement refusal",
      "owner read/write success",
      "no side effects on refusal",
      "non-enumerating resource lookup",
      "server-derived identity only",
      "malformed identity fail-closed behavior",
    ],
    failures,
  }, null, 2))

  if (failures.length > 0) process.exitCode = 1
}

void main()
