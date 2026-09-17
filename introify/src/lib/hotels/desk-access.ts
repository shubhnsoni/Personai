import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "./role"
import {
    hotelCanOpen,
    hotelCanWrite,
    parseHotelStaffJson,
    resolveHotelStaffRole,
    type HotelDeskSurface,
    type HotelStaffRole,
} from "./staff"

export async function loadHotelStaffRole(input: {
    userId: string
    profileId: string
    profileUserId: string
    workspaceRole?: string | null
    owner?: boolean
    staffJson?: string | null
}): Promise<HotelStaffRole> {
    return resolveHotelStaffRole({
        userId: input.userId,
        profileUserId: input.profileUserId,
        workspaceRole: input.workspaceRole,
        owner: input.owner,
        assignments: parseHotelStaffJson(input.staffJson),
    })
}

export async function requireHotelPage(surface: HotelDeskSurface) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")
    const access = user.profileAccess[profile.id]
    const property = await prisma.hotelProperty.findUnique({ where: { profileId: profile.id } })
    const staffRole = await loadHotelStaffRole({
        userId: user.id,
        profileId: profile.id,
        profileUserId: profile.userId,
        workspaceRole: access?.role,
        owner: access?.owner,
        staffJson: property?.staffJson,
    })
    if (!hotelCanOpen(staffRole, surface)) redirect("/dashboard")
    return { user, profile, staffRole, property, canWrite: hotelCanWrite(staffRole, surface) }
}
