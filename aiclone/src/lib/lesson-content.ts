export type LessonLike = {
    contentType?: string | null
    contentUrl?: string | null
    description?: string | null
    videoUrl?: string | null
    body?: string | null
    fileUrl?: string | null
}

export function lessonVideo(lesson: LessonLike) {
    return lesson.videoUrl || (lesson.contentType === "VIDEO" ? lesson.contentUrl : null) || null
}

export function lessonBody(lesson: LessonLike) {
    if (lesson.body) return lesson.body
    if (lesson.contentType === "TEXT") return lesson.contentUrl || lesson.description || null
    return lesson.description || null
}

export function lessonFile(lesson: LessonLike) {
    return lesson.fileUrl || (lesson.contentType === "PDF" ? lesson.contentUrl : null) || null
}
