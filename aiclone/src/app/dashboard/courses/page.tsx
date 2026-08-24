import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { CoursesList } from "@/components/dashboard/courses-list"
import { requireSurface } from "@/lib/require-surface"

export const dynamic = 'force-dynamic'

export default async function DashboardCoursesPage() {
    const user = await syncUser()
    if (!user) redirect("/sign-in")

    const profile = user.profiles[0]
    if (!profile) redirect("/onboarding")
    requireSurface(profile.roleTemplate, "courses", profile)

    const { prisma } = await import("@/lib/prisma")
    const courses = await prisma.course.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: {
                    modules: true,
                    enrollments: true,
                }
            },
            modules: {
                include: {
                    _count: {
                        select: {
                            lessons: true
                        }
                    }
                }
            }
        }
    })

    const coursesWithLessonCount = courses.map(course => ({
        ...course,
        totalLessonCount: course.modules.reduce(
            (total, mod) => total + mod._count.lessons,
            0
        ),
        modules: undefined
    }))

    return (
        <div className="flex-1 space-y-4">
            <CoursesList slug={profile.slug} profileId={profile.id} courses={coursesWithLessonCount} />
        </div>
    )
}
