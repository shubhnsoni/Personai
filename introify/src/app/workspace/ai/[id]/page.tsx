import { notFound, redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { getOwnedCreation } from "@/lib/creations"
import { CreationStudio } from "./creation-studio"

export const dynamic = "force-dynamic"

export default async function CreationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const { id } = await params
    const creation = await getOwnedCreation(user.activeProfile.id, id)
    if (!creation) notFound()
    return <CreationStudio creation={JSON.parse(JSON.stringify({ ...creation, profileSlug: user.activeProfile.slug }))} />
}
