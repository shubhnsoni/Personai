"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Community } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createCommunity, updateCommunity, type CommunityData } from "@/app/actions/communities"
import { OfferFooter, OfferSheet, LiveRow, MoreToggle, PillRow } from "@/components/dashboard/offer-sheet"

export function CommunityForm({
    profileId,
    community,
    open,
    onOpenChange,
    embedded,
}: {
    profileId: string
    community?: Community | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    embedded?: boolean
}) {
    const router = useRouter()
    const editing = !!community
    const [more, setMore] = useState(Boolean(embedded))
    const [name, setName] = useState("")
    const [platform, setPlatform] = useState<CommunityData["platform"]>("TELEGRAM")
    const [inviteLink, setInviteLink] = useState("")
    const [price, setPrice] = useState("")
    const [billingCycle, setBillingCycle] = useState<CommunityData["billingCycle"]>("MONTHLY")
    const [description, setDescription] = useState("")
    const [live, setLive] = useState(true)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!embedded && !open) return
        setMore(Boolean(embedded) || Boolean(community))
        setName(community?.name || "")
        setPlatform((community?.platform as CommunityData["platform"]) || "TELEGRAM")
        setInviteLink(community?.inviteLink || "")
        setPrice(community ? String(community.priceCents / 100) : "")
        setBillingCycle((community?.billingCycle as CommunityData["billingCycle"]) || "MONTHLY")
        setDescription(community?.description || "")
        setLive(community?.isActive ?? true)
    }, [open, community, embedded])

    async function save() {
        if (!name.trim()) return
        setBusy(true)
        try {
            const data: CommunityData = {
                name: name.trim(),
                description: description.trim() || undefined,
                platform,
                inviteLink: inviteLink.trim() || undefined,
                price: parseFloat(price) || 0,
                billingCycle,
                isActive: live,
            }
            if (editing && community) await updateCommunity(community.id, data)
            else await createCommunity(profileId, data)
            toast.success(editing ? "Saved" : "Community live")
            onOpenChange?.(false)
            router.refresh()
            if (embedded) router.push("/dashboard/community")
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    const fields = (
        <>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" autoFocus={!embedded} className="h-12 rounded-2xl border-border/70 text-base" />
            <PillRow
                value={platform}
                onChange={setPlatform}
                options={[
                    { id: "TELEGRAM", label: "Telegram" },
                    { id: "DISCORD", label: "Discord" },
                ]}
            />
            <Input
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder={platform === "TELEGRAM" ? "https://t.me/…" : "https://discord.gg/…"}
                className="h-12 rounded-2xl border-border/70 text-base"
            />
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (0 = free)" className="h-12 rounded-2xl border-border/70 text-base" />
            <LiveRow checked={live} onChange={setLive} />
            <MoreToggle open={more} onClick={() => setMore((v) => !v)} />
            {more ? (
                <div className="space-y-3 pb-2">
                    <PillRow
                        value={billingCycle}
                        onChange={setBillingCycle}
                        options={[
                            { id: "MONTHLY", label: "Monthly" },
                            { id: "YEARLY", label: "Yearly" },
                            { id: "ONE_TIME", label: "Once" },
                        ]}
                    />
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What members get" rows={3} className="rounded-2xl" />
                </div>
            ) : null}
        </>
    )

    const footer = (
        <OfferFooter
            onCancel={() => (embedded ? router.push("/dashboard/community") : onOpenChange?.(false))}
            busy={busy}
            disabled={!name.trim()}
            label={editing ? "Save" : "Add community"}
        />
    )

    if (embedded) {
        return (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
                {footer}
            </form>
        )
    }

    return (
        <OfferSheet
            open={Boolean(open)}
            onOpenChange={(next) => onOpenChange?.(next)}
            title={editing ? "Edit community" : "Add community"}
            description="Name, platform, invite. Price can be zero."
            footer={<form onSubmit={(e) => { e.preventDefault(); void save() }}>{footer}</form>}
        >
            <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
            </form>
        </OfferSheet>
    )
}
