import Link from "next/link"
import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"

export const dynamic = "force-dynamic"

export default async function TrustPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    return (
        <div className="w-page">
            <h1 className="w-h1">Trust</h1>
            <p className="w-lede">Introify does not invent badges. Maturity is completed jobs, not XP. There is no “Introify Tested” mark until a testing process exists.</p>
            <div className="w-trust-grid">
                <div className="w-trust-hero">
                    <h2>What visitors can see</h2>
                    <p>Active-for, completed jobs, and a restrained maturity label on showcase AIs. Refunds pull ranking down. Vanity scores stay out.</p>
                </div>
            </div>
            <Link href="/workspace/explore" className="w-btn">See explore</Link>
        </div>
    )
}
