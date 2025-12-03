"use client"

import { useState } from "react"
import Link from "next/link"
import { LeadMagnet } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    FileText,
    Gift,
    Download,
    Users,
    Magnet,
} from "lucide-react"
import { deleteLeadMagnet } from "@/app/actions/lead-magnets"

interface LeadMagnetWithCount extends LeadMagnet {
    _count: {
        submissions: number
    }
}

interface LeadMagnetsListProps {
    profileId: string
    leadMagnets: LeadMagnetWithCount[]
}

const typeConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
    FORM: { icon: FileText, color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Form" },
    GIVEAWAY: { icon: Gift, color: "bg-purple-500/10 text-purple-600 border-purple-200", label: "Giveaway" },
    DOWNLOAD: { icon: Download, color: "bg-green-500/10 text-green-600 border-green-200", label: "Download" },
}

export function LeadMagnetsList({ profileId, leadMagnets }: LeadMagnetsListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this lead magnet?")) return

        setDeletingId(id)
        try {
            await deleteLeadMagnet(id)
        } catch (error) {
            console.error("Failed to delete lead magnet:", error)
        } finally {
            setDeletingId(null)
        }
    }

    const getTypeConfig = (type: string) => {
        return typeConfig[type] || typeConfig.DOWNLOAD
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Lead Magnets</h2>
                    <p className="text-muted-foreground">
                        Create forms, giveaways, and downloads to capture leads.
                    </p>
                </div>
                <Link href="/dashboard/lead-magnets/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Lead Magnet
                    </Button>
                </Link>
            </div>

            {leadMagnets.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Magnet className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No lead magnets yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Start capturing leads with forms, giveaways, or downloadable content.
                            Create your first lead magnet to get started.
                        </p>
                        <Link href="/dashboard/lead-magnets/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Lead Magnet
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {leadMagnets.map((leadMagnet) => {
                        const config = getTypeConfig(leadMagnet.type)
                        const TypeIcon = config.icon
                        const isDeleting = deletingId === leadMagnet.id

                        return (
                            <Card key={leadMagnet.id} className="relative overflow-hidden">
                                <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                    <TypeIcon className="h-12 w-12 text-muted-foreground" />
                                </div>

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-medium line-clamp-2">
                                            {leadMagnet.title}
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
                                    {leadMagnet.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {leadMagnet.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center text-muted-foreground">
                                            <Users className="mr-1 h-4 w-4" />
                                            <span>
                                                {leadMagnet._count.submissions} submission{leadMagnet._count.submissions !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {leadMagnet.type === "DOWNLOAD" && (
                                            <div className="flex items-center text-muted-foreground">
                                                <Download className="mr-1 h-3 w-3" />
                                                {leadMagnet.downloadCount}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Badge variant={leadMagnet.isActive ? "default" : "secondary"}>
                                            {leadMagnet.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/lead-magnets/${leadMagnet.id}/edit`}
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
                                            onClick={() => handleDelete(leadMagnet.id)}
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
