import { prisma } from "@/lib/prisma"
import { CourseRoster, type RosterStudent } from "@/components/dashboard/course-roster"

export async function CourseStudents({ courseId, enrollUrl }: { courseId: string; enrollUrl: string }) {
    const enrollments = await prisma.courseEnrollment.findMany({
        where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
        include: {
            member: true,
            lessonCompletions: true,
            course: { include: { modules: { include: { _count: { select: { lessons: true } } } } } },
        },
        orderBy: { enrolledAt: "desc" },
    })
    const totalLessons = enrollments[0]?.course.modules.reduce((n, m) => n + m._count.lessons, 0) ?? 0

    const students: RosterStudent[] = enrollments.map((e) => {
        const last = e.lessonCompletions.reduce<Date | null>((latest, c) => {
            return !latest || c.completedAt > latest ? c.completedAt : latest
        }, null)
        return {
            id: e.id,
            name: e.visitorName || e.member?.name || e.visitorEmail.split("@")[0] || "Student",
            email: e.visitorEmail,
            status: e.status,
            done: e.lessonCompletions.length,
            total: totalLessons,
            enrolledAt: e.enrolledAt.toISOString(),
            lastAt: last?.toISOString() ?? null,
            completedAt: e.completedAt?.toISOString() ?? null,
        }
    })

    return <CourseRoster students={students} enrollUrl={enrollUrl} />
}
