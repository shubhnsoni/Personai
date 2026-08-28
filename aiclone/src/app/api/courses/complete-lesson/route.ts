import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    ownershipRefusalResponse,
    requireAuthenticatedUser,
    type OwnershipRefusal,
} from '@/lib/security'

export const dynamic = 'force-dynamic'

const ACCESS_DENIED: OwnershipRefusal = Object.freeze({
    code: 'FORBIDDEN',
    status: 403,
    message: 'Access denied',
})

type CompletionDb = Pick<
    Prisma.TransactionClient,
    'user' | 'member' | 'courseEnrollment' | 'courseLesson' | 'lessonCompletion'
>

type CompleteLessonDependencies = Readonly<{
    requireAuthenticatedUser: typeof requireAuthenticatedUser
    ownershipRefusalResponse: typeof ownershipRefusalResponse
    withTransaction: <Value>(work: (db: CompletionDb) => Promise<Value>) => Promise<Value>
}>

const productionDependencies: CompleteLessonDependencies = {
    requireAuthenticatedUser,
    ownershipRefusalResponse,
    withTransaction: (work) => prisma.$transaction((db) => work(db)),
}

type CompletionResult = Readonly<{
    completedCount: number
    totalLessons: number
}> | null

export function createCompleteLessonPost(
    dependencies: CompleteLessonDependencies = productionDependencies,
) {
    return async function completeLessonPost(request: NextRequest) {
        try {
            const authenticated = await dependencies.requireAuthenticatedUser()
            if (!authenticated.ok) {
                return dependencies.ownershipRefusalResponse(authenticated.refusal)
            }

            let body: unknown
            try {
                body = await request.json()
            } catch {
                return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
            }

            const { enrollmentId, lessonId } = (body ?? {}) as Record<string, unknown>
            if (typeof enrollmentId !== 'string' || typeof lessonId !== 'string') {
                return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
            }

            const result = await dependencies.withTransaction<CompletionResult>(async (db) => {
                const account = await db.user.findUnique({
                    where: { id: authenticated.value.userId },
                    select: { clerkId: true, email: true },
                })
                if (!account) return null

                const member = await db.member.findFirst({
                    where: {
                        OR: [
                            { clerkId: account.clerkId },
                            { email: account.email },
                        ],
                    },
                    select: { id: true },
                })
                if (!member) return null

                const enrollment = await db.courseEnrollment.findFirst({
                    where: {
                        id: enrollmentId,
                        memberId: member.id,
                        status: { in: ['ACTIVE', 'COMPLETED'] },
                        course: {
                            modules: {
                                some: {
                                    lessons: { some: { id: lessonId } },
                                },
                            },
                        },
                    },
                    select: { id: true, courseId: true },
                })
                if (!enrollment) return null

                await db.lessonCompletion.upsert({
                    where: {
                        enrollmentId_lessonId: {
                            enrollmentId: enrollment.id,
                            lessonId,
                        },
                    },
                    create: { enrollmentId: enrollment.id, lessonId },
                    update: {},
                })

                const courseLessons = await db.courseLesson.findMany({
                    where: { module: { courseId: enrollment.courseId } },
                    select: { id: true },
                })
                const totalLessons = courseLessons.length
                const completedCount = await db.lessonCompletion.count({
                    where: {
                        enrollmentId: enrollment.id,
                        lessonId: { in: courseLessons.map((lesson) => lesson.id) },
                    },
                })

                if (totalLessons > 0 && completedCount >= totalLessons) {
                    await db.courseEnrollment.updateMany({
                        where: {
                            id: enrollment.id,
                            courseId: enrollment.courseId,
                            memberId: member.id,
                            status: { in: ['ACTIVE', 'COMPLETED'] },
                        },
                        data: { status: 'COMPLETED', completedAt: new Date() },
                    })
                }

                return { completedCount, totalLessons }
            })

            if (!result) return dependencies.ownershipRefusalResponse(ACCESS_DENIED)
            return NextResponse.json({ success: true, ...result })
        } catch (error) {
            console.error('Lesson completion error:', error)
            return NextResponse.json({ error: 'Failed to mark lesson complete' }, { status: 500 })
        }
    }
}

export const POST = createCompleteLessonPost()
