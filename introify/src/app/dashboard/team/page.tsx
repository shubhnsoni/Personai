import { getTeamManagement } from "@/app/actions/billing-team"
import { TeamManager } from "@/components/dashboard/team-manager"
import { HotelStaffStudio } from "@/components/dashboard/hotel-staff-studio"
import { syncUser } from "@/lib/auth-sync"
import { hotelCanOpen, hotelCanWrite, isHotelRole, parseHotelStaffJson } from "@/lib/hotels"
import { loadHotelStaffRole } from "@/lib/hotels/desk-access"
import { prisma } from "@/lib/prisma"

export default async function TeamPage() {
    const team = await getTeamManagement()
    const user = await syncUser()
    const profile = user?.activeProfile
    if (!user || !profile || !isHotelRole(profile.roleTemplate)) {
        return <TeamManager team={team} />
    }
    const property = await prisma.hotelProperty.findUnique({ where: { profileId: profile.id }, select: { staffJson: true } })
    const access = user.profileAccess[profile.id]
    const staffRole = await loadHotelStaffRole({
        userId: user.id,
        profileId: profile.id,
        profileUserId: profile.userId,
        workspaceRole: access?.role,
        owner: access?.owner,
        staffJson: property?.staffJson,
    })
    if (!hotelCanOpen(staffRole, "staff")) {
        return <TeamManager team={team} />
    }
    const members = team.members.length
        ? team.members.map((row) => ({ userId: row.userId, name: row.name, email: row.email }))
        : [{ userId: user.id, name: user.name || "You", email: user.email }]
    return (
        <div className="space-y-6">
            <TeamManager team={team} />
            <HotelStaffStudio
                members={members}
                assignments={parseHotelStaffJson(property?.staffJson)}
                canWrite={hotelCanWrite(staffRole, "staff")}
            />
        </div>
    )
}
