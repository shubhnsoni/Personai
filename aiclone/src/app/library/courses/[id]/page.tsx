import { notFound, redirect } from "next/navigation"
import { getMemberFromSession } from "@/lib/members"
import { prisma } from "@/lib/prisma"
import { CourseViewer } from "@/components/courses/course-viewer"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function LibraryCoursePage({ params }: { params: Promise<{ id: string }> }) {
    const member = await getMemberFromSession()
    if (!member) redirect("/library/login")
    const { id } = await params

    const enrollment = await prisma.courseEnrollment.findFirst({
        where: {
            courseId: id,
            OR: [{ memberId: member.id }, { visitorEmail: member.email }],
            status: { in: ["ACTIVE", "COMPLETED"] },
        },
        include: { lessonCompletions: { select: { lessonId: true } } },
    })
    if (!enrollment) notFound()

    const course = await prisma.course.findUnique({
        where: { id },
        include: {
            profile: { select: { displayName: true, slug: true } },
            modules: {
                orderBy: { orderIndex: "asc" },
                include: { lessons: { orderBy: { orderIndex: "asc" } } },
            },
        },
    })
    if (!course) notFound()

    return (
        <div className="min-h-dvh bg-background">
            <div className="border-b px-4 py-3">
                <Link href="/library" className="text-sm text-muted-foreground">← Library</Link>
            </div>
            <CourseViewer
                course={course}
                enrolled
                enrollmentId={enrollment.id}
                completedLessonIds={enrollment.lessonCompletions.map((c) => c.lessonId)}
                email={member.email}
            />
        </div>
    )
}
