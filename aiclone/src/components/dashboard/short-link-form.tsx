"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShortLink } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { createShortLink, updateShortLink, type ShortLinkData } from "@/app/actions/short-links"

interface ShortLinkFormProps {
    profileId: string
    shortLink?: ShortLink
}

export function ShortLinkForm({ profileId, shortLink }: ShortLinkFormProps) {
    const router = useRouter()
    const isEditing = !!shortLink

    const [title, setTitle] = useState(shortLink?.title || "")
    const [targetUrl, setTargetUrl] = useState(shortLink?.targetUrl || "")
    const [code, setCode] = useState(shortLink?.code || "")
    const [isActive, setIsActive] = useState(shortLink?.isActive ?? true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!targetUrl.trim()) return

        setIsSubmitting(true)
        setError(null)
        try {
            const data: ShortLinkData = {
                title: title.trim() || undefined,
                targetUrl: targetUrl.trim(),
                code: code.trim() || undefined,
                isActive,
            }

            if (isEditing && shortLink) {
                await updateShortLink(shortLink.id, data)
            } else {
                await createShortLink(profileId, data)
            }

            router.push("/dashboard/links")
            router.refresh()
        } catch (err) {
            console.error("Failed to save short link:", err)
            setError(err instanceof Error ? err.message : "Failed to save short link")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/links")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Short Link" : "Create Short Link"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your short link settings."
                        : "Create a trackable short link for your content."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="targetUrl">Target URL *</Label>
                        <Input
                            id="targetUrl"
                            type="url"
                            placeholder="https://example.com/your-destination"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            The destination URL where visitors will be redirected
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Instagram Bio Link"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Optional name for your reference
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="code">Custom Code</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">/l/</span>
                            <Input
                                id="code"
                                placeholder="my-link"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                                className="flex-1"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Leave empty to auto-generate. Only letters, numbers, hyphens, and underscores allowed.
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable this link for redirects
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
                        <Button type="submit" disabled={isSubmitting || !targetUrl.trim()}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditing
                                ? "Update Link"
                                : "Create Link"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
