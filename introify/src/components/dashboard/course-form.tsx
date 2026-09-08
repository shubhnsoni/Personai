"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Course } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PhotoStage } from "@/components/shop/photo-stage"
import { createCourse, updateCourse, type CourseData } from "@/app/actions/courses"
import { OfferFooter, OfferSheet, LiveRow, MoreToggle, PillRow, uploadOne } from "@/components/dashboard/offer-sheet"

export function CourseForm({
    profileId,
    course,
    open,
    onOpenChange,
    embedded,
}: {
    profileId: string
    course?: Course | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    embedded?: boolean
}) {
    const router = useRouter()
    const editing = !!course
    const [more, setMore] = useState(Boolean(embedded))
    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [photo, setPhoto] = useState<string | null>(null)
    const [subtitle, setSubtitle] = useState("")
    const [description, setDescription] = useState("")
    const [body, setBody] = useState("")
    const [outcomes, setOutcomes] = useState("")
    const [level, setLevel] = useState("ALL")
    const [compareAt, setCompareAt] = useState("")
    const [live, setLive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (!embedded && !open) return
        setMore(Boolean(embedded) || Boolean(course))
        setTitle(course?.title || "")
        setPrice(course ? String(course.priceCents / 100) : "")
        setPhoto(course?.thumbnailUrl || null)
        setSubtitle((course as { subtitle?: string | null } | null)?.subtitle || "")
        setDescription(course?.description || "")
        setBody((course as { body?: string | null } | null)?.body || "")
        const raw = (course as { outcomes?: string | null } | null)?.outcomes
        try {
            const parsed = raw ? JSON.parse(raw) : []
            setOutcomes(Array.isArray(parsed) ? parsed.join("\n") : raw || "")
        } catch {
            setOutcomes(raw || "")
        }
        setLevel((course as { level?: string | null } | null)?.level || "ALL")
        setCompareAt((course as { compareAtCents?: number | null } | null)?.compareAtCents ? String(((course as { compareAtCents?: number }).compareAtCents || 0) / 100) : "")
        setLive(course ? Boolean(course.isPublished && course.isActive) : true)
    }, [open, course, embedded])

    async function save() {
        if (!title.trim()) return
        setBusy(true)
        try {
            const lines = outcomes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
            const data: CourseData = {
                title: title.trim(),
                description: description.trim() || undefined,
                subtitle: subtitle.trim() || undefined,
                body: body.trim() || undefined,
                outcomes: lines.length ? JSON.stringify(lines) : undefined,
                level,
                compareAtCents: compareAt ? Math.round(parseFloat(compareAt) * 100) : undefined,
                price: parseFloat(price) || 0,
                thumbnailUrl: photo || undefined,
                isActive: live,
                isPublished: live,
            }
            if (editing && course) {
                await updateCourse(course.id, data)
                toast.success("Saved")
            } else {
                const created = await createCourse(profileId, data)
                toast.success("Course live — tap it to add lessons")
                onOpenChange?.(false)
                router.push(`/dashboard/courses/${created.id}/edit?tab=curriculum`)
                return
            }
            onOpenChange?.(false)
            router.refresh()
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    const fields = (
        <>
            <PhotoStage
                photos={photo ? [photo] : []}
                active={0}
                onSelect={() => {}}
                onRemove={() => setPhoto(null)}
                uploading={uploading}
                emptyLabel="Cover"
                onAdd={async (files) => {
                    setUploading(true)
                    try {
                        const url = files[0] ? await uploadOne(files[0]) : null
                        if (url) setPhoto(url)
                        else toast.error("Upload failed")
                    } finally {
                        setUploading(false)
                    }
                }}
            />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course name" autoFocus={!embedded} className="h-12 rounded-2xl border-border/70 text-base" />
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (0 = free)" className="h-12 rounded-2xl border-border/70 text-base" />
            <LiveRow checked={live} onChange={setLive} label="Open for enroll" />
            <MoreToggle open={more} onClick={() => setMore((v) => !v)} />
            {more ? (
                <div className="space-y-3 pb-2">
                    <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="One-line pitch" className="h-11 rounded-2xl" />
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short pitch for cards and chat" rows={3} className="rounded-2xl" />
                    <PillRow
                        value={level}
                        onChange={setLevel}
                        options={[
                            { id: "ALL", label: "All" },
                            { id: "BEGINNER", label: "Beginner" },
                            { id: "INTERMEDIATE", label: "Intermediate" },
                        ]}
                    />
                    <Input type="number" min="0" step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Compare-at price" className="h-11 rounded-2xl" />
                    <Textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} placeholder={"What they learn, one per line"} rows={3} className="rounded-2xl" />
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Longer landing copy (optional)" rows={4} className="rounded-2xl" />
                </div>
            ) : null}
        </>
    )

    const footer = (
        <OfferFooter
            onCancel={() => (embedded ? router.push("/dashboard/courses") : onOpenChange?.(false))}
            busy={busy}
            disabled={!title.trim()}
            label={editing ? "Save" : "Add course"}
        />
    )

    if (embedded) {
        return (
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault()
                    void save()
                }}
            >
                {fields}
                {footer}
            </form>
        )
    }

    return (
        <OfferSheet
            open={Boolean(open)}
            onOpenChange={(next) => onOpenChange?.(next)}
            title={editing ? "Edit course" : "Add course"}
            description={more ? "Extra detail. Name and price is enough to start." : "Name, price, cover. Tap More if you need it."}
            footer={
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void save()
                    }}
                >
                    {footer}
                </form>
            }
        >
            <form
                className="space-y-4 pb-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    void save()
                }}
            >
                {fields}
            </form>
        </OfferSheet>
    )
}
