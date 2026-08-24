'use client'

import { useState } from 'react'
import { lessonBody, lessonFile, lessonVideo } from "@/lib/lesson-content"

interface Lesson {
    id: string
    title: string
    description: string | null
    contentType: string
    contentUrl: string | null
    videoUrl?: string | null
    body?: string | null
    fileUrl?: string | null
    durationMinutes: number
    isFree: boolean
}

interface Module {
    id: string
    title: string
    description: string | null
    lessons: Lesson[]
}

interface CourseViewerProps {
    course: {
        id: string
        title: string
        description: string | null
        modules: Module[]
    }
    enrolled: boolean
    enrollmentId?: string | null
    completedLessonIds: string[]
    activeLessonId?: string
    email?: string
}

export function CourseViewer({
    course,
    enrolled,
    enrollmentId,
    completedLessonIds: initialCompleted,
    activeLessonId,
    email,
}: CourseViewerProps) {
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompleted))
    const [completing, setCompleting] = useState<string | null>(null)

    // Find active lesson or default to first
    const allLessons = course.modules.flatMap(m => m.lessons)
    const defaultLesson = activeLessonId
        ? allLessons.find(l => l.id === activeLessonId)
        : allLessons[0]
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(defaultLesson || null)

    const canAccessLesson = (lesson: Lesson) => enrolled || lesson.isFree

    async function markComplete(lessonId: string) {
        if (!enrollmentId || completedIds.has(lessonId)) return
        setCompleting(lessonId)
        try {
            const res = await fetch('/api/courses/complete-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollmentId, lessonId }),
            })
            if (res.ok) {
                setCompletedIds(prev => new Set([...prev, lessonId]))
            }
        } catch (e) {
            console.error('Failed to mark complete:', e)
        } finally {
            setCompleting(null)
        }
    }

    return (
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-0 lg:gap-6 p-0 lg:p-6">
            {/* Sidebar */}
            <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r bg-card lg:rounded-xl lg:shadow overflow-y-auto max-h-[40vh] lg:max-h-[calc(100vh-120px)]">
                <div className="p-4">
                    <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Course Content</h2>
                    {course.modules.map((mod) => (
                        <div key={mod.id} className="mb-4">
                            <h3 className="font-medium text-sm mb-2">{mod.title}</h3>
                            <div className="space-y-1">
                                {mod.lessons.map((lesson) => {
                                    const accessible = canAccessLesson(lesson)
                                    const isActive = activeLesson?.id === lesson.id
                                    const isCompleted = completedIds.has(lesson.id)
                                    return (
                                        <button
                                            key={lesson.id}
                                            onClick={() => accessible && setActiveLesson(lesson)}
                                            disabled={!accessible}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                                isActive
                                                    ? 'bg-primary text-primary-foreground'
                                                    : accessible
                                                    ? 'hover:bg-muted'
                                                    : 'opacity-50 cursor-not-allowed'
                                            }`}
                                        >
                                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs ${
                                                isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/30'
                                            }`}>
                                                {isCompleted ? '✓' : ''}
                                            </span>
                                            <span className="flex-1 truncate">{lesson.title}</span>
                                            {lesson.isFree && !enrolled && (
                                                <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">Free</span>
                                            )}
                                            {!accessible && <span className="text-xs">🔒</span>}
                                            {lesson.durationMinutes > 0 && (
                                                <span className="text-xs text-muted-foreground">{lesson.durationMinutes}m</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-4 lg:p-0">
                {activeLesson ? (
                    <div>
                        <h2 className="text-2xl font-bold mb-2">{activeLesson.title}</h2>
                        {(() => {
                            const video = lessonVideo(activeLesson)
                            const notes = lessonBody(activeLesson)
                            const file = lessonFile(activeLesson)
                            return (
                                <>
                        {video ? (
                            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                                {video.includes('youtube.com') || video.includes('youtu.be') ? (
                                    <iframe
                                        src={getYouTubeEmbedUrl(video)}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : video.includes('vimeo.com') ? (
                                    <iframe
                                        src={getVimeoEmbedUrl(video)}
                                        className="w-full h-full"
                                        allow="autoplay; fullscreen; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video src={video} controls className="w-full h-full" />
                                )}
                            </div>
                        ) : (
                            <div className="aspect-video mb-6 flex items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
                                Add a video URL in the course studio
                            </div>
                        )}

                        {notes && (
                            <div className="prose prose-sm dark:prose-invert max-w-none bg-card rounded-xl p-6 border mb-6">
                                <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(notes) }} />
                            </div>
                        )}

                        {file && (
                            <div className="bg-card rounded-xl border p-6 mb-6">
                                <a
                                    href={file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    📄 Open PDF
                                </a>
                            </div>
                        )}
                                </>
                            )
                        })()}

                        {/* Complete button */}
                        {enrolled && enrollmentId && (
                            <div className="mt-6 flex items-center gap-4">
                                <button
                                    onClick={() => markComplete(activeLesson.id)}
                                    disabled={completedIds.has(activeLesson.id) || completing === activeLesson.id}
                                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                        completedIds.has(activeLesson.id)
                                            ? 'bg-green-500/10 text-green-600 cursor-default'
                                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    }`}
                                >
                                    {completedIds.has(activeLesson.id)
                                        ? '✓ Completed'
                                        : completing === activeLesson.id
                                        ? 'Saving...'
                                        : 'Mark as Complete'}
                                </button>

                                {/* Next lesson */}
                                {(() => {
                                    const idx = allLessons.findIndex(l => l.id === activeLesson.id)
                                    const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null
                                    return next ? (
                                        <button
                                            onClick={() => setActiveLesson(next)}
                                            className="px-4 py-2 rounded-lg border hover:bg-muted transition-colors text-sm"
                                        >
                                            Next: {next.title} →
                                        </button>
                                    ) : null
                                })()}
                            </div>
                        )}

                        {!enrolled && !activeLesson.isFree && (
                            <div className="mt-6 p-6 bg-muted/50 rounded-xl border text-center">
                                <p className="text-muted-foreground mb-3">Enroll in this course to access all lessons</p>
                                <a
                                    href={`/api/stripe/purchase?itemType=course&itemId=${course.id}&visitorEmail=${email || ''}`}
                                    className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                                >
                                    Enroll Now
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-20">
                        <p className="text-lg">Select a lesson to get started</p>
                    </div>
                )}
            </main>
        </div>
    )
}

function getYouTubeEmbedUrl(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

function getVimeoEmbedUrl(url: string): string {
    const match = url.match(/vimeo\.com\/(\d+)/)
    return match ? `https://player.vimeo.com/video/${match[1]}` : url
}

function simpleMarkdown(text: string): string {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>').replace(/$/, '</p>')
}
