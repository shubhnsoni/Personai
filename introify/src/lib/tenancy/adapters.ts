import {
    asLocationId,
    asMembershipId,
    asWorkspaceId,
    type Location,
    type Membership,
    type TenantOwned,
    type Workspace,
    type WorkspaceId,
} from "./types"

export type LegacyProfileRow = Readonly<{
    id: string
    userId: string
    slug: string
    displayName: string
}>

export type LegacyBookingRow = Readonly<{
    id: string
    profileId: string
    serviceOfferingId: string
}>

export type LegacyOrderRow = Readonly<{
    id: string
    profileId: string
    number: number
}>

export type LegacyTenantProjection = Readonly<{
    workspace: Workspace
    defaultLocation: Location
    ownerMembership: Membership
}>

export type LegacyResourceProjection<Source extends "BOOKING" | "ORDER"> = TenantOwned & Readonly<{
    id: string
    source: Source
    legacyProfileId: string
}>

/** Profile.id remains the stable bridge key until an additive schema wave persists Workspace. */
export function workspaceIdFromProfileId(profileId: string): WorkspaceId {
    return asWorkspaceId(profileId)
}

/** Deterministic compatibility location; it is a projection and is never persisted by this module. */
export function defaultLocationIdFromProfileId(profileId: string) {
    return asLocationId(`legacy-profile:${profileId}:default`)
}

export function adaptProfileRow(profile: LegacyProfileRow): LegacyTenantProjection {
    const workspaceId = workspaceIdFromProfileId(profile.id)
    const locationId = defaultLocationIdFromProfileId(profile.id)

    return Object.freeze({
        workspace: Object.freeze({
            id: workspaceId,
            name: profile.displayName,
            legacyProfileId: profile.id,
        }),
        defaultLocation: Object.freeze({
            id: locationId,
            workspaceId,
            name: "Default",
            legacyProfileId: profile.id,
        }),
        ownerMembership: Object.freeze({
            id: asMembershipId(`legacy-profile:${profile.id}:user:${profile.userId}`),
            workspaceId,
            userId: profile.userId,
            role: "OWNER",
            locationIds: Object.freeze([locationId]),
        }),
    })
}

export function adaptBookingRow(booking: LegacyBookingRow): LegacyResourceProjection<"BOOKING"> {
    return Object.freeze({
        id: booking.id,
        source: "BOOKING",
        legacyProfileId: booking.profileId,
        workspaceId: workspaceIdFromProfileId(booking.profileId),
        locationId: defaultLocationIdFromProfileId(booking.profileId),
    })
}

export function adaptOrderRow(order: LegacyOrderRow): LegacyResourceProjection<"ORDER"> {
    return Object.freeze({
        id: order.id,
        source: "ORDER",
        legacyProfileId: order.profileId,
        workspaceId: workspaceIdFromProfileId(order.profileId),
        locationId: defaultLocationIdFromProfileId(order.profileId),
    })
}
