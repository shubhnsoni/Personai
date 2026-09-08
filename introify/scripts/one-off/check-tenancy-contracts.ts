import {
    adaptBookingRow,
    adaptOrderRow,
    adaptProfileRow,
    asMembershipId,
    asWorkspaceId,
    createAuditedTenantBypass,
    KNOWN_ROLES,
    readAcrossTenants,
    requireTenantScope,
    resolveRolePermissions,
    ROLE_PERMISSION_MATRIX,
    selectTenantRows,
    TenantScopeError,
    withTenantScope,
    type TenantBypassAuditEvent,
    type TenantScope,
} from "../../src/lib/tenancy"

const failures: string[] = []
const checks: string[] = []

function check(name: string, condition: unknown): void {
    checks.push(name)
    if (!condition) failures.push(name)
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
    return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
}

for (const deniedInput of ["UNKNOWN", null, "", "   ", undefined]) {
    const resolution = resolveRolePermissions(deniedInput)
    check(`deny-by-default:${String(deniedInput)}`, resolution.deniedByDefault)
    check(`empty-closure:${String(deniedInput)}`, resolution.permissions.length === 0)
    check(`no-role:${String(deniedInput)}`, resolution.role === null)
}

for (const role of KNOWN_ROLES) {
    const resolution = resolveRolePermissions(role.toLowerCase())
    check(`known-role:${role}`, resolution.role === role && !resolution.deniedByDefault)
    check(`permission-closure:${role}`, sameStrings(resolution.permissions, ROLE_PERMISSION_MATRIX[role]))
}

const workspaceA = asWorkspaceId("workspace-a")
const workspaceB = asWorkspaceId("workspace-b")
const actorScope: TenantScope = Object.freeze({
    workspaceId: workspaceA,
    locationId: null,
    actorMembershipId: asMembershipId("membership-a"),
})

let crossTenantCode: string | null = null
try {
    requireTenantScope(actorScope, { workspaceId: workspaceB })
} catch (error) {
    if (error instanceof TenantScopeError) crossTenantCode = error.code
}
check("cross-tenant-read-refused", crossTenantCode === "CROSS_TENANT")

const tenantRows = [
    { id: "a", workspaceId: workspaceA, locationId: null },
    { id: "b", workspaceId: workspaceB, locationId: null },
] as const
const visible = withTenantScope(actorScope, { workspaceId: workspaceA }, (scope) =>
    selectTenantRows(scope, tenantRows),
)
check("scoped-read-only-returns-own-workspace", visible.length === 1 && visible[0]?.id === "a")

const auditEvents: TenantBypassAuditEvent[] = []
const bypass = createAuditedTenantBypass(
    {
        actorId: "support-user-1",
        reason: "Investigate a cross-workspace isolation alert",
        ticket: "SEC-101",
        at: "2026-08-27T12:00:00.000Z",
    },
    (event) => auditEvents.push(event),
)
const bypassRows = readAcrossTenants(bypass, tenantRows)
check("escape-hatch-is-cross-tenant", bypassRows.length === 2)
check("escape-hatch-is-audited", auditEvents.length === 1)
check("escape-hatch-audit-action", auditEvents[0]?.action === "tenant.read.bypass")
check("escape-hatch-audit-ticket", auditEvents[0]?.ticket === "SEC-101")

const profile = adaptProfileRow({
    id: "profile-1",
    userId: "user-1",
    slug: "ada",
    displayName: "Ada Studio",
})
const booking = adaptBookingRow({ id: "booking-1", profileId: "profile-1", serviceOfferingId: "service-1" })
const order = adaptOrderRow({ id: "order-1", profileId: "profile-1", number: 7 })
check("profile-adapter-workspace-key", profile.workspace.id === booking.workspaceId)
check("profile-adapter-default-location", profile.defaultLocation.id === booking.locationId)
check("order-adapter-workspace-key", order.workspaceId === profile.workspace.id)
check("profile-adapter-owner-membership", profile.ownerMembership.role === "OWNER")

const report = {
    result: failures.length === 0 ? "PASS" : "FAIL",
    checks: checks.length,
    failures,
    roles: Object.fromEntries(KNOWN_ROLES.map((role) => [role, ROLE_PERMISSION_MATRIX[role].length])),
    auditedBypasses: auditEvents.length,
}

console.log(JSON.stringify(report, null, 2))
if (failures.length > 0) process.exitCode = 1
