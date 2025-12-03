"use client"

import { useState } from "react"
import Link from "next/link"
import { Community } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    Users,
    MessageCircle,
} from "lucide-react"
import { deleteCommunity } from "@/app/actions/communities"

interface CommunityWithCounts extends Community {
    _count: {
        members: number
    }
}

interface CommunitiesListProps {
    profileId: string
    communities: CommunityWithCounts[]
}

const platformConfig: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
    TELEGRAM: { 
        icon: MessageCircle, 
        label: "Telegram", 
        color: "bg-blue-500/10 text-blue-600 border-blue-200" 
    },
    DISCORD: { 
        icon: MessageCircle, 
        label: "Discord", 
        color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" 
    },
}

const billingLabels: Record<string, string> = {
    MONTHLY: "Monthly",
    YEARLY: "Yearly",
    ONE_TIME: "One-time",
}

export function CommunitiesList({ profileId, communities }: CommunitiesListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this community? This will also remove all member records.")) return

        setDeletingId(id)
        try {
            await deleteCommunity(id)
        } catch (error) {
            console.error("Failed to delete community:", error)
        } finally {
            setDeletingId(null)
        }
    }

    const getPlatformConfig = (platform: string) => {
        return platformConfig[platform] || platformConfig.TELEGRAM
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Communities</h2>
                    <p className="text-muted-foreground">
                        Manage your paid Telegram and Discord communities.
                    </p>
                </div>
                <Link href="/dashboard/community/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Community
                    </Button>
                </Link>
            </div>

            {communities.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No communities yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Create paid communities on Telegram or Discord to build recurring revenue
                            and engage with your audience.
                        </p>
                        <Link href="/dashboard/community/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Community
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {communities.map((community) => {
                        const isDeleting = deletingId === community.id
                        const config = getPlatformConfig(community.platform)
                        const PlatformIcon = config.icon

                        return (
                            <Card key={community.id} className="relative overflow-hidden">
                                <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                    <PlatformIcon className="h-12 w-12 text-muted-foreground" />
                                </div>

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-medium line-clamp-2">
                                            {community.name}
                                        </CardTitle>
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 ${config.color}`}
                                        >
                                            {config.label}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {community.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {community.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between text-sm">
                                        <div className="font-bold text-lg">
                                            {community.priceCents === 0
                                                ? "Free"
                                                : `$${(community.priceCents / 100).toFixed(2)}`}
                                            {community.priceCents > 0 && (
                                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                                    / {billingLabels[community.billingCycle]}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <Users className="mr-1 h-3 w-3" />
                                            {community._count.members} members
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant={community.isActive ? "default" : "secondary"}>
                                            {community.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/community/${community.id}/edit`}
                                            className="flex-1"
                                        >
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(community.id)}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
