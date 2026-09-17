import Link from "@/components/navigation/transition-link"
import { StudioKpi, StudioKpiStrip, StudioPageHead, StudioPanel } from "@/components/dashboard/studio-ui"
import { HotelSetupForm } from "@/components/dashboard/hotel-setup-form"
import { HotelNotices } from "@/components/dashboard/hotel-notices"
import { HOTEL_SERVICE_OPTIONS } from "@/lib/hotels"

function parseList(raw: string | null | undefined) {
    try {
        const value = JSON.parse(raw || "[]")
        return Array.isArray(value) ? value.filter((item) => typeof item === "string") as string[] : []
    } catch {
        return []
    }
}

export function HotelHome({
    name,
    slug,
    origin,
    property,
    rooms,
    openRequests,
    restaurants,
    qrs,
    notices,
}: {
    name: string
    slug: string
    origin: string
    property: {
        address: string | null
        receptionPhone: string | null
        receptionWhatsapp: string | null
        checkInTime: string
        checkOutTime: string
        wifiName: string | null
        wifiPassword: string | null
        emergencyContact: string | null
        policiesSummary: string | null
        servicesJson: string
        amenitiesJson: string
        quietHours: string | null
        parkingInfo: string | null
        propertyHours: string | null
    } | null
    rooms: number
    openRequests: number
    restaurants: number
    qrs: number
    notices: Array<{ id: string; kind: string; title: string; body: string; readAt: string | null; createdAt: string }>
}) {
    const live = `${origin.replace(/\/$/, "")}/${slug}`
    const services = parseList(property?.servicesJson)
    const checklist = [
        { ok: rooms > 0, label: "Rooms connected", href: "/dashboard/rooms" },
        { ok: restaurants > 0, label: "Restaurants connected", href: "/dashboard/restaurants" },
        { ok: services.length > 0, label: "Hotel services", href: "/dashboard" },
        { ok: qrs > 0, label: "Room QRs", href: "/dashboard/qr" },
        { ok: true, label: "Guest concierge ready", href: live },
    ]

    return (
        <div className="space-y-4 lg:space-y-5">
            <StudioPageHead
                kicker="Hotel"
                title={name}
                hint="Scan a QR, ask the concierge, staff closes the ticket."
                action={
                    <Link href={live} target="_blank" className="inline-flex h-11 min-h-11 items-center rounded-full bg-[#00D7FF] px-4 text-sm font-medium text-[#061018] transition-transform duration-150 active:scale-[0.96]">
                        Open concierge
                    </Link>
                }
            />
            <HotelNotices notices={notices} />
            <StudioKpiStrip columns={4}>
                <StudioKpi title="Open requests" value={openRequests} href="/dashboard/requests" hot={openRequests > 0} />
                <StudioKpi title="Rooms" value={rooms} href="/dashboard/rooms" />
                <StudioKpi title="Restaurants" value={restaurants} href="/dashboard/restaurants" />
                <StudioKpi title="QR codes" value={qrs} href="/dashboard/qr" />
            </StudioKpiStrip>
            <StudioPanel>
                <div className="grid gap-0 sm:grid-cols-5">
                    {checklist.map((item) => (
                        <Link key={item.label} href={item.href} className="min-h-12 px-4 py-3 transition-colors hover:bg-white/4">
                            <p className="text-[11px] text-muted-foreground">{item.ok ? "Ready" : "Next"}</p>
                            <p className="text-sm font-medium">{item.label}</p>
                        </Link>
                    ))}
                </div>
            </StudioPanel>
            <StudioPanel className="p-4 md:p-5">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">Property</p>
                <HotelSetupForm
                    initial={{
                        address: property?.address || "",
                        receptionPhone: property?.receptionPhone || "",
                        receptionWhatsapp: property?.receptionWhatsapp || "",
                        checkInTime: property?.checkInTime || "14:00",
                        checkOutTime: property?.checkOutTime || "11:00",
                        wifiName: property?.wifiName || "",
                        wifiPassword: property?.wifiPassword || "",
                        emergencyContact: property?.emergencyContact || "",
                        policiesSummary: property?.policiesSummary || "",
                        services: services.length ? services : HOTEL_SERVICE_OPTIONS.filter((item) => ["restaurant", "housekeeping", "concierge"].includes(item.id)).map((item) => item.id),
                        amenities: parseList(property?.amenitiesJson),
                        quietHours: property?.quietHours || "",
                        parkingInfo: property?.parkingInfo || "",
                        propertyHours: property?.propertyHours || "",
                    }}
                />
            </StudioPanel>
        </div>
    )
}
