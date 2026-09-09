"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { acceptTeamInvitation } from "@/app/actions/billing-team"

export function AcceptInvitation({ token }: { token: string }) {
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const router = useRouter()
    return <div><button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" onClick={() => startTransition(async () => {
        try { await acceptTeamInvitation(token); router.push("/dashboard/team"); router.refresh() }
        catch (error) { setError(error instanceof Error ? error.message : "Could not accept invitation.") }
    })}>{pending ? "Joining…" : "Accept invitation"}</button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>
}
