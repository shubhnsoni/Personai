"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Pencil } from "lucide-react"
import { createProject, updateProject, deleteProject } from "@/app/actions/profile"
import type { Project } from "@prisma/client"

interface ProjectEditorProps {
    profileId: string
    projects: Project[]
}

export function ProjectEditor({ profileId, projects }: ProjectEditorProps) {
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    return (
        <Card className="gap-4 py-4 shadow-none">
            <CardHeader className="px-4">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
                <CardDescription>Work the chat can walk through.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
                {isCreating && (
                    <ProjectForm
                        profileId={profileId}
                        onCancel={() => setIsCreating(false)}
                        onSave={() => setIsCreating(false)}
                    />
                )}

                {projects.length > 0 ? (
                    <div className="divide-y overflow-hidden rounded-xl border">
                        {projects.map((proj) => (
                            <div key={proj.id} className="p-3">
                                {isEditing === proj.id ? (
                                    <ProjectForm
                                        profileId={profileId}
                                        initialData={proj}
                                        onCancel={() => setIsEditing(null)}
                                        onSave={() => setIsEditing(null)}
                                    />
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-sm font-medium">{proj.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {[proj.client, proj.year].filter(Boolean).join(" · ")}
                                            </p>
                                            {proj.description ? (
                                                <p className="line-clamp-2 text-xs text-muted-foreground">{proj.description}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(proj.id)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProject(proj.id)}>
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
                        No projects yet.
                    </p>
                ) : null}

                {!isCreating && (
                    <Button type="button" variant="outline" className="h-9 w-full rounded-full" onClick={() => setIsCreating(true)}>
                        <Plus className="mr-1 h-4 w-4" /> Add project
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

function ProjectForm({ profileId, initialData, onCancel, onSave }: { profileId: string, initialData?: Project, onCancel: () => void, onSave: () => void }) {
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (root: HTMLElement) => {
        setIsLoading(true)
        const val = (name: string) =>
            (root.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ""
        const data = {
            title: val("title"),
            client: val("client"),
            year: val("year"),
            description: val("description"),
            link: val("link"),
            imageUrl: val("imageUrl"),
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
        <div className="space-y-3 rounded-xl border border-dashed p-3" data-proj-form>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input name="title" defaultValue={initialData?.title} required />
                </div>
                <div className="space-y-1.5">
                    <Label>Client</Label>
                    <Input name="client" defaultValue={initialData?.client ?? ""} />
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Year</Label>
                    <Input name="year" defaultValue={initialData?.year ?? ""} placeholder="2024" />
                </div>
                <div className="space-y-1.5">
                    <Label>Link</Label>
                    <Input name="link" defaultValue={initialData?.link ?? ""} placeholder="https://" />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input name="imageUrl" defaultValue={initialData?.imageUrl ?? ""} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={initialData?.description ?? ""} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={isLoading}
                    onClick={(e) => {
                        const root = e.currentTarget.closest("[data-proj-form]") as HTMLElement | null
                        if (root) void handleSubmit(root)
                    }}
                >
                    {isLoading ? "Saving..." : "Save"}
                </Button>
            </div>
        </div>
    )
}
