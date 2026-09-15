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
            <p className="w-kicker">Public page</p>
            <h1 className="w-h1">Profile showcase</h1>
            <p className="w-lede">Choose which SHOWCASE AIs appear on your public Introify page. Private AIs stay off the profile.</p>
            <p><Link className="w-ghost" href={`/${slug}`}>Preview {`introify.com/${slug}`}</Link></p>
            <ShowcaseToggles items={items.map((item) => ({ id: item.id, name: item.name, purpose: item.purpose, visibility: item.visibility }))} />
        </div>
    )
}
