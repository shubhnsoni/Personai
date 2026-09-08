import {
  createFakeTenantContext,
  InMemoryTenantBoundary,
  tenantResultResponse,
} from "../../src/lib/testing/auth-fakes"

const failures: string[] = []

function check(name: string, condition: boolean): void {
  if (!condition) failures.push(name)
}

async function main() {
  const boundary = new InMemoryTenantBoundary([
    { id: "record-a", tenantId: "tenant-a", value: { title: "A only" } },
    { id: "record-b", tenantId: "tenant-b", value: { title: "B only" } },
  ])
  const tenantA = createFakeTenantContext("tenant-a")
  const tenantB = createFakeTenantContext("tenant-b")

  const ownRead = boundary.read(tenantA(), "record-a")
  check("same-tenant read succeeds", ownRead.ok && ownRead.value.tenantId === "tenant-a")

  // No caller-supplied filter is accepted: the boundary derives tenant scope from context.
  const crossTenantRead = boundary.read(tenantA(), "record-b")
  const crossTenantReadResponse = tenantResultResponse(crossTenantRead)
  const invert = process.env.INVERT_ASSERTION === "1"
  check(
    "cross-tenant read is refused by default at the server boundary",
    invert
      ? crossTenantReadResponse.status !== 403
      : crossTenantReadResponse.status === 403 && (await crossTenantReadResponse.json() as { error?: { code?: string } }).error?.code === "FORBIDDEN",
  )

  const crossTenantWrite = boundary.write(tenantA(), {
    id: "record-b",
    value: { title: "attempted overwrite" },
  })
  check("cross-tenant write is refused without a caller filter", !crossTenantWrite.ok && crossTenantWrite.code === "FORBIDDEN")

  const forgedTenantWrite = boundary.write(tenantA(), {
    id: "new-record",
    tenantId: "tenant-b",
    value: { title: "forged tenant" },
  })
  check("caller cannot forge a different tenant on write", !forgedTenantWrite.ok && forgedTenantWrite.code === "FORBIDDEN")

  const tenantBStillOwnsRecord = boundary.read(tenantB(), "record-b")
  check(
    "refused cross-tenant write does not mutate the foreign record",
    tenantBStillOwnsRecord.ok && tenantBStillOwnsRecord.value.value.title === "B only",
  )

  console.log(JSON.stringify({
    result: failures.length === 0 ? "PASS" : "FAIL",
    assertions: [
      "same-tenant read succeeds",
      "cross-tenant read defaults to FORBIDDEN",
      "cross-tenant write defaults to FORBIDDEN",
      "forged tenant identifier is refused",
      "foreign record remains unchanged",
    ],
    failures,
  }, null, 2))
  if (failures.length > 0) process.exitCode = 1
}

void main()
