"use client"

import { useCallback, useState } from "react"
import { Profile, WelcomeAnimationPreset, ProfileDocument } from "@prisma/client"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ProfileEditor } from "@/components/dashboard/profile-editor"
import { ContentManager } from "@/components/dashboard/content-manager"
import { ImportStudio, type ImportApplyCtl } from "@/components/dashboard/import-studio"
import { StudioDock } from "@/components/dashboard/studio-dock"
import { DockTabs } from "@/components/dashboard/dock-tabs"
import { extrasOf } from "@/lib/surfaces"
import { Brain, Upload, User } from "lucide-react"

type FaceProfile = Profile & {
    workExperiences: unknown[]
    projects: unknown[]
}

export function YouStudio({
    defaultTab,
    profile,
    presets,
    documents,
}: {
    defaultTab: "profile" | "knowledge" | "import"
    profile: FaceProfile
    presets: WelcomeAnimationPreset[]
    documents: ProfileDocument[]
}) {
    const [tab, setTab] = useState(defaultTab)
    const [saving, setSaving] = useState(false)
    const [openKnowledge, setOpenKnowledge] = useState<(() => void) | null>(null)
    const [importCtl, setImportCtl] = useState<ImportApplyCtl>(null)
    const extras = extrasOf(profile)
    const bindAdd = useCallback((fn: () => void) => {
        setOpenKnowledge(() => fn)
    }, [])

    return (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-0">
            <TabsContent value="profile">
                <ProfileEditor profile={profile} presets={presets} onSavingChange={setSaving} />
            </TabsContent>
            <TabsContent value="knowledge">
                <ContentManager profileId={profile.id} documents={documents} onBindAdd={bindAdd} role={profile.roleTemplate} extras={extras} />
            </TabsContent>
            <TabsContent value="import">
                <ImportStudio profileId={profile.id} role={profile.roleTemplate} extras={extras} onBindApply={setImportCtl} />
            </TabsContent>

            <StudioDock>
                <DockTabs
                    value={tab}
                    tabs={[
                        { id: "profile", label: "Profile", icon: <User />, onClick: () => setTab("profile") },
                        { id: "knowledge", label: "Knowledge", icon: <Brain />, onClick: () => setTab("knowledge") },
                        { id: "import", label: "Import", icon: <Upload />, onClick: () => setTab("import") },
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
                ) : importCtl ? (
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
