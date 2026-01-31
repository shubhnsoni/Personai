"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Pencil } from "lucide-react"
import { createWorkExperience, updateWorkExperience, deleteWorkExperience } from "@/app/actions/profile"

interface ExperienceEditorProps {
    profileId: string
    experiences: any[] // Using any until prisma client is regenerated
}

export function ExperienceEditor({ profileId, experiences }: ExperienceEditorProps) {
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Work Experience</h3>
                <Button onClick={() => setIsCreating(true)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Experience
                </Button>
            </div>

            {isCreating && (
                <ExperienceForm
                    profileId={profileId}
                    onCancel={() => setIsCreating(false)}
                    onSave={() => setIsCreating(false)}
                />
            )}

            <div className="grid gap-4">
                {experiences.map((exp) => (
                    <Card key={exp.id}>
                        <CardContent className="p-4">
                            {isEditing === exp.id ? (
                                <ExperienceForm
                                    profileId={profileId}
                                    initialData={exp}
                                    onCancel={() => setIsEditing(null)}
                                    onSave={() => setIsEditing(null)}
                                />
                            ) : (
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold">{exp.role}</h4>
                                        <p className="text-sm text-muted-foreground">{exp.company} • {exp.startDate} - {exp.endDate || "Present"}</p>
                                        {exp.description && <p className="text-sm mt-2">{exp.description}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(exp.id)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteWorkExperience(exp.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

function ExperienceForm({ profileId, initialData, onCancel, onSave }: { profileId: string, initialData?: any, onCancel: () => void, onSave: () => void }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        const formData = new FormData(e.currentTarget)
        const data = {
            company: formData.get("company"),
            role: formData.get("role"),
            startDate: formData.get("startDate"),
            endDate: formData.get("endDate"),
            description: formData.get("description"),
            achievements: formData.get("achievements"),
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
        <Card className="border-dashed">
            <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Input name="role" defaultValue={initialData?.role} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Company</Label>
                            <Input name="company" defaultValue={initialData?.company} required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input name="startDate" defaultValue={initialData?.startDate} placeholder="e.g. 2022" required />
                        </div>
                        <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input name="endDate" defaultValue={initialData?.endDate} placeholder="Leave empty for Present" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea name="description" defaultValue={initialData?.description} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
