"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import type { LeadMagnet } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileField } from "@/components/ui/file-field"
import { Switch } from "@/components/ui/switch"
import { createLeadMagnet, updateLeadMagnet, type LeadMagnetData } from "@/app/actions/lead-magnets"
import { OfferFooter, OfferSheet, LiveRow, MoreToggle, PillRow, uploadOne } from "@/components/dashboard/offer-sheet"

type Field = { label: string; type: "text" | "email" | "phone" | "textarea" | "select"; required: boolean }

export function LeadMagnetForm({
    profileId,
    leadMagnet,
    open,
    onOpenChange,
    embedded,
}: {
    profileId: string
    leadMagnet?: LeadMagnet | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    embedded?: boolean
}) {
    const router = useRouter()
    const editing = !!leadMagnet
    const [more, setMore] = useState(Boolean(embedded))
    const [title, setTitle] = useState("")
    const [type, setType] = useState<LeadMagnetData["type"]>("DOWNLOAD")
    const [fileUrl, setFileUrl] = useState("")
    const [description, setDescription] = useState("")
    const [formFields, setFormFields] = useState<Field[]>([])
    const [live, setLive] = useState(true)
    const [busy, setBusy] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        if (!embedded && !open) return
        setMore(Boolean(embedded) || Boolean(leadMagnet))
        setTitle(leadMagnet?.title || "")
        setType((leadMagnet?.type as LeadMagnetData["type"]) || "DOWNLOAD")
        setFileUrl(leadMagnet?.fileUrl || "")
        setDescription(leadMagnet?.description || "")
        try {
            setFormFields(leadMagnet?.formFields ? JSON.parse(leadMagnet.formFields) : [])
        } catch {
            setFormFields([])
        }
        setLive(leadMagnet?.isActive ?? true)
    }, [open, leadMagnet, embedded])

    async function save() {
        if (!title.trim()) return
        setBusy(true)
        try {
            const cleaned = formFields.filter((f) => f.label.trim())
            const data: LeadMagnetData = {
                title: title.trim(),
                description: description.trim() || undefined,
                type,
                fileUrl: fileUrl.trim() || undefined,
                formFields: cleaned.length ? JSON.stringify(cleaned) : undefined,
                isActive: live,
            }
            if (editing && leadMagnet) await updateLeadMagnet(leadMagnet.id, data)
            else await createLeadMagnet(profileId, data)
            toast.success(editing ? "Saved" : "Live — email for the file")
            onOpenChange?.(false)
            router.refresh()
            if (embedded) router.push("/dashboard/lead-magnets")
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    const fields = (
        <>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name — Free guide, checklist…" autoFocus={!embedded} className="h-12 rounded-2xl border-border/70 text-base" />
            <PillRow
                value={type}
                onChange={setType}
                options={[
                    { id: "DOWNLOAD", label: "File" },
                    { id: "GIVEAWAY", label: "Giveaway" },
                    { id: "FORM", label: "Form" },
                ]}
            />
            {type !== "FORM" ? (
                <div className="space-y-2">
                    <FileField
                        accept="*/*"
                        buttonLabel="Choose file"
                        emptyLabel={fileUrl ? "File attached" : "PDF, zip…"}
                        disabled={uploading}
                        onFile={async (file) => {
                            if (!file) return
                            setUploading(true)
                            try {
                                const url = await uploadOne(file)
                                if (url) setFileUrl(url)
                                else toast.error("Upload failed")
                            } finally {
                                setUploading(false)
                            }
                        }}
                    />
                    <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="or paste a file URL" className="h-11 rounded-2xl" />
                </div>
            ) : null}
            <LiveRow checked={live} onChange={setLive} />
            <MoreToggle open={more} onClick={() => setMore((v) => !v)} />
            {more ? (
                <div className="space-y-3 pb-2">
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What they get" rows={3} className="rounded-2xl" />
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Ask for</p>
                        <button
                            type="button"
                            className="text-sm text-muted-foreground"
                            onClick={() => setFormFields((prev) => [...prev, { label: "", type: "email", required: true }])}
                        >
                            <Plus className="mr-1 inline h-3.5 w-3.5" />
                            Field
                        </button>
                    </div>
                    {formFields.map((field, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                value={field.label}
                                onChange={(e) => setFormFields((prev) => prev.map((f, i) => i === index ? { ...f, label: e.target.value } : f))}
                                placeholder="Email, name…"
                                className="h-11 flex-1 rounded-2xl"
                            />
                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Switch checked={field.required} onCheckedChange={(on) => setFormFields((prev) => prev.map((f, i) => i === index ? { ...f, required: on } : f))} />
                                Need
                            </label>
                            <button type="button" className="text-destructive" onClick={() => setFormFields((prev) => prev.filter((_, i) => i !== index))}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </>
    )

    const footer = (
        <OfferFooter
            onCancel={() => (embedded ? router.push("/dashboard/lead-magnets") : onOpenChange?.(false))}
            busy={busy}
            disabled={!title.trim()}
            label={editing ? "Save" : "Add download"}
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
            title={editing ? "Edit download" : "Free download"}
            description="Name and a file. Email is collected on the public page."
            footer={<form onSubmit={(e) => { e.preventDefault(); void save() }}>{footer}</form>}
        >
            <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
                {fields}
            </form>
        </OfferSheet>
    )
}
