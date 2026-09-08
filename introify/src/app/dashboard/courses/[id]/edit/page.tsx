import { redirect, notFound } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { CourseForm } from "@/components/dashboard/course-form"
import { CourseCurriculum } from "@/components/dashboard/course-curriculum"
import { CourseStudents } from "@/components/dashboard/course-students"
import { CourseStudio } from "@/components/dashboard/course-studio"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = "force-dynamic"

export default async function EditCoursePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string }>
}) {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "courses", profile)

    const { id } = await params
    const { tab } = await searchParams
    const { prisma } = await import("@/lib/prisma")
    const course = await prisma.course.findFirst({
        where: { id, profileId: profile.id },
        include: {
            modules: {
                orderBy: { orderIndex: "asc" },
                include: {
                    lessons: { orderBy: { orderIndex: "asc" } },
                },
            },
            _count: { select: { enrollments: true } },
        },
    })

    if (!course) notFound()

    const { modules, _count, ...courseFields } = course
    const lessons = modules.reduce((n, m) => n + m.lessons.length, 0)
    const mins = modules.reduce((n, m) => n + m.lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0), 0)
    const live = course.isPublished && course.isActive
    const defaultTab = tab === "curriculum" || tab === "students" ? tab : "landing"
    const enrollUrl = `/${profile.slug}/courses/${course.id}`

    const hours =
        mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`

    return (
        <div className="flex-1">
            <CourseStudio
                title={course.title}
                meta={`${modules.length} modules · ${lessons} lessons${mins ? ` · ${hours}` : ""} · ${_count.enrollments} students`}
                live={live}
                defaultTab={defaultTab}
                landing={<CourseForm profileId={profile.id} course={courseFields} embedded />}
                curriculum={<CourseCurriculum courseId={course.id} modules={modules} />}
                students={<CourseStudents courseId={course.id} enrollUrl={enrollUrl} />}
            />
        </div>
    )
}
