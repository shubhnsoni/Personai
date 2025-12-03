"use client"

import { useState } from "react"
import Link from "next/link"
import { Course } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Pencil,
    Trash2,
    BookOpen,
    Users,
    Layers,
    FileText,
} from "lucide-react"
import { deleteCourse } from "@/app/actions/courses"

interface CourseWithCounts extends Course {
    _count: {
        modules: number
        enrollments: number
    }
    totalLessonCount: number
}

interface CoursesListProps {
    profileId: string
    courses: CourseWithCounts[]
}

export function CoursesList({ profileId, courses }: CoursesListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this course? This will also delete all modules and lessons.")) return

        setDeletingId(id)
        try {
            await deleteCourse(id)
        } catch (error) {
            console.error("Failed to delete course:", error)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Courses</h2>
                    <p className="text-muted-foreground">
                        Create and manage courses with modules and lessons for your students.
                    </p>
                </div>
                <Link href="/dashboard/courses/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Course
                    </Button>
                </Link>
            </div>

            {courses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No courses yet</h3>
                        <p className="text-muted-foreground text-center mb-4 max-w-sm">
                            Start teaching by creating your first course. Add modules and lessons
                            to build a structured learning experience.
                        </p>
                        <Link href="/dashboard/courses/new">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Create Your First Course
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course) => {
                        const isDeleting = deletingId === course.id

                        return (
                            <Card key={course.id} className="relative overflow-hidden">
                                {course.thumbnailUrl ? (
                                    <div className="aspect-video w-full overflow-hidden bg-muted">
                                        <img
                                            src={course.thumbnailUrl}
                                            alt={course.title}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                )}

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-base font-medium line-clamp-2">
                                            {course.title}
                                        </CardTitle>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="font-bold text-lg">
                                            {course.priceCents === 0
                                                ? "Free"
                                                : `$${(course.priceCents / 100).toFixed(2)}`}
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <Users className="mr-1 h-3 w-3" />
                                            {course._count.enrollments} enrolled
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center">
                                            <Layers className="mr-1 h-3 w-3" />
                                            {course._count.modules} modules
                                        </div>
                                        <div className="flex items-center">
                                            <FileText className="mr-1 h-3 w-3" />
                                            {course.totalLessonCount} lessons
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant={course.isActive ? "default" : "secondary"}>
                                            {course.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge variant={course.isPublished ? "default" : "outline"}>
                                            {course.isPublished ? "Published" : "Draft"}
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/courses/${course.id}/edit`}
                                            className="flex-1"
                                        >
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(course.id)}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
