"use client"

import { useState } from "react"
import { Copy, Eye, Check } from "lucide-react"
import { toast } from "sonner"

interface ProfileLinkActionsProps {
    slug: string
    baseUrl: string
}

export function ProfileLinkActions({ slug, baseUrl }: ProfileLinkActionsProps) {
    const [copied, setCopied] = useState(false)

    const profileUrl = `${baseUrl}/${slug}`

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(profileUrl)
            setCopied(true)
            toast.success("Link copied to clipboard!")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy link")
        }
    }

    const handleViewProfile = () => {
        window.open(profileUrl, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <button
                onClick={handleCopy}
                className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Copy link"
            >
                <span className="truncate max-w-[140px] sm:max-w-[200px]">/{slug}</span>
                {copied ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                )}
            </button>
            <button
                onClick={handleViewProfile}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
                <Eye className="h-3.5 w-3.5" />
                Live
            </button>
        </div>
    )
}
