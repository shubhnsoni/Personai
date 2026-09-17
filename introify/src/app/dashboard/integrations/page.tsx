import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelIntegrationsStudio } from "@/components/dashboard/hotel-integrations-studio"

export const dynamic = "force-dynamic"

export default async function HotelIntegrationsPage() {
    const { property, canWrite } = await requireHotelPage("integrations")
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Integrations" hint="PMS, POS, and WhatsApp are adapter stubs. No vendor keys. Optional HTTPS webhook placeholder." />
            <HotelIntegrationsStudio webhookUrl={property?.webhookUrl || null} canWrite={canWrite} />
        </div>
    )
}
