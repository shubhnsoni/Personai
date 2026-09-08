"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function CourseStudio({
    title,
    meta,
    live,
    defaultTab = "landing",
    landing,
    curriculum,
    students,
}: {
    title: string
    meta: string
    live?: boolean
    defaultTab?: string
    landing: React.ReactNode
    curriculum: React.ReactNode
    students: React.ReactNode
}) {
    return (
        <div className="mx-auto w-full max-w-2xl space-y-4">
            <div className="flex items-start gap-2">
                <Link
                    href="/dashboard/courses"
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Back to courses"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="truncate text-[1.15rem] font-medium tracking-tight">{title}</h1>
                        <span
                            className={
                                live
                                    ? "shrink-0 rounded-full bg-[#00D7FF]/15 px-2 py-0.5 text-[10px] font-medium text-[#00D7FF]"
                                    : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            }
                        >
                            {live ? "Live" : "Draft"}
                        </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{meta}</p>
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="gap-4">
                <TabsList className="grid h-11 w-full grid-cols-3 rounded-2xl p-1">
                    <TabsTrigger value="landing" className="h-9 flex-1 rounded-xl px-2 text-[13px]">
                        Landing
                    </TabsTrigger>
                    <TabsTrigger value="curriculum" className="h-9 flex-1 rounded-xl px-2 text-[13px]">
                        Curriculum
                    </TabsTrigger>
                    <TabsTrigger value="students" className="h-9 flex-1 rounded-xl px-2 text-[13px]">
                        Students
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="landing">{landing}</TabsContent>
                <TabsContent value="curriculum">{curriculum}</TabsContent>
                <TabsContent value="students">{students}</TabsContent>
            </Tabs>
        </div>
    )
}
