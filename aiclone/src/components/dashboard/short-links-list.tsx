"use client"

import { useState } from "react"
import Link from "next/link"
import { ShortLink } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    Link2,
    Copy,
    Check,
    ExternalLink,
    MousePointerClick,
} from "lucide-react"
import { deleteShortLink } from "@/app/actions/short-links"

interface ShortLinksListProps {
    profileId: string
    shortLinks: ShortLink[]
}

export function ShortLinksList({ profileId, shortLinks }: ShortLinksListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this short link?")) return

        setDeletingId(id)
        try {
            await deleteShortLink(id)
        } catch (error) {
            console.error("Failed to delete short link:", error)
        } finally {
            setDeletingId(null)
        }
    }

    const getShortUrl = (code: string) => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/l/${code}`
        }
        return `/l/${code}`
    }

    const copyToClipboard = async (code: string, id: string) => {
        const url = getShortUrl(code)
        try {
            await navigator.clipboard.writeText(url)
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
        } catch (error) {
            console.error("Failed to copy:", error)
        }
    }

    const truncateUrl = (url: string, maxLength: number = 40) => {
        if (url.length <= maxLength) return url
        return url.substring(0, maxLength) + "..."
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Short Links</h2>
                    <p className="text-muted-foreground">
                        Create and manage trackable short links for your content.
                    </p>
                </div>
                <Link href="/dashboard/links/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Short Link
                    </Button>
                </Link>
            </div>

            {shortLinks.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No short links yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Create trackable short links to share your content and track clicks.
                        </p>
                        <Link href="/dashboard/links/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Link
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b bg-muted/50">
                                    <tr>
                                        <th className="text-left p-4 font-medium text-sm">Short Link</th>
                                        <th className="text-left p-4 font-medium text-sm hidden md:table-cell">Target URL</th>
                                        <th className="text-left p-4 font-medium text-sm hidden sm:table-cell">Title</th>
                                        <th className="text-center p-4 font-medium text-sm">Clicks</th>
                                        <th className="text-center p-4 font-medium text-sm hidden sm:table-cell">Status</th>
                                        <th className="text-left p-4 font-medium text-sm hidden lg:table-cell">Created</th>
                                        <th className="text-right p-4 font-medium text-sm">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {shortLinks.map((link) => {
                                        const isDeleting = deletingId === link.id
                                        const isCopied = copiedId === link.id

                                        return (
                                            <tr key={link.id} className="hover:bg-muted/30">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                                            /l/{link.code}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => copyToClipboard(link.code, link.id)}
                                                            title="Copy to clipboard"
                                                        >
                                                            {isCopied ? (
                                                                <Check className="h-4 w-4 text-green-600" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <a
                                                        href={link.targetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                    >
                                                        {truncateUrl(link.targetUrl)}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell">
                                                    <span className="text-sm">
                                                        {link.title || <span className="text-muted-foreground">—</span>}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium">{link.clicks}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center hidden sm:table-cell">
                                                    <Badge variant={link.isActive ? "default" : "secondary"}>
                                                        {link.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 hidden lg:table-cell">
                                                    <span className="text-sm text-muted-foreground">
                                                        {formatDate(link.createdAt)}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/dashboard/links/${link.id}/edit`}>
                                                            <Button variant="outline" size="sm">
                                                                <Pencil className="h-4 w-4" />
                                                                <span className="sr-only sm:not-sr-only sm:ml-2">Edit</span>
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDelete(link.id)}
                                                            disabled={isDeleting}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
