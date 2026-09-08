import type { PrismaClient } from "@prisma/client"

import {
    asLocationId,
    asMembershipId,
    asWorkspaceId,
    hasPermission,
    type PermissionKey,
    type TenantScope,
} from "@/lib/tenancy"

import { PersistenceError } from "./errors"

export interface PlatformIdentity {
    userId(): Promise<string | null>
}

export type PlatformAccess = Readonly<{
    userId: string
    membershipId: string
    workspaceId: string
    locationId: string | null
    role: string
    scope: TenantScope
}>

export type WorkspaceSummary = Readonly<{
    id: string
    profileId: string | null
    name: string
    slug: string
    role: string
    locationIds: readonly string[]
}>

export class PersistedTenancy {
    constructor(
        private readonly db: PrismaClient,
        private readonly identity: PlatformIdentity,
    ) {}

    async listWorkspaces(): Promise<readonly WorkspaceSummary[]> {
        const clerkUserId = await this.requireSignedInUserId()
        const user = await this.db.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
        if (!user) throw new PersistenceError("FORBIDDEN", "This account is not provisioned for platform access")

        const memberships = await this.db.membership.findMany({
            where: { userId: user.id },
            include: {
                workspace: { select: { id: true, profileId: true, name: true, slug: true } },
                membershipLocations: { select: { locationId: true } },
            },
            orderBy: [{ workspace: { name: "asc" } }, { id: "asc" }],
        })

        return memberships.map((membership) => Object.freeze({
            id: membership.workspace.id,
            profileId: membership.workspace.profileId,
            name: membership.workspace.name,
            slug: membership.workspace.slug,
            role: membership.role,
            locationIds: Object.freeze(membership.membershipLocations.map((link) => link.locationId).sort()),
        }))
    }

    async requireAccess(
        workspaceId: string,
        permission: PermissionKey,
        locationId: string | null = null,
    ): Promise<PlatformAccess> {
        const normalizedWorkspaceId = workspaceId.trim()
        if (!normalizedWorkspaceId) throw new PersistenceError("BAD_REQUEST", "workspaceId is required")

        const clerkUserId = await this.requireSignedInUserId()
        const user = await this.db.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
        if (!user) throw new PersistenceError("FORBIDDEN", "This account is not provisioned for platform access")

        const membership = await this.db.membership.findUnique({
            where: { workspaceId_userId: { workspaceId: normalizedWorkspaceId, userId: user.id } },
            include: { membershipLocations: { select: { locationId: true } } },
        })
        if (!membership) throw new PersistenceError("FORBIDDEN", "Workspace access is forbidden")
        if (!hasPermission(membership.role, permission)) {
            throw new PersistenceError("FORBIDDEN", `Permission ${permission} is required`)
        }

        const normalizedLocationId = locationId?.trim() || null
        const allowedLocations = membership.membershipLocations.map((link) => link.locationId)
        if (!normalizedLocationId && allowedLocations.length > 0) {
            throw new PersistenceError("FORBIDDEN", "A location is required for this membership")
        }
        if (normalizedLocationId && allowedLocations.length > 0 && !allowedLocations.includes(normalizedLocationId)) {
            throw new PersistenceError("FORBIDDEN", "Location access is forbidden")
        }

        return Object.freeze({
            userId: user.id,
            membershipId: membership.id,
            workspaceId: normalizedWorkspaceId,
            locationId: normalizedLocationId,
            role: membership.role,
            scope: Object.freeze({
                workspaceId: asWorkspaceId(normalizedWorkspaceId),
                locationId: normalizedLocationId ? asLocationId(normalizedLocationId) : null,
                actorMembershipId: asMembershipId(membership.id),
            }),
        })
    }

    private async requireSignedInUserId(): Promise<string> {
        const userId = await this.identity.userId()
        if (!userId) throw new PersistenceError("UNAUTHORIZED", "Sign in to access platform data")
        return userId
    }
}
