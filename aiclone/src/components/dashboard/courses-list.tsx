"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Course } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { BookOpen, Copy, ExternalLink, Plus, Trash2, Upload } from "lucide-react"
import { deleteCourse, setCoursePublished } from "@/app/actions/courses"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { CatalogSearch, FilterChips, ViewToggle, useCatalogView } from "@/components/dashboard/catalog-chrome"
import { OfferCover } from "@/components/dashboard/offer-cover"
import { CourseForm } from "@/components/dashboard/course-form"
import { useMoney } from "@/components/pricing-provider"
import { toast } from "sonner"

interface CourseWithCounts extends Course {
    _count: { modules: number; enrollments: number }
    totalLessonCount: number
}

export function CoursesList({ slug, profileId, courses }: { slug: string; profileId: string; courses: CourseWithCounts[] }) {
    const [view, setView] = useCatalogView("pl-courses-view")
    const [q, setQ] = useState("")
    const [filter, setFilter] = useState<"all" | "live" | "draft" | "free">("all")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const [adding, setAdding] = useState(false)

    const live = courses.filter((c) => c.isPublished && c.isActive).length
    const enrolled = courses.reduce((s, c) => s + (c._count.enrollments || 0), 0)

    const rows = useMemo(() => {
        return courses.filter((c) => {
            const isLive = c.isPublished && c.isActive
            if (filter === "live" && !isLive) return false
            if (filter === "draft" && isLive) return false
            if (filter === "free" && c.priceCents > 0) return false
            if (!q.trim()) return true
            const hay = `${c.title} ${c.subtitle || ""} ${c.description || ""}`.toLowerCase()
            return hay.includes(q.trim().toLowerCase())
        })
    }, [courses, filter, q])

    const remove = async (id: string) => {
        if (!confirm("Delete this course? Modules and lessons go with it.")) return
        setDeletingId(id)
        try {
            await deleteCourse(id)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <CatalogSearch value={q} onChange={setQ} />
                <ViewToggle view={view} onChange={setView} />
            </div>
            <FilterChips
                value={filter}
                onChange={setFilter}
                count={`${live} live · ${enrolled} enrolled`}
                items={[
                    { id: "all", label: "All" },
                    { id: "live", label: "Live" },
                    { id: "draft", label: "Draft" },
                    { id: "free", label: "Free" },
                ]}
            />

            {rows.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<BookOpen />}
                        title={courses.length === 0 ? "Nothing to teach yet" : "Nothing matches"}
                        description={courses.length === 0 ? "Add a course people can enroll in from chat or your catalog." : "Try another search or filter."}
                    />
                </div>
            ) : view === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    {rows.map((course) => (
                        <CourseRow
                            key={course.id}
                            course={course}
                            deleting={deletingId === course.id}
                            pending={pending}
                            onToggle={(on) => startTransition(async () => { await setCoursePublished(course.id, on) })}
                            onDelete={() => remove(course.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {rows.map((course) => (
                        <CourseTile
                            key={course.id}
                            course={course}
                            deleting={deletingId === course.id}
                            pending={pending}
                            onToggle={(on) => startTransition(async () => { await setCoursePublished(course.id, on) })}
                            onDelete={() => remove(course.id)}
                        />
                    ))}
                </div>
            )}

            <StudioDock>
                <DockTabs
                    tabs={[
                        {
                            id: "copy",
                            label: "Copy",
                            icon: <Copy />,
                            onClick: async () => {
                                const url = `${window.location.origin}/${slug}/courses`
                                try {
                                    await navigator.clipboard.writeText(url)
                                    toast.success("Courses link copied")
                                } catch {
                                    toast.error(url)
                                }
                            },
                        },
                        { id: "import", label: "Import", icon: <Upload />, href: "/dashboard/import" },
                        { id: "live", label: "Live", icon: <ExternalLink />, href: `/${slug}/courses`, target: "_blank" },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
            </StudioDock>
            <CourseForm open={adding} onOpenChange={setAdding} profileId={profileId} />
        </div>
    )
}

function meta(course: CourseWithCounts, money: (cents: number) => string) {
    const live = course.isPublished && course.isActive
    return [
        money(course.priceCents),
        `${course.totalLessonCount} lessons`,
        live ? null : "Draft",
    ].filter(Boolean).join(" · ")
}

function CourseRow({
    course,
    deleting,
    pending,
    onToggle,
    onDelete,
}: {
    course: CourseWithCounts
    deleting: boolean
    pending: boolean
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const live = course.isPublished && course.isActive
    const money = useMoney()
    return (
        <div className="flex items-center gap-2.5 border-b border-border/50 px-2.5 py-2 last:border-b-0">
            <Link href={`/dashboard/courses/${course.id}/edit`} className="shrink-0">
                <OfferCover src={course.thumbnailUrl} kind={course.level || "COURSE"} title={course.title} hideIcon className="h-12 w-12 rounded-xl" />
            </Link>
            <Link href={`/dashboard/courses/${course.id}/edit`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{course.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{meta(course, money)}</p>
            </Link>
            <Switch checked={live} disabled={pending} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

function CourseTile({
    course,
    deleting,
    pending,
    onToggle,
    onDelete,
}: {
    course: CourseWithCounts
    deleting: boolean
    pending: boolean
    onToggle: (on: boolean) => void
    onDelete: () => void
}) {
    const live = course.isPublished && course.isActive
    const money = useMoney()
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <Link href={`/dashboard/courses/${course.id}/edit`} className="block">
                <OfferCover src={course.thumbnailUrl} kind={course.level || "COURSE"} title={course.title} className="aspect-square w-full" />
            </Link>
            <div className="flex flex-col gap-3 p-3">
                <Link href={`/dashboard/courses/${course.id}/edit`} className="min-h-[2.75rem]">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{course.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{meta(course, money)}</p>
                </Link>
                <div className="flex items-center justify-between pt-0.5">
                    <Switch checked={live} disabled={pending} onCheckedChange={onToggle} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={onDelete} disabled={deleting}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
