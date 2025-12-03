"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Course } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { createCourse, updateCourse, type CourseData } from "@/app/actions/courses"

interface CourseFormProps {
    profileId: string
    course?: Course
}

export function CourseForm({ profileId, course }: CourseFormProps) {
    const router = useRouter()
    const isEditing = !!course

    const [title, setTitle] = useState(course?.title || "")
    const [description, setDescription] = useState(course?.description || "")
    const [price, setPrice] = useState(
        course ? (course.priceCents / 100).toString() : ""
    )
    const [thumbnailUrl, setThumbnailUrl] = useState(course?.thumbnailUrl || "")
    const [isActive, setIsActive] = useState(course?.isActive ?? true)
    const [isPublished, setIsPublished] = useState(course?.isPublished ?? false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setIsSubmitting(true)
        try {
            const data: CourseData = {
                title: title.trim(),
                description: description.trim() || undefined,
                price: parseFloat(price) || 0,
                thumbnailUrl: thumbnailUrl.trim() || undefined,
                isActive,
                isPublished,
            }

            if (isEditing && course) {
                await updateCourse(course.id, data)
            } else {
                await createCourse(profileId, data)
            }

            router.push("/dashboard/courses")
            router.refresh()
        } catch (error) {
            console.error("Failed to save course:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        router.push("/dashboard/courses")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEditing ? "Edit Course" : "Create New Course"}</CardTitle>
                <CardDescription>
                    {isEditing
                        ? "Update your course details."
                        : "Add a new course for your students to enroll in."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Complete Web Development Bootcamp"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe your course content, what students will learn..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">Price (USD)</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Set to 0 for a free course
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                        <Input
                            id="thumbnailUrl"
                            type="url"
                            placeholder="https://example.com/course-thumbnail.jpg"
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Cover image for your course
                        </p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isActive">Active</Label>
                            <p className="text-sm text-muted-foreground">
                                Make this course visible to your audience
                            </p>
                        </div>
                        <Switch
                            id="isActive"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="isPublished">Published</Label>
                            <p className="text-sm text-muted-foreground">
                                Allow students to enroll in this course
                            </p>
                        </div>
                        <Switch
                            id="isPublished"
                            checked={isPublished}
                            onCheckedChange={setIsPublished}
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
                                ? "Update Course"
                                : "Create Course"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
