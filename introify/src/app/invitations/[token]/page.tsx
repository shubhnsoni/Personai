import Link from "next/link"
import { syncUser } from "@/lib/auth-sync"
import { AcceptInvitation } from "@/components/dashboard/accept-invitation"

export const metadata = { title: "Join a team | Introify", robots: { index: false, follow: false } }

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const user = await syncUser()
    return <main className="mx-auto max-w-lg space-y-5 px-5 py-20"><h1 className="text-3xl font-semibold">Join your team on Introify</h1><p className="text-muted-foreground">Accept with the verified email address your account owner invited. You will use your own login.</p>{user ? <AcceptInvitation token={token} /> : <Link className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground" href={`/sign-in?redirect_url=${encodeURIComponent(`/invitations/${token}`)}`}>Sign in to accept</Link>}</main>
}
