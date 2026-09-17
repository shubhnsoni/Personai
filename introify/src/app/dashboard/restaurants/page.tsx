import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { isHotelRole } from "@/lib/hotels"
import { listLinkedRestaurants } from "@/lib/hotels/store"
import { listStaffRestaurantChoices } from "@/app/actions/hotels"
import { StudioPageHead } from "@/components/dashboard/studio-ui"
import { HotelRestaurantsStudio } from "@/components/dashboard/hotel-restaurants-studio"

export const dynamic = "force-dynamic"

export default async function HotelRestaurantsPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")
    const profile = user.activeProfile
    if (!profile) redirect("/onboarding")
    if (!isHotelRole(profile.roleTemplate)) redirect("/dashboard")
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
