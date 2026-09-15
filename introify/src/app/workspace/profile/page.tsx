import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { listCreations } from "@/lib/creations"
import { ShowcaseToggles } from "./showcase-toggles"

export const dynamic = "force-dynamic"

export default async function WorkspaceProfilePage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const items = await listCreations(user.activeProfile.id)
    const slug = user.activeProfile.slug

    return (
        <div className="w-page">
            <h1 className="w-h1">Profile showcase</h1>
            <p className="w-lede">Showcase AIs appear on your public page. Unlisted AIs stay off the page but work from a direct link.</p>
            <p><Link className="w-ghost" href={`/${slug}`}>Preview {`introify.com/${slug}`}</Link></p>
            <ShowcaseToggles items={items.map((item) => ({ id: item.id, name: item.name, purpose: item.purpose, visibility: item.visibility }))} />
        </div>
    )
}
