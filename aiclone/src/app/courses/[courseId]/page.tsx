import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CourseViewer } from '@/components/courses/course-viewer'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ courseId: string }>
    searchParams: Promise<{ email?: string; lesson?: string }>
}

export default async function CoursePage({ params, searchParams }: Props) {
    const { courseId } = await params
    const { email, lesson: activeLessonId } = await searchParams

    const course = await prisma.course.findUnique({
        where: { id: courseId, isActive: true, isPublished: true },
        include: {
            profile: { select: { displayName: true, slug: true } },
            modules: {
                orderBy: { orderIndex: 'asc' },
                include: {
                    lessons: { orderBy: { orderIndex: 'asc' } }
                }
            }
        }
    })

    if (!course) notFound()

    // Check enrollment
    const enrollment = email ? await prisma.courseEnrollment.findFirst({
        where: {
            courseId,
            visitorEmail: email,
            status: { in: ['ACTIVE', 'COMPLETED'] }
        },
        include: {
            lessonCompletions: { select: { lessonId: true } }
        }
    }) : null
    const completedLessonIds: string[] = enrollment?.lessonCompletions.map(lc => lc.lessonId) ?? []

    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{course.title}</h1>
                        <p className="text-sm text-muted-foreground">by {course.profile.displayName}</p>
                    </div>
                    {enrollment && (
                        <div className="text-sm text-muted-foreground">
                            {completedLessonIds.length}/{totalLessons} lessons completed
                            <div className="w-32 h-2 bg-muted rounded-full mt-1">
                                <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${totalLessons > 0 ? (completedLessonIds.length / totalLessons) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <CourseViewer
                course={course}
                enrolled={!!enrollment}
                enrollmentId={enrollment?.id}
                completedLessonIds={completedLessonIds}
                activeLessonId={activeLessonId}
                email={email}
            />
        </div>
    )
}
