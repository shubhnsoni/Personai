"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { FileField } from "@/components/ui/file-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    addStoryFrame,
    deleteStoryFrame,
    listStoryFrames,
    moveStoryFrame,
    setAboutWalkIn,
    updateStoryFrame,
} from "@/app/actions/story"
import { walkInFromConfig, type AboutWalkIn } from "@/lib/walk-in"
import { STORY_CATEGORIES, storyCategoryLabel, storyLabel, storyPath, type StoryCategory, type StoryFrame } from "@/lib/story"
import { cn } from "@/lib/utils"

export function StoryStudio({ slug, role, personalityConfig }: { slug: string; role?: string | null; personalityConfig?: string | null }) {
    const copy = storyLabel(role)
    const [frames, setFrames] = useState<StoryFrame[]>([])
    const [pending, start] = useTransition()
    const [url, setUrl] = useState("")
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [category, setCategory] = useState<StoryCategory>("AMBIENCE")
    const [uploading, setUploading] = useState(false)
    const [walkIn, setWalkIn] = useState<AboutWalkIn | null>(() => walkInFromConfig(personalityConfig))
    const share = typeof window !== "undefined" ? `${window.location.origin}${storyPath(slug)}` : storyPath(slug)

    function refresh() {
        start(async () => setFrames(await listStoryFrames()))
    }

    useEffect(() => { refresh() }, [])

    async function upload(file?: File) {
        if (!file) return null
        setUploading(true)
        try {
            const data = new FormData()
            data.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body: data })
            const json = await res.json()
            if (!res.ok || !json.url) throw new Error(json.error || "Upload failed")
            setUrl(json.url)
            toast.success("File ready")
            return json.url as string
        } catch {
            toast.error("Could not upload")
            return null
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">{copy.page}</p>
                    <p className="text-xs text-muted-foreground">
                        The public about page — walk-in, photos, and a few lines about {copy.verb}. Guests open it from chat or {storyPath(slug)}.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full"
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(share)
                            toast.success("Link copied")
                        } catch {
                            toast.error("Could not copy")
                        }
                    }}
                >
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    Copy link
                </Button>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                <div>
                    <p className="text-sm font-medium">Walk-in</p>
                    <p className="text-[12px] text-muted-foreground">A 360 photo becomes a sphere guests can drag around. A GLB is a 3D room they can orbit. Saved on this page.</p>
                </div>
                {walkIn ? (
                    <p className="truncate text-[12px] text-muted-foreground">{walkIn.kind === "model" ? "3D room" : "360 sphere"} · {walkIn.url}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                    <FileField
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploading}
                        buttonLabel={uploading ? "Uploading…" : "360 photo"}
                        onFile={async (file) => {
                            const url = await upload(file)
                            if (!url) return
                            const next = { kind: "sphere" as const, url }
                            setWalkIn(next)
                            start(async () => {
                                await setAboutWalkIn(next)
                                toast.success("360 walk-in saved")
                            })
                        }}
                    />
                    <FileField
                        accept=".glb,model/gltf-binary"
                        disabled={uploading}
                        buttonLabel="3D room"
                        onFile={async (file) => {
                            const url = await upload(file)
                            if (!url) return
                            const next = { kind: "model" as const, url }
                            setWalkIn(next)
                            start(async () => {
                                await setAboutWalkIn(next)
                                toast.success("3D walk-in saved")
                            })
                        }}
                    />
                    {walkIn ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 rounded-full"
                            onClick={() => start(async () => {
                                setWalkIn(null)
                                await setAboutWalkIn(null)
                                toast.success("Walk-in removed")
                            })}
                        >
                            Remove
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex items-center gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted">
                        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <FileField
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploading}
                        onFile={(file) => { void upload(file) }}
                        buttonLabel={uploading ? "Uploading…" : "Photo"}
                    />
                </div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A line of title" />
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="The story that sits with this picture" rows={3} />
                <div className="flex flex-wrap gap-1.5">
                    {STORY_CATEGORIES.map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setCategory(id)}
                            className={cn(
                                "h-8 rounded-full border px-3 text-xs font-medium",
                                category === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
                            )}
                        >
                            {storyCategoryLabel(role, id)}
                        </button>
                    ))}
                </div>
                <Button
                    type="button"
                    className="rounded-full"
                    disabled={pending || !url}
                    onClick={() => start(async () => {
                        try {
                            await addStoryFrame({ url, title, body, category })
                            setUrl(""); setTitle(""); setBody("")
                            toast.success("Added")
                            setFrames(await listStoryFrames())
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not add")
                        }
                    })}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                </Button>
            </div>

            <div className="space-y-2">
                {frames.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No frames yet. Add a photo and a few lines.</p>
                ) : frames.map((frame, i) => (
                    <article key={frame.id} className={cn("flex gap-3 rounded-2xl border border-border/70 p-3", !frame.isPublished && "opacity-60")}>
                        <img src={frame.url} alt="" className="h-20 w-16 shrink-0 rounded-xl object-cover" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Input
                                defaultValue={frame.title}
                                placeholder="Title"
                                onBlur={(e) => start(async () => updateStoryFrame(frame.id, { ...frame, title: e.target.value }))}
                            />
                            <Textarea
                                defaultValue={frame.body}
                                placeholder="Story"
                                rows={2}
                                onBlur={(e) => start(async () => updateStoryFrame(frame.id, { ...frame, body: e.target.value }))}
                            />
                            <div className="flex flex-wrap gap-1">
                                {STORY_CATEGORIES.map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={cn("rounded-full px-2 py-0.5 text-[10px]", frame.category === id ? "bg-foreground text-background" : "text-muted-foreground")}
                                        onClick={() => start(async () => {
                                            await updateStoryFrame(frame.id, { ...frame, category: id })
                                            setFrames(await listStoryFrames())
                                        })}
                                    >
                                        {storyCategoryLabel(role, id)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={i === 0} onClick={() => start(async () => { await moveStoryFrame(frame.id, "up"); setFrames(await listStoryFrames()) })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={i === frames.length - 1} onClick={() => start(async () => { await moveStoryFrame(frame.id, "down"); setFrames(await listStoryFrames()) })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => start(async () => { await updateStoryFrame(frame.id, { ...frame, isPublished: !frame.isPublished }); setFrames(await listStoryFrames()) })}>{frame.isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500" onClick={() => start(async () => { await deleteStoryFrame(frame.id); setFrames(await listStoryFrames()) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    )
}
