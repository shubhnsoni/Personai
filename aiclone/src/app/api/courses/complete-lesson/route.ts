import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const { enrollmentId, lessonId } = await request.json()
        if (!enrollmentId || !lessonId) {
            return NextResponse.json({ error: 'Missing enrollmentId or lessonId' }, { status: 400 })
        }

        const enrollment = await prisma.courseEnrollment.findUnique({
            where: { id: enrollmentId },
            include: { course: { include: { modules: { include: { lessons: true } } } } }
        })
        if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
            return NextResponse.json({ error: 'Invalid enrollment' }, { status: 404 })
        }

        // Create completion record
        await prisma.lessonCompletion.upsert({
            where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
            create: { enrollmentId, lessonId },
            update: {},
        })

        // Check if all lessons are completed
        const totalLessons = enrollment.course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
        const completedCount = await prisma.lessonCompletion.count({ where: { enrollmentId } })

        if (completedCount >= totalLessons && totalLessons > 0) {
            await prisma.courseEnrollment.update({
                where: { id: enrollmentId },
                data: { status: 'COMPLETED', completedAt: new Date() },
            })
        }

        return NextResponse.json({ success: true, completedCount, totalLessons })
    } catch (error) {
        console.error('Lesson completion error:', error)
        return NextResponse.json({ error: 'Failed to mark lesson complete' }, { status: 500 })
    }
}
