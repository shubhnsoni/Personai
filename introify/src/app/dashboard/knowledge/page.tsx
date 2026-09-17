import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { prisma } from "@/lib/prisma"
import { isHotelRole } from "@/lib/hotels"
import { DEFAULT_HOTEL_SLA_MINUTES, DEFAULT_HOTEL_UPSELLS, parseHotelMapMarkers } from "@/lib/hotels"
import { parseHotelSlaJson } from "@/lib/hotels/analytics"
import { parseHotelUpsells } from "@/lib/hotels/upsells"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelKnowledgeStudio } from "@/components/dashboard/hotel-knowledge-studio"

export const dynamic = "force-dynamic"

export default async function HotelKnowledgePage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")
    const [docs, property] = await Promise.all([
        prisma.hotelKnowledge.findMany({
            where: { profileId: profile.id },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.hotelProperty.findUnique({ where: { profileId: profile.id } }),
    ])
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Knowledge" hint="Guest-visible vs staff-only. Map markers, SLA minutes, and upsell prompts — never a charge." />
            <HotelKnowledgeStudio
                docs={docs.map((row) => ({
                    id: row.id,
                    bucket: row.bucket,
                    title: row.title,
                    body: row.body,
                    guestVisible: row.guestVisible,
                }))}
                mapImageUrl={property?.mapImageUrl || null}
                markers={parseHotelMapMarkers(property?.mapMarkersJson)}
                sla={property ? parseHotelSlaJson(property.slaJson) : DEFAULT_HOTEL_SLA_MINUTES}
                upsells={property ? parseHotelUpsells(property.upsellsJson) : DEFAULT_HOTEL_UPSELLS}
            />
        </div>
    )
}
