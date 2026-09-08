import type { LocationId, TenantOwned, TenantScope, WorkspaceId } from "./types"

declare const requiredTenantScopeBrand: unique symbol
declare const auditedTenantBypassBrand: unique symbol

export type RequiredTenantScope = TenantScope & {
    readonly [requiredTenantScopeBrand]: true
}

export type TenantTarget = Readonly<{
    workspaceId: WorkspaceId
    locationId?: LocationId | null
}>

export type TenantScopeErrorCode = "MISSING_SCOPE" | "INVALID_TARGET" | "CROSS_TENANT" | "CROSS_LOCATION"

export class TenantScopeError extends Error {
    readonly code: TenantScopeErrorCode

    constructor(code: TenantScopeErrorCode, message: string) {
        super(message)
        this.name = "TenantScopeError"
        this.code = code
    }
}

/**
 * Converts an actor scope into the branded capability required by scoped readers.
 * A location-bound actor cannot widen itself to workspace-wide or another location.
 */
export function requireTenantScope(
    actorScope: TenantScope | null | undefined,
    target: TenantTarget,
): RequiredTenantScope {
    if (!actorScope) throw new TenantScopeError("MISSING_SCOPE", "A tenant scope is required")
    if (!target.workspaceId) throw new TenantScopeError("INVALID_TARGET", "A target workspace is required")
    if (actorScope.workspaceId !== target.workspaceId) {
        throw new TenantScopeError("CROSS_TENANT", "Cross-workspace access was refused")
    }

    const requestedLocation = target.locationId ?? actorScope.locationId
    if (actorScope.locationId !== null && requestedLocation !== actorScope.locationId) {
        throw new TenantScopeError("CROSS_LOCATION", "Cross-location access was refused")
    }

    return Object.freeze({
        workspaceId: actorScope.workspaceId,
        locationId: requestedLocation,
        actorMembershipId: actorScope.actorMembershipId,
    }) as RequiredTenantScope
}

export function withTenantScope<Result>(
    actorScope: TenantScope | null | undefined,
    target: TenantTarget,
    operation: (scope: RequiredTenantScope) => Result,
): Result {
    return operation(requireTenantScope(actorScope, target))
}

/** The branded RequiredTenantScope parameter prevents accidental unscoped use. */
export function selectTenantRows<Row extends TenantOwned>(
    scope: RequiredTenantScope,
    rows: readonly Row[],
): readonly Row[] {
    return rows.filter((row) =>
        row.workspaceId === scope.workspaceId
        && (scope.locationId === null || row.locationId === scope.locationId),
    )
}

export type TenantBypassRequest = Readonly<{
    actorId: string
    reason: string
    ticket: string
    at: string
}>

export type TenantBypassAuditEvent = Readonly<TenantBypassRequest & {
    action: "tenant.read.bypass"
}>

export type TenantAuditSink = (event: TenantBypassAuditEvent) => void

export type AuditedTenantBypass = Readonly<TenantBypassRequest> & {
    readonly [auditedTenantBypassBrand]: true
}

/** The sole cross-tenant escape hatch; construction synchronously emits an audit event. */
export function createAuditedTenantBypass(
    request: TenantBypassRequest,
    audit: TenantAuditSink,
): AuditedTenantBypass {
    const actorId = request.actorId.trim()
    const reason = request.reason.trim()
    const ticket = request.ticket.trim()
    const at = request.at.trim()
    if (!actorId || !reason || !ticket || !at || Number.isNaN(Date.parse(at))) {
        throw new TenantScopeError(
            "INVALID_TARGET",
            "Tenant bypass requires actorId, reason, ticket, and an ISO-compatible timestamp",
        )
    }

    const bypass = Object.freeze({ actorId, reason, ticket, at }) as AuditedTenantBypass
    audit(Object.freeze({ ...bypass, action: "tenant.read.bypass" }))
    return bypass
}

/** Deliberately named, separately branded, and unavailable without a synchronous audit. */
export function readAcrossTenants<Row>(
    bypass: AuditedTenantBypass,
    rows: readonly Row[],
): readonly Row[] {
    void bypass
    return Object.freeze([...rows])
}
