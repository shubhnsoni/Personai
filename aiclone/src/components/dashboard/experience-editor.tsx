"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Pencil } from "lucide-react"
import { createWorkExperience, updateWorkExperience, deleteWorkExperience } from "@/app/actions/profile"

interface ExperienceEditorProps {
    profileId: string
    experiences: any[]
}

export function ExperienceEditor({ profileId, experiences }: ExperienceEditorProps) {
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    return (
        <Card className="gap-4 py-4 shadow-none">
            <CardHeader className="px-4">
                <CardTitle className="text-sm font-medium">Experience</CardTitle>
                <CardDescription>Roles the chat can talk about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
                {isCreating && (
                    <ExperienceForm
                        profileId={profileId}
                        onCancel={() => setIsCreating(false)}
                        onSave={() => setIsCreating(false)}
                    />
                )}

                {experiences.length > 0 ? (
                    <div className="divide-y overflow-hidden rounded-xl border">
                        {experiences.map((exp) => (
                            <div key={exp.id} className="p-3">
                                {isEditing === exp.id ? (
                                    <ExperienceForm
                                        profileId={profileId}
                                        initialData={exp}
                                        onCancel={() => setIsEditing(null)}
                                        onSave={() => setIsEditing(null)}
                                    />
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-sm font-medium">{exp.role}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {exp.company} · {exp.startDate} – {exp.endDate || "Present"}
                                            </p>
                                            {exp.description ? (
                                                <p className="line-clamp-2 text-xs text-muted-foreground">{exp.description}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(exp.id)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteWorkExperience(exp.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : !isCreating ? (
                    <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                        No roles yet.
                    </p>
                ) : null}

                {!isCreating && (
                    <Button type="button" variant="outline" className="h-9 w-full rounded-full" onClick={() => setIsCreating(true)}>
                        <Plus className="mr-1 h-4 w-4" /> Add experience
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

function ExperienceForm({ profileId, initialData, onCancel, onSave }: { profileId: string, initialData?: any, onCancel: () => void, onSave: () => void }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (root: HTMLElement) => {
        setIsLoading(true)
        const val = (name: string) =>
            (root.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ""
        const data = {
            company: val("company"),
            role: val("role"),
            startDate: val("startDate"),
            endDate: val("endDate").trim() || null,
            description: val("description"),
            achievements: (() => {
                const raw = val("achievements").trim()
                if (!raw) return null
                const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                return lines.length ? JSON.stringify(lines) : null
            })(),
        }

        try {
            if (initialData) {
                await updateWorkExperience(initialData.id, data)
            } else {
                await createWorkExperience(profileId, data)
            }
            onSave()
        } catch (error) {
            console.error(error)
            alert("Failed to save experience")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-3 rounded-xl border border-dashed p-3" data-exp-form>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Input name="role" defaultValue={initialData?.role} required />
                </div>
                <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input name="company" defaultValue={initialData?.company} required />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input name="startDate" defaultValue={initialData?.startDate} placeholder="2022" required />
                </div>
                <div className="space-y-1.5">
                    <Label>End</Label>
                    <Input name="endDate" defaultValue={initialData?.endDate} placeholder="Leave empty for present" />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={initialData?.description} rows={3} />
            </div>
            <div className="space-y-1.5">
                <Label>Achievements</Label>
                <Textarea
                    name="achievements"
                    rows={3}
                    defaultValue={(() => {
                        if (!initialData?.achievements) return ""
                        try {
                            const parsed = JSON.parse(initialData.achievements)
                            return Array.isArray(parsed) ? parsed.join("\n") : String(initialData.achievements)
                        } catch {
                            return String(initialData.achievements)
                        }
                    })()}
                    placeholder="One per line"
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={isLoading}
                    onClick={(e) => {
                        const root = e.currentTarget.closest("[data-exp-form]") as HTMLElement | null
                        if (root) void handleSubmit(root)
                    }}
                >
                    {isLoading ? "Saving..." : "Save"}
                </Button>
            </div>
        </div>
    )
}
