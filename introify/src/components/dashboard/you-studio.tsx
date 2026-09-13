"use client"

import { useCallback, useState } from "react"
import { Profile, Project, WelcomeAnimationPreset, ProfileDocument, WorkExperience } from "@prisma/client"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ProfileEditor } from "@/components/dashboard/profile-editor"
import { ContentManager } from "@/components/dashboard/content-manager"
import { ImportStudio, type ImportApplyCtl } from "@/components/dashboard/import-studio"
import { ProfileImportBuilder } from "@/components/profile/profile-import-builder"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { extrasOf } from "@/lib/surfaces"
import { ProfileExpertiseStudio } from "@/components/dashboard/profile-expertise-studio"
import { Brain, Upload, User, Wrench } from "lucide-react"

// The page that renders this queries the profile with `include: { workExperiences, projects }`,
// so these are real rows. They were declared `unknown[]`, which made the editor below reach for
// them through a cast; naming the types instead means a renamed relation is a type error.
type FaceProfile = Profile & {
    workExperiences: WorkExperience[]
    projects: Project[]
}

export function YouStudio({
    defaultTab,
    profile,
    presets,
    documents,
}: {
    defaultTab: "profile" | "knowledge" | "import" | "story" | "tools"
    profile: FaceProfile
    presets: WelcomeAnimationPreset[]
    documents: ProfileDocument[]
}) {
    const [tab, setTab] = useState(defaultTab === "story" ? "profile" : defaultTab)
    const [saving, setSaving] = useState(false)
    const [openKnowledge, setOpenKnowledge] = useState<((title?: string) => void) | null>(null)
    const [importCtl, setImportCtl] = useState<ImportApplyCtl>(null)
    const [importMode, setImportMode] = useState<"full" | "files">("full")
    const extras = extrasOf(profile)
    const bindAdd = useCallback((fn: (title?: string) => void) => {
        setOpenKnowledge(() => fn)
    }, [])
    const addKnowledgeDraft = useCallback((title: string) => {
        setTab("knowledge")
        openKnowledge?.(title)
    }, [openKnowledge])

    return (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex h-full min-h-0 flex-col gap-0">
            <TabsContent value="profile" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                <ProfileEditor
                    profile={profile}
                    presets={presets}
                    onSavingChange={setSaving}
                    defaultTab={defaultTab === "story" ? "about" : "general"}
                />
            </TabsContent>
            <TabsContent value="knowledge" className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-24 md:px-6 lg:px-8">
                <ContentManager profileId={profile.id} documents={documents} onBindAdd={bindAdd} role={profile.roleTemplate} extras={extras} />
            </TabsContent>
            <TabsContent value="import" className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-24 md:px-6 lg:px-8">
                <div className="mb-3 inline-flex rounded-full border border-border/70 p-0.5 text-xs">
                    <button
                        type="button"
                        onClick={() => setImportMode("full")}
                        className={importMode === "full" ? "rounded-full bg-foreground px-3 py-1.5 text-background" : "rounded-full px-3 py-1.5 text-muted-foreground"}
                    >Full profile</button>
                    <button
                        type="button"
                        onClick={() => setImportMode("files")}
                        className={importMode === "files" ? "rounded-full bg-foreground px-3 py-1.5 text-background" : "rounded-full px-3 py-1.5 text-muted-foreground"}
                    >Files &amp; catalogs</button>
                </div>
                {importMode === "full" ? (
                    <ProfileImportBuilder context={{ profileId: profile.id }} />
                ) : (
                    <ImportStudio profileId={profile.id} role={profile.roleTemplate} extras={extras} onBindApply={setImportCtl} />
                )}
            </TabsContent>
            <TabsContent value="tools" className="min-h-0 flex-1 overflow-auto px-3 pt-4 pb-24 md:px-6 lg:px-8">
                <ProfileExpertiseStudio profileId={profile.id} onAddKnowledge={addKnowledgeDraft} />
            </TabsContent>

            <StudioDock>
                <DockTabs
                    value={tab}
                    tabs={[
                        { id: "profile", label: "Profile", icon: <User />, onClick: () => setTab("profile") },
                        { id: "knowledge", label: "Knowledge", icon: <Brain />, onClick: () => setTab("knowledge") },
                        { id: "import", label: "Import", icon: <Upload />, onClick: () => setTab("import") },
                        { id: "tools", label: "Tools", icon: <Wrench />, onClick: () => setTab("tools") },
                    ]}
                />
                {tab === "profile" ? (
                    <Button type="submit" form="profile-form" disabled={saving} className="shrink-0 rounded-full">
                        {saving ? "Saving..." : "Save changes"}
                    </Button>
                ) : tab === "knowledge" ? (
                    <Button type="button" className="shrink-0 rounded-full" onClick={() => openKnowledge?.()}>
                        Add content
                    </Button>
                ) : tab === "import" && importMode === "files" && importCtl ? (
                    <Button
                        type="button"
                        className="shrink-0 rounded-full"
                        disabled={!importCtl.count || importCtl.applying}
                        onClick={importCtl.apply}
                    >
                        {importCtl.label}
                    </Button>
                ) : (
                    <span />
                )}
            </StudioDock>
        </Tabs>
    )
}
