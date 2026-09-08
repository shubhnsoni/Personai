import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { CourseViewer } from "@/components/courses/course-viewer"
import { LearnerAccessService } from "@/lib/cohorts/access"
import { getMemberFromSession } from "@/lib/members"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * The learner content reader.
 *
 * BEFORE Wave G3 this page returned every module and every lesson of any course the learner was
 * enrolled on. Access tiers now exist, so it consults them - which is the difference between tiers
 * being enforceable and tiers being enforced, and there is no point having the first without the
 * second.
 *
 * A lesson with no access rule is visible to everybody, so every course that has not had tiers
 * configured behaves exactly as it did before. That is why this change needs no data migration and
 * cannot have altered what any existing learner sees.
 *
 * Lessons above the learner's tier are REMOVED from the tree rather than shown as locked, because
 * CourseViewer has no locked state and inventing one here would mean two components disagreeing
 * about how a lock looks. The count is surfaced instead, so a learner is told that content exists
 * above their tier rather than silently served a shorter course - being quietly given less is worse
 * than being told what you cannot see.
 */
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

    // The same computation the owner console and the access API use, so the three cannot disagree
    // about what this learner paid for.
    const report = await new LearnerAccessService(prisma).visibleLessons({
        courseId: course.id,
        memberId: member.id,
        memberEmail: member.email,
    })
    const visible = new Set(report.lessons.filter((lesson) => lesson.visible).map((lesson) => lesson.lessonId))
    const lockedCount = report.lockedCount

    const gated = {
        ...course,
        modules: course.modules
            .map((module) => ({ ...module, lessons: module.lessons.filter((lesson) => visible.has(lesson.id)) }))
            // A module whose every lesson is above the learner's tier is dropped rather than
            // rendered empty, because an empty module reads as a broken course.
            .filter((module) => module.lessons.length > 0),
    }

    return (
        <div className="min-h-dvh bg-background">
            <div className="border-b px-4 py-3">
                <Link href="/library" className="text-sm text-muted-foreground">
                    ← Library
                </Link>
            </div>
            {lockedCount > 0 ? (
                <p className="border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
                    {lockedCount} {lockedCount === 1 ? "lesson is" : "lessons are"} not included in your current access
                    level
                    {report.heldLevelKey ? ` (${report.heldLevelKey})` : ""}. Ask {course.profile.displayName} about
                    upgrading.
                </p>
            ) : null}
            <CourseViewer
                course={gated}
                enrolled
                enrollmentId={enrollment.id}
                completedLessonIds={enrollment.lessonCompletions
                    .map((c) => c.lessonId)
                    .filter((lessonId) => visible.has(lessonId))}
                email={member.email}
            />
        </div>
    )
}
