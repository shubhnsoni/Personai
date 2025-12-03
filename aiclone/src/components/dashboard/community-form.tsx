"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Community } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createCommunity, updateCommunity, type CommunityData } from "@/app/actions/communities"

interface CommunityFormProps {
    profileId: string
    community?: Community
}

export function CommunityForm({ profileId, community }: CommunityFormProps) {
    const router = useRouter()
    const isEditing = !!community

    const [name, setName] = useState(community?.name || "")
    const [description, setDescription] = useState(community?.description || "")
    const [platform, setPlatform] = useState<CommunityData["platform"]>(
        (community?.platform as CommunityData["platform"]) || "TELEGRAM"
    )
    const [inviteLink, setInviteLink] = useState(community?.inviteLink || "")
    const [price, setPrice] = useState(
        community ? (community.priceCents / 100).toString() : ""
    )
    const [billingCycle, setBillingCycle] = useState<CommunityData["billingCycle"]>(
        (community?.billingCycle as CommunityData["billingCycle"]) || "MONTHLY"
    )
    const [isActive, setIsActive] = useState(community?.isActive ?? true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setIsSubmitting(true)
        try {
            const data: CommunityData = {
                name: name.trim(),
                description: description.trim() || undefined,
                platform,
                inviteLink: inviteLink.trim() || undefined,
                price: parseFloat(price) || 0,
                billingCycle,
                isActive,
            }

            if (isEditing && community) {
                await updateCommunity(community.id, data)
            } else {
                await createCommunity(profileId, data)
            }

            router.push("/dashboard/community")
            router.refresh()
        } catch (error) {
            console.error("Failed to save community:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/community")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Community" : "Create New Community"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your community details."
                        : "Set up a paid community on Telegram or Discord to engage with your audience."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            placeholder="e.g. VIP Mastermind Group"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what members get access to..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="platform">Platform</Label>
                            <Select value={platform} onValueChange={(val) => setPlatform(val as CommunityData["platform"])}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TELEGRAM">Telegram</SelectItem>
                                    <SelectItem value="DISCORD">Discord</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="billingCycle">Billing Cycle</Label>
                            <Select value={billingCycle} onValueChange={(val) => setBillingCycle(val as CommunityData["billingCycle"])}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select billing cycle" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    <SelectItem value="YEARLY">Yearly</SelectItem>
                                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inviteLink">Invite Link</Label>
                        <Input
                            id="inviteLink"
                            type="url"
                            placeholder={platform === "TELEGRAM" ? "https://t.me/..." : "https://discord.gg/..."}
                            value={inviteLink}
                            onChange={(e) => setInviteLink(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            The invite link members will receive after payment
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">Price (USD)</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Set to 0 for a free community
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Make this community visible and available for new members
                            </p>
                        </div>
                        <Switch
                            id="isActive"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                        />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !name.trim()}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditing
                                ? "Update Community"
                                : "Create Community"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
