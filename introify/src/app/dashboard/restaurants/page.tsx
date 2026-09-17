import { listLinkedRestaurants } from "@/lib/hotels/store"
import { listStaffRestaurantChoices } from "@/app/actions/hotels"
import { requireHotelPage } from "@/lib/hotels/desk-access"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRestaurantsStudio } from "@/components/dashboard/hotel-restaurants-studio"

export const dynamic = "force-dynamic"

export default async function HotelRestaurantsPage() {
    const { profile } = await requireHotelPage("restaurants")
    const [linked, choices] = await Promise.all([
        listLinkedRestaurants(profile.id),
        listStaffRestaurantChoices(),
    ])
    return (
        <div className="space-y-4">
            <StudioPageHead kicker="Hotel" title="Restaurants" hint="Plug in kitchens you already run on Introify." />
            <HotelRestaurantsStudio linked={linked} choices={choices} />
        </div>
    )
}
