"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    Film,
    Layers,
    Pencil,
    Play,
    Plus,
    Trash2,
    Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import {
    createCourseLesson,
    createCourseModule,
    deleteCourseLesson,
    deleteCourseModule,
    importModulesIntoCourse,
    moveCourseLesson,
    moveCourseModule,
    updateCourseLesson,
    updateCourseModule,
    type LessonData,
} from "@/app/actions/courses"
type Lesson = {
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

type Module = {
    id: string
    title: string
    description: string | null
    lessons: Lesson[]
}

type SheetState =
    | { kind: "module"; module?: Module }
    | { kind: "lesson"; moduleId: string; lesson?: Lesson }
    | { kind: "import" }
    | null

function kindOf(lesson: Lesson) {
    if (lesson.videoUrl || lesson.contentType === "VIDEO") return "video" as const
    if (lesson.fileUrl || lesson.contentType === "PDF") return "file" as const
    return "notes" as const
}

function formatMins(total: number) {
    if (!total) return "0m"
    if (total < 60) return `${total}m`
    const h = Math.floor(total / 60)
    const m = total % 60
    return m ? `${h}h ${m}m` : `${h}h`
}

export function CourseCurriculum({ courseId, modules }: { courseId: string; modules: Module[] }) {
    const router = useRouter()
    const [openId, setOpenId] = useState<string | null>(modules[0]?.id ?? null)
    const [sheet, setSheet] = useState<SheetState>(null)
    const [busy, setBusy] = useState(false)

    const stats = useMemo(() => {
        const lessons = modules.reduce((n, m) => n + m.lessons.length, 0)
        const mins = modules.reduce((n, m) => n + m.lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0), 0)
        const free = modules.reduce((n, m) => n + m.lessons.filter((l) => l.isFree).length, 0)
        return { modules: modules.length, lessons, mins, free }
    }, [modules])

    async function run(fn: () => Promise<unknown>, ok?: string) {
        setBusy(true)
        try {
            await fn()
            router.refresh()
            if (ok) toast.success(ok)
        } catch {
            toast.error("Could not save")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-border/70 bg-card">
                {[
                    { label: "Modules", value: String(stats.modules) },
                    { label: "Lessons", value: String(stats.lessons) },
                    { label: "Length", value: formatMins(stats.mins) },
                    { label: "Free", value: String(stats.free) },
                ].map((item) => (
                    <div key={item.label} className="border-r border-border/50 px-2 py-2.5 text-center last:border-r-0">
                        <p className="text-sm font-medium tabular-nums">{item.value}</p>
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                ))}
            </div>

            {modules.length === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                    <EmptyState
                        icon={<Layers />}
                        title="No syllabus yet"
                        description="Add a module, or paste an outline and we’ll build the sections."
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    {modules.map((mod, index) => {
                        const open = openId === mod.id
                        const mins = mod.lessons.reduce((n, l) => n + (l.durationMinutes || 0), 0)
                        return (
                            <div key={mod.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                                <div className="flex items-center gap-1 pr-1">
                                    <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"
                                        onClick={() => setOpenId(open ? null : mod.id)}
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D7FF]/12 text-[11px] font-semibold tabular-nums text-[#00D7FF]">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{mod.title}</span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
                                                {mins ? ` · ${formatMins(mins)}` : ""}
                                            </span>
                                        </span>
                                    </button>
                                    <div className="flex shrink-0">
                                        <IconBtn
                                            label="Move up"
                                            disabled={index === 0 || busy}
                                            onClick={() => run(() => moveCourseModule(mod.id, -1))}
                                        >
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        </IconBtn>
                                        <IconBtn
                                            label="Move down"
                                            disabled={index === modules.length - 1 || busy}
                                            onClick={() => run(() => moveCourseModule(mod.id, 1))}
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </IconBtn>
                                        <IconBtn label="Edit module" onClick={() => setSheet({ kind: "module", module: mod })}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </IconBtn>
                                    </div>
                                </div>

                                {open ? (
                                    <div className="space-y-1 border-t border-border/50 px-2 py-2">
                                        {mod.description ? (
                                            <p className="px-2 pb-1 text-xs text-muted-foreground">{mod.description}</p>
                                        ) : null}
                                        {mod.lessons.map((lesson, li) => (
                                            <LessonRow
                                                key={lesson.id}
                                                lesson={lesson}
                                                index={li}
                                                last={li === mod.lessons.length - 1}
                                                busy={busy}
                                                onOpen={() => setSheet({ kind: "lesson", moduleId: mod.id, lesson })}
                                                onUp={() => run(() => moveCourseLesson(lesson.id, -1))}
                                                onDown={() => run(() => moveCourseLesson(lesson.id, 1))}
                                                onDelete={() => {
                                                    if (!confirm("Delete this lesson?")) return
                                                    return run(() => deleteCourseLesson(lesson.id), "Lesson deleted")
                                                }}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            onClick={() => setSheet({ kind: "lesson", moduleId: mod.id })}
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Add lesson
                                        </button>
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] text-destructive/80 hover:bg-destructive/5"
                                            onClick={() => {
                                                if (!confirm("Delete this module and its lessons?")) return
                                                void run(() => deleteCourseModule(mod.id), "Module deleted")
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" /> Delete module
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}

            <StudioDock>
                <DockTabs
                    tabs={[
                        { id: "import", label: "Import", icon: <Upload />, onClick: () => setSheet({ kind: "import" }) },
                    ]}
                />
                <Button className="shrink-0 rounded-full" onClick={() => setSheet({ kind: "module" })}>
                    <Plus className="mr-1 h-4 w-4" /> Add module
                </Button>
            </StudioDock>

            <Sheet open={!!sheet} onOpenChange={(open) => !open && setSheet(null)}>
                <SheetContent
                    side="bottom"
                    className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl border-border/70 p-0"
                >
                    {sheet?.kind === "module" ? (
                        <ModuleSheet
                            module={sheet.module}
                            busy={busy}
                            onClose={() => setSheet(null)}
                            onSave={async (data) => {
                                if (sheet.module) {
                                    await run(() => updateCourseModule(sheet.module!.id, data), "Module saved")
                                } else {
                                    await run(() => createCourseModule(courseId, data), "Module added")
                                }
                                setSheet(null)
                            }}
                        />
                    ) : null}
                    {sheet?.kind === "lesson" ? (
                        <LessonSheet
                            lesson={sheet.lesson}
                            busy={busy}
                            onClose={() => setSheet(null)}
                            onSave={async (data) => {
                                if (sheet.lesson) {
                                    await run(() => updateCourseLesson(sheet.lesson!.id, data), "Lesson saved")
                                } else {
                                    await run(() => createCourseLesson(sheet.moduleId, data), "Lesson added")
                                }
                                setSheet(null)
                            }}
                        />
                    ) : null}
                    {sheet?.kind === "import" ? (
                        <ImportSheet
                            busy={busy}
                            onClose={() => setSheet(null)}
                            onSave={async (outline) => {
                                await run(() => importModulesIntoCourse(courseId, outline), "Outline added")
                                setSheet(null)
                            }}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function IconBtn({
    label,
    children,
    disabled,
    onClick,
}: {
    label: string
    children: React.ReactNode
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
            {children}
        </button>
    )
}

function LessonRow({
    lesson,
    index,
    last,
    busy,
    onOpen,
    onUp,
    onDown,
    onDelete,
}: {
    lesson: Lesson
    index: number
    last: boolean
    busy: boolean
    onOpen: () => void
    onUp: () => void
    onDown: () => void
    onDelete: () => void
}) {
    const kind = kindOf(lesson)
    const Icon = kind === "video" ? Film : kind === "file" ? FileText : Play
    return (
        <div className="flex items-center gap-1 rounded-xl px-1 hover:bg-muted/40">
            <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{lesson.title}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="capitalize">{kind}</span>
                        {lesson.durationMinutes ? (
                            <>
                                <span>·</span>
                                <Clock className="h-2.5 w-2.5" />
                                {formatMins(lesson.durationMinutes)}
                            </>
                        ) : null}
                        {lesson.isFree ? <span className="rounded-full bg-[#00D7FF]/15 px-1.5 py-px text-[9px] font-medium text-[#00D7FF]">Free</span> : null}
                    </span>
                </span>
            </button>
            <IconBtn label="Move up" disabled={index === 0 || busy} onClick={onUp}>
                <ChevronUp className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Move down" disabled={last || busy} onClick={onDown}>
                <ChevronDown className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Delete lesson" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
        </div>
    )
}

function ModuleSheet({
    module,
    busy,
    onClose,
    onSave,
}: {
    module?: Module
    busy: boolean
    onClose: () => void
    onSave: (data: { title: string; description?: string }) => Promise<void>
}) {
    const [title, setTitle] = useState(module?.title || "")
    const [description, setDescription] = useState(module?.description || "")
    return (
        <form
            className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
                e.preventDefault()
                if (!title.trim()) return
                void onSave({ title: title.trim(), description: description.trim() || undefined })
            }}
        >
            <SheetHeader className="p-0">
                <SheetTitle>{module ? "Edit module" : "New module"}</SheetTitle>
                <SheetDescription>A chapter in the syllabus.</SheetDescription>
            </SheetHeader>
            <div className="space-y-1.5">
                <Label htmlFor="mod-title">Title</Label>
                <Input id="mod-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cadence" autoFocus />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="mod-desc">What this covers</Label>
                <Textarea id="mod-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={busy || !title.trim()}>
                    {busy ? "Saving..." : module ? "Save" : "Add module"}
                </Button>
            </div>
        </form>
    )
}

function LessonSheet({
    lesson,
    busy,
    onClose,
    onSave,
}: {
    lesson?: Lesson
    busy: boolean
    onClose: () => void
    onSave: (data: LessonData) => Promise<void>
}) {
    const [title, setTitle] = useState(lesson?.title || "")
    const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl || (lesson?.contentType === "VIDEO" ? lesson?.contentUrl : "") || "")
    const [body, setBody] = useState(lesson?.body || lesson?.description || (lesson?.contentType === "TEXT" ? lesson?.contentUrl : "") || "")
    const [fileUrl, setFileUrl] = useState(lesson?.fileUrl || (lesson?.contentType === "PDF" ? lesson?.contentUrl : "") || "")
    const [duration, setDuration] = useState(String(lesson?.durationMinutes ?? 10))
    const [isFree, setIsFree] = useState(lesson?.isFree ?? false)

    return (
        <form
            className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
                e.preventDefault()
                if (!title.trim()) return
                void onSave({
                    title: title.trim(),
                    description: body.trim() || undefined,
                    contentType: videoUrl ? "VIDEO" : fileUrl && !body ? "PDF" : "TEXT",
                    contentUrl: videoUrl.trim() || body.trim() || fileUrl.trim() || undefined,
                    videoUrl: videoUrl.trim() || undefined,
                    body: body.trim() || undefined,
                    fileUrl: fileUrl.trim() || undefined,
                    durationMinutes: parseInt(duration, 10) || 0,
                    isFree,
                })
            }}
        >
            <SheetHeader className="p-0">
                <SheetTitle>{lesson ? "Edit lesson" : "New lesson"}</SheetTitle>
                <SheetDescription>Video, notes, or a file. Students see this in order.</SheetDescription>
            </SheetHeader>
            <div className="space-y-1.5">
                <Label htmlFor="les-title">Title</Label>
                <Input id="les-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="les-mins">Minutes</Label>
                    <Input id="les-mins" type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="flex items-end">
                    <label className="flex h-10 w-full items-center justify-between rounded-xl border px-3 text-sm">
                        Free preview
                        <Switch checked={isFree} onCheckedChange={setIsFree} />
                    </label>
                </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="les-video">Video URL</Label>
                <Input
                    id="les-video"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, or /uploads/lesson.mp4"
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="les-notes">Notes / homework</Label>
                <Textarea id="les-notes" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Markdown. Shown under the video." />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="les-file">Worksheet / PDF URL</Label>
                <Input id="les-file" type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="optional" />
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={busy || !title.trim()}>
                    {busy ? "Saving..." : lesson ? "Save lesson" : "Add lesson"}
                </Button>
            </div>
        </form>
    )
}

function ImportSheet({
    busy,
    onClose,
    onSave,
}: {
    busy: boolean
    onClose: () => void
    onSave: (outline: string) => Promise<void>
}) {
    const [outline, setOutline] = useState("")
    return (
        <form
            className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
                e.preventDefault()
                if (!outline.trim()) return
                void onSave(outline)
            }}
        >
            <SheetHeader className="p-0">
                <SheetTitle>Import outline</SheetTitle>
                <SheetDescription>Paste modules and lessons. We’ll add them to the course.</SheetDescription>
            </SheetHeader>
            <Textarea
                rows={8}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder={"Module: Cadence\n- The weekly stack (12m, free)\n- Hiring scorecards (18m, video)"}
            />
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={busy || !outline.trim()}>
                    {busy ? "Importing..." : "Add to course"}
                </Button>
            </div>
        </form>
    )
}
