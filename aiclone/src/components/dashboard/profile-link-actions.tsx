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
        } catch (err) {
            toast.error("Failed to copy link")
        }
    }

    const handleViewProfile = () => {
        window.open(profileUrl, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground truncate max-w-[200px]">/{slug}</span>
                <button 
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy link"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                    ) : (
                        <Copy className="w-4 h-4" />
                    )}
                </button>
            </div>
            <button 
                onClick={handleViewProfile}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
                <Eye className="w-4 h-4" />
                View Profile
            </button>
        </div>
    )
}
