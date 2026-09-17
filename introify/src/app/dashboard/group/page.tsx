import { requireHotelPage } from "@/lib/hotels/desk-access"
import { isHotelRole, listHotelGroupMembers, parseHotelGroupJson } from "@/lib/hotels"
import { prisma } from "@/lib/prisma"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelGroupStudio } from "@/components/dashboard/hotel-group-studio"

export const dynamic = "force-dynamic"

export default async function HotelGroupPage() {
    const { profile, property, canWrite } = await requireHotelPage("group")
    const group = parseHotelGroupJson(property?.groupJson)
    const hotels = profile.billingAccountId
        ? await prisma.profile.findMany({
            where: { billingAccountId: profile.billingAccountId },
            select: { id: true, slug: true, displayName: true, roleTemplate: true },
            orderBy: { displayName: "asc" },
        })
        : [{ id: profile.id, slug: profile.slug, displayName: profile.displayName, roleTemplate: profile.roleTemplate }]
    const members = listHotelGroupMembers(group, hotels.filter((row) => isHotelRole(row.roleTemplate)))
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Hotel group" hint="Corporate list of hotel profiles on this account. Departments stay on each property." />
            <HotelGroupStudio
                name={group.name || "Hotel group"}
                hotels={hotels.filter((row) => isHotelRole(row.roleTemplate)).map((row) => ({ id: row.id, slug: row.slug, displayName: row.displayName }))}
                selectedIds={members.map((row) => row.id)}
                canWrite={canWrite}
            />
        </div>
    )
}
