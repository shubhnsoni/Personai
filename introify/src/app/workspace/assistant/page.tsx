import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { assistantItems } from "@/lib/workspace-market"

export const dynamic = "force-dynamic"

export default async function AssistantPage() {
    const user = await syncUser()
    if (!user?.activeProfile) redirect("/sign-in")
    const items = await assistantItems(user.activeProfile.id)

    return (
        <div className="w-page">
            <h1 className="w-h1">Introify Assistant</h1>
            <p className="w-lede">This is the system helper for connections, expired access, and approvals — not a marketplace skill.</p>
            <ul className="w-notes" style={{ marginTop: 24 }}>
                {items.map((item) => (
                    <li key={item.title}><b>{item.title}</b><p>{item.detail}</p></li>
                ))}
            </ul>
        </div>
    )
}
