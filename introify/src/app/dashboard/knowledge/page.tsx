import { prisma } from "@/lib/prisma"
import { DEFAULT_HOTEL_SLA_MINUTES, DEFAULT_HOTEL_UPSELLS, parseHotelMapMarkers } from "@/lib/hotels"
import { parseHotelSlaJson } from "@/lib/hotels/analytics"
import { parseHotelUpsells } from "@/lib/hotels/upsells"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelKnowledgeStudio } from "@/components/dashboard/hotel-knowledge-studio"

export const dynamic = "force-dynamic"

export default async function HotelKnowledgePage() {
    const { profile, property, canWrite } = await requireHotelPage("knowledge")
    const docs = await prisma.hotelKnowledge.findMany({
        where: { profileId: profile.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Knowledge" hint={canWrite ? "Guest-visible vs staff-only. Map markers, SLA minutes, and upsell prompts — never a charge." : "Read-only for this desk."} />
            <HotelKnowledgeStudio
                readOnly={!canWrite}
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
