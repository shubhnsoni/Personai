"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2, Pencil } from "lucide-react"
import { createProject, updateProject, deleteProject } from "@/app/actions/profile"

interface ProjectEditorProps {
    profileId: string
    projects: any[] // Using any until prisma client is regenerated
}

export function ProjectEditor({ profileId, projects }: ProjectEditorProps) {
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Projects</h3>
                <Button onClick={() => setIsCreating(true)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Project
                </Button>
            </div>

            {isCreating && (
                <ProjectForm
                    profileId={profileId}
                    onCancel={() => setIsCreating(false)}
                    onSave={() => setIsCreating(false)}
                />
            )}

            <div className="grid gap-4">
                {projects.map((proj) => (
                    <Card key={proj.id}>
                        <CardContent className="p-4">
                            {isEditing === proj.id ? (
                                <ProjectForm
                                    profileId={profileId}
                                    initialData={proj}
                                    onCancel={() => setIsEditing(null)}
                                    onSave={() => setIsEditing(null)}
                                />
                            ) : (
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold">{proj.title}</h4>
                                        <p className="text-sm text-muted-foreground">{proj.client} • {proj.year}</p>
                                        {proj.description && <p className="text-sm mt-2 line-clamp-2">{proj.description}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(proj.id)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProject(proj.id)}>
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

function ProjectForm({ profileId, initialData, onCancel, onSave }: { profileId: string, initialData?: any, onCancel: () => void, onSave: () => void }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        const formData = new FormData(e.currentTarget)
        const data = {
            title: formData.get("title"),
            client: formData.get("client"),
            year: formData.get("year"),
            description: formData.get("description"),
            link: formData.get("link"),
            imageUrl: formData.get("imageUrl"),
        }

        try {
            if (initialData) {
                await updateProject(initialData.id, data)
            } else {
                await createProject(profileId, data)
            }
            onSave()
        } catch (error) {
            console.error(error)
            alert("Failed to save project")
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
                            <Label>Title</Label>
                            <Input name="title" defaultValue={initialData?.title} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Input name="client" defaultValue={initialData?.client} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Year</Label>
                            <Input name="year" defaultValue={initialData?.year} placeholder="e.g. 2024" />
                        </div>
                        <div className="space-y-2">
                            <Label>Link</Label>
                            <Input name="link" defaultValue={initialData?.link} placeholder="https://..." />
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
