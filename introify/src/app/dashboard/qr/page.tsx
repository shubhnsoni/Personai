import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelQrStudio } from "@/components/dashboard/hotel-qr-studio"

export const dynamic = "force-dynamic"

export default async function HotelQrPage() {
    const { profile } = await requireHotelPage("qr")
    const h = await headers()
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const qrs = await prisma.hotelQr.findMany({
        where: { profileId: profile.id },
        include: { room: { select: { number: true } } },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    })
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="QR & Print" hint="Vector QR kit with a quiet zone. Test each code before print. CMYK and crop marks can follow." />
            <HotelQrStudio
                slug={profile.slug}
                origin={`${proto}://${host}`}
                qrs={qrs.map((row) => ({
                    id: row.id,
                    code: row.code,
                    kind: row.kind,
                    label: row.label,
                    scanCount: row.scanCount,
                    room: row.room,
                }))}
            />
        </div>
    )
}
