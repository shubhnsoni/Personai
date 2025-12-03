"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LeadMagnet } from "@prisma/client"
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
import { Plus, Trash2 } from "lucide-react"
import { createLeadMagnet, updateLeadMagnet, type LeadMagnetData } from "@/app/actions/lead-magnets"

interface FormField {
    label: string
    type: "text" | "email" | "phone" | "textarea" | "select"
    required: boolean
}

interface LeadMagnetFormProps {
    profileId: string
    leadMagnet?: LeadMagnet
}

export function LeadMagnetForm({ profileId, leadMagnet }: LeadMagnetFormProps) {
    const router = useRouter()
    const isEditing = !!leadMagnet

    const [title, setTitle] = useState(leadMagnet?.title || "")
    const [description, setDescription] = useState(leadMagnet?.description || "")
    const [type, setType] = useState<LeadMagnetData["type"]>(
        (leadMagnet?.type as LeadMagnetData["type"]) || "DOWNLOAD"
    )
    const [fileUrl, setFileUrl] = useState(leadMagnet?.fileUrl || "")
    const [formFields, setFormFields] = useState<FormField[]>(() => {
        if (leadMagnet?.formFields) {
            try {
                return JSON.parse(leadMagnet.formFields)
            } catch {
                return []
            }
        }
        return []
    })
    const [isActive, setIsActive] = useState(leadMagnet?.isActive ?? true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAddField = () => {
        setFormFields([...formFields, { label: "", type: "text", required: false }])
    }

    const handleRemoveField = (index: number) => {
        setFormFields(formFields.filter((_, i) => i !== index))
    }

    const handleFieldChange = (index: number, field: Partial<FormField>) => {
        const updated = [...formFields]
        updated[index] = { ...updated[index], ...field }
        setFormFields(updated)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsSubmitting(true)
        try {
            const data: LeadMagnetData = {
                title: title.trim(),
                description: description.trim() || undefined,
                type,
                fileUrl: fileUrl.trim() || undefined,
                formFields: type === "FORM" && formFields.length > 0
                    ? JSON.stringify(formFields.filter(f => f.label.trim()))
                    : undefined,
                isActive,
            }

            if (isEditing && leadMagnet) {
                await updateLeadMagnet(leadMagnet.id, data)
            } else {
                await createLeadMagnet(profileId, data)
            }

            router.push("/dashboard/lead-magnets")
            router.refresh()
        } catch (error) {
            console.error("Failed to save lead magnet:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/lead-magnets")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Lead Magnet" : "Create New Lead Magnet"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your lead magnet details."
                        : "Create a new lead magnet to capture leads from your audience."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Free Marketing Guide"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what visitors will get..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select value={type} onValueChange={(val) => setType(val as LeadMagnetData["type"])}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DOWNLOAD">Download</SelectItem>
                                <SelectItem value="GIVEAWAY">Giveaway</SelectItem>
                                <SelectItem value="FORM">Form</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {type === "DOWNLOAD" && "Offer a downloadable file in exchange for contact info"}
                            {type === "GIVEAWAY" && "Run a giveaway to capture leads"}
                            {type === "FORM" && "Create a custom form to collect specific information"}
                        </p>
                    </div>

                    {(type === "DOWNLOAD" || type === "GIVEAWAY") && (
                        <div className="space-y-2">
                            <Label htmlFor="fileUrl">File URL</Label>
                            <Input
                                id="fileUrl"
                                type="url"
                                placeholder="https://example.com/your-file.pdf"
                                value={fileUrl}
                                onChange={(e) => setFileUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {type === "DOWNLOAD" 
                                    ? "Direct link to the file users will download"
                                    : "Link to the giveaway prize or details"}
                            </p>
                        </div>
                    )}

                    {type === "FORM" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Form Fields</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddField}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Field
                                </Button>
                            </div>

                            {formFields.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-6 text-center">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        No fields added yet
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddField}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Add Your First Field
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {formFields.map((field, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg border bg-muted/30"
                                        >
                                            <div className="sm:col-span-5">
                                                <Input
                                                    placeholder="Field label"
                                                    value={field.label}
                                                    onChange={(e) =>
                                                        handleFieldChange(index, { label: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="sm:col-span-3">
                                                <Select
                                                    value={field.type}
                                                    onValueChange={(val) =>
                                                        handleFieldChange(index, { type: val as FormField["type"] })
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="text">Text</SelectItem>
                                                        <SelectItem value="email">Email</SelectItem>
                                                        <SelectItem value="phone">Phone</SelectItem>
                                                        <SelectItem value="textarea">Textarea</SelectItem>
                                                        <SelectItem value="select">Select</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="sm:col-span-3 flex items-center gap-2">
                                                <Switch
                                                    id={`required-${index}`}
                                                    checked={field.required}
                                                    onCheckedChange={(checked) =>
                                                        handleFieldChange(index, { required: checked })
                                                    }
                                                />
                                                <Label htmlFor={`required-${index}`} className="text-sm">
                                                    Required
                                                </Label>
                                            </div>
                                            <div className="sm:col-span-1 flex items-center justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleRemoveField(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Make this lead magnet visible and available
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
                        <Button type="submit" disabled={isSubmitting || !title.trim()}>
                            {isSubmitting
                                ? "Saving..."
                                : isEditing
                                ? "Update Lead Magnet"
                                : "Create Lead Magnet"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
