"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createTeamInvitation, removeAccountMember, revokeTeamInvitation, type getTeamManagement } from "@/app/actions/billing-team"

type Team = Awaited<ReturnType<typeof getTeamManagement>>

export function TeamManager({ team }: { team: Team }) {
    const [pending, startTransition] = useTransition()
    const [invitationUrl, setInvitationUrl] = useState("")
    const router = useRouter()
    function perform(action: () => Promise<unknown>) {
        startTransition(async () => {
            try { await action(); router.refresh() }
            catch (error) { toast.error(error instanceof Error ? error.message : "Could not update the team.") }
        })
    }
    return <div className="space-y-7">
        <div><h1 className="text-2xl font-semibold">Businesses &amp; team</h1><p className="mt-2 text-sm text-muted-foreground">{team.name} · Up to {team.businessLimit} businesses and {team.seats} people. The same person across businesses uses one seat; pending invitations reserve a seat.</p></div>
        <section className="rounded-2xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Businesses</h2>{team.canManage && <Link className="text-sm underline underline-offset-4" href={`/onboarding?billingAccountId=${encodeURIComponent(team.accountId)}`}>Add a business</Link>}</div>
            <ul className="mt-3 space-y-2 text-sm">{team.workspaces.map((workspace) => <li key={workspace.id}>{workspace.name}</li>)}</ul>
        </section>
        {!team.canManage ? <p className="text-sm text-muted-foreground">Your account owner manages invitations and access. You can switch between the businesses you have access to above.</p> : <>
            <section className="rounded-2xl border p-5">
                <h2 className="font-semibold">Invite a colleague</h2>
                <p className="mt-1 text-sm text-muted-foreground">They sign in with their own verified email. Create a private link and share it with them.</p>
                <form className="mt-4 space-y-4" onSubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget)
                    perform(async () => {
                        const result = await createTeamInvitation({ accountId: team.accountId, email: String(form.get("email") || ""), workspaceIds: form.getAll("workspaceId").map(String), workspaceRole: String(form.get("workspaceRole")) as "ADMIN" | "MANAGER" | "STAFF" | "VIEWER", accountRole: form.get("accountRole") === "BILLING_ADMIN" ? "BILLING_ADMIN" : "MEMBER" })
                        setInvitationUrl(new URL(result.path, window.location.origin).href)
                    })
                }}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">Email<input className="rounded-lg border bg-background px-3 py-2" name="email" type="email" required maxLength={254} autoComplete="off" /></label>
                        <label className="grid gap-1 text-sm">Business role<select className="rounded-lg border bg-background px-3 py-2" name="workspaceRole" defaultValue="STAFF"><option value="VIEWER">Viewer — read only</option><option value="STAFF">Staff — inbox and operations</option><option value="MANAGER">Manager — content and operations</option><option value="ADMIN">Admin — business settings</option></select></label>
                        <label className="grid gap-1 text-sm">Account role<select className="rounded-lg border bg-background px-3 py-2" name="accountRole"><option value="MEMBER">Team member</option><option value="BILLING_ADMIN">Billing administrator</option></select></label>
                    </div>
                    <fieldset><legend className="mb-2 text-sm font-medium">Business access</legend><div className="grid gap-2 sm:grid-cols-2">{team.workspaces.map((workspace) => <label key={workspace.id} className="flex items-center gap-2 text-sm"><input name="workspaceId" type="checkbox" value={workspace.id} />{workspace.name}</label>)}</div><p className="mt-2 text-xs text-muted-foreground">Leave all unchecked for billing-only access.</p></fieldset>
                    <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={pending}>{pending ? "Saving…" : "Create invitation link"}</button>
                </form>
                {invitationUrl && <div className="mt-4 rounded-xl bg-muted p-3"><label className="grid gap-2 text-sm">Private invitation link<input readOnly value={invitationUrl} className="w-full min-w-0 rounded border bg-background p-2" onFocus={(event) => event.target.select()} /></label><button className="mt-2 text-sm underline" onClick={() => navigator.clipboard.writeText(invitationUrl).then(() => toast.success("Link copied")).catch(() => toast.error("Select the link to copy it."))}>Copy link</button></div>}
            </section>
            <section className="rounded-2xl border p-5"><h2 className="font-semibold">People</h2><ul className="mt-3 divide-y">{team.members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{member.name}</p><p className="break-all text-xs text-muted-foreground">{member.email} · {member.role.toLowerCase().replaceAll("_", " ")}</p></div>{member.userId !== team.ownerUserId && <button disabled={pending} className="text-sm text-destructive" onClick={() => { if (window.confirm(`Remove ${member.email} from all businesses in this account?`)) perform(() => removeAccountMember(team.accountId, member.userId)) }}>Remove access</button>}</li>)}</ul></section>
            {team.invitations.length > 0 && <section className="rounded-2xl border p-5"><h2 className="font-semibold">Pending invitations</h2><ul className="mt-3 divide-y">{team.invitations.map((invite) => <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={invite.id}><span className="break-all">{invite.email}</span><button disabled={pending} className="text-destructive" onClick={() => perform(() => revokeTeamInvitation(team.accountId, invite.id))}>Revoke</button></li>)}</ul></section>}
        </>}
    </div>
}
