"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Profile, WelcomeAnimationPreset } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WelcomeOrb } from "@/components/welcome-orb"
import { User, Briefcase, FolderKanban, Palette, Sparkles, Globe, ChevronDown } from "lucide-react"
import {
    parseOrbBag,
    resolveBloubColor,
    resolveBloubExpression,
    resolveBloubShape,
    writeOrbBag,
    type BloubPick,
} from "@/lib/bloub/catalog"
import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"
import { updateProfile } from "@/app/actions/profile"
import { ExperienceEditor } from "./experience-editor"
import { ProjectEditor } from "./project-editor"
import { toast } from "sonner"
import { FileField } from "@/components/ui/file-field"
import { cn } from "@/lib/utils"
import { QrCard } from "@/components/profile/qr-card"
import { ADDONS, extrasFromAddons, suggestedAddons, type AddonId } from "@/lib/onboarding-needs"
import { extrasOf, fieldOn, hasSurface, writeExtras } from "@/lib/surfaces"

const profileSchema = z.object({
    displayName: z.string().min(2),
    headline: z.string().min(5),
    bio: z.string().optional(),
    slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
    roleTemplate: z.string(),
    primaryGoal: z.string(),
    language: z.string(),
    timezone: z.string(),
    animationStyleId: z.string(),
    isPublic: z.boolean(),
    welcomeMessageOverride: z.string().optional(),
    contentDisplayMode: z.string().optional(),
    personalityConfig: z.string().optional(),
    aiModel: z.string().optional(),
    imageUrl: z.string().optional(),
    shopLogoUrl: z.string().optional(),
    chatAvatarMode: z.string().optional(),
    autoMemoryEnabled: z.boolean().optional(),
    liveChatEnabled: z.boolean().optional(),
    liveChatSlaMinutes: z.coerce.number().optional(),
    whatsapp: z.string().optional(),
    upiId: z.string().optional(),
    gstin: z.string().optional(),
    deliveryNote: z.string().optional(),
})

type ProfileData = z.infer<typeof profileSchema>

interface ProfileEditorProps {
    profile: Profile
    presets: WelcomeAnimationPreset[]
    onSavingChange?: (saving: boolean) => void
}

export function ProfileEditor({ profile, presets, onSavingChange }: ProfileEditorProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [blobOpen, setBlobOpen] = useState(false)

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProfileData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: profile.displayName,
            headline: profile.headline || "",
            bio: profile.bio || "",
            slug: profile.slug,
            roleTemplate: profile.roleTemplate,
            primaryGoal: profile.primaryGoal,
            language: profile.language,
            timezone: profile.timezone,
            animationStyleId: profile.animationStyleId || presets.find((p) => {
                try {
                    const cfg = typeof p.config === "string" ? JSON.parse(p.config) : p.config
                    return cfg?.look === "bloub" || cfg?.look === "blob"
                } catch {
                    return false
                }
            })?.id || presets[0]?.id,
            isPublic: profile.isPublic,
            welcomeMessageOverride: profile.welcomeMessageOverride || "",
            contentDisplayMode: profile.contentDisplayMode || "POPUP",
            personalityConfig: profile.personalityConfig || "",
            aiModel: (profile as any).aiModel || "gpt-4o-mini",
            imageUrl: (profile as any).imageUrl || "",
            shopLogoUrl: (profile as any).shopLogoUrl || "",
            chatAvatarMode: (profile as any).chatAvatarMode || "ORB",
            autoMemoryEnabled: Boolean((profile as any).autoMemoryEnabled),
            liveChatEnabled: Boolean((profile as any).liveChatEnabled),
            liveChatSlaMinutes: (profile as any).liveChatSlaMinutes || 10,
            whatsapp: (profile as any).whatsapp || "",
            upiId: (profile as any).upiId || "",
            gstin: (profile as any).gstin || "",
            deliveryNote: (profile as any).deliveryNote || "",
        }
    })

    // Parse personality config for individual fields
    const personalityConfig = (() => {
        try {
            return JSON.parse(watch("personalityConfig") || "{}")
        } catch { return {} }
    })()

    const updatePersonalityField = (field: string, value: string) => {
        const current = (() => {
            try { return JSON.parse(watch("personalityConfig") || "{}") }
            catch { return {} }
        })()
        current[field] = value || undefined
        // Remove empty keys
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k] })
        setValue("personalityConfig", Object.keys(current).length > 0 ? JSON.stringify(current) : "")
    }

    const selectedAnimationId = watch("animationStyleId")
    const personalityRaw = watch("personalityConfig") || ""
    const orbPick = parseOrbBag(personalityRaw)
    const selectedPresetConfig = (() => {
        const preset = presets.find((p) => p.id === selectedAnimationId)
        if (!preset) return {} as { look?: string }
        try {
            return typeof preset.config === "string" ? JSON.parse(preset.config) : preset.config
        } catch {
            return {}
        }
    })() as { look?: string; shape?: string; expression?: string; color?: string }
    const blobSelected = selectedPresetConfig.look === "bloub" || selectedPresetConfig.look === "blob"
    const liveOrb: BloubPick = {
        shape: resolveBloubShape(orbPick.shape || selectedPresetConfig.shape),
        expression: resolveBloubExpression(orbPick.expression || selectedPresetConfig.expression),
        color: resolveBloubColor(orbPick.color || selectedPresetConfig.color),
    }
    const blobPresetId = presets.find((p) => {
        try {
            const cfg = typeof p.config === "string" ? JSON.parse(p.config) : p.config
            return cfg?.look === "bloub" || cfg?.look === "blob"
        } catch {
            return false
        }
    })?.id

    const setOrb = (patch: Partial<BloubPick>) => {
        setValue("personalityConfig", writeOrbBag(personalityRaw, { ...liveOrb, ...patch }), { shouldDirty: true })
        if (!blobSelected && blobPresetId) setValue("animationStyleId", blobPresetId, { shouldDirty: true })
    }

    const imageUrl = watch("imageUrl")
    const shopLogoUrl = watch("shopLogoUrl")
    const chatAvatarMode = watch("chatAvatarMode") || "ORB"

    const handlePhotoUpload = async (file?: File, field: "imageUrl" | "shopLogoUrl" = "imageUrl") => {
        if (!file) return
        setIsUploading(true)
        try {
            const body = new FormData()
            body.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body })
            const data = await res.json()
            if (!res.ok || !data.url) throw new Error(data.error || "Upload failed")
            setValue(field, data.url, { shouldDirty: true })
            toast.success(field === "shopLogoUrl" ? "Shop logo uploaded" : "Photo uploaded")
        } catch (error) {
            console.error(error)
            toast.error("Could not upload")
        } finally {
            setIsUploading(false)
        }
    }

    const onSubmit = async (data: ProfileData) => {
        setIsSaving(true)
        onSavingChange?.(true)
        try {
            await updateProfile(profile.id, data)
            toast.success("Profile updated successfully")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
            onSavingChange?.(false)
        }
    }

    // Cast profile to any to access relations until types are generated
    const profileWithRelations = profile as any

    return (
        <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Tabs defaultValue="general" className="w-full gap-3">
                <TabsList>
                    <TabsTrigger value="general"><User /><span>General</span></TabsTrigger>
                    {fieldOn(watch("roleTemplate"), "portfolio", extrasOf(watch("personalityConfig"))) ? <TabsTrigger value="experience"><Briefcase /><span>Experience</span></TabsTrigger> : null}
                    {fieldOn(watch("roleTemplate"), "portfolio", extrasOf(watch("personalityConfig"))) ? <TabsTrigger value="projects"><FolderKanban /><span>Projects</span></TabsTrigger> : null}
                    <TabsTrigger value="appearance"><Palette /><span>Appearance</span></TabsTrigger>
                    <TabsTrigger value="ai"><Sparkles /><span>AI</span></TabsTrigger>
                    <TabsTrigger value="public"><Globe /><span>Public</span></TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <div className="overflow-hidden rounded-2xl border bg-card">
                        <div className="space-y-5 px-5 py-5">
                            <GhostField label="Name" error={errors.displayName?.message}>
                                <Input id="displayName" className={cn(ghostInput, "text-base font-medium")} {...register("displayName")} />
                            </GhostField>
                            <GhostField label="Headline">
                                <Input
                                    id="headline"
                                    className={ghostInput}
                                    placeholder="Executive coach for first-time founders"
                                    {...register("headline")}
                                />
                            </GhostField>
                            <GhostField label="Bio">
                                <Textarea
                                    id="bio"
                                    rows={6}
                                    className={cn(ghostInput, "min-h-[140px] resize-y")}
                                    {...register("bio")}
                                />
                            </GhostField>
                        </div>
                        <div className="space-y-5 border-t px-5 py-5">
                            <GhostField label="Role">
                                <ChoiceRow
                                    value={watch("roleTemplate")}
                                    onChange={(val) => setValue("roleTemplate", val)}
                                    options={ROLES}
                                />
                            </GhostField>
                            <GhostField label="Goal">
                                <ChoiceRow
                                    value={watch("primaryGoal")}
                                    onChange={(val) => setValue("primaryGoal", val)}
                                    options={GOALS}
                                />
                            </GhostField>
                            <GhostField label="Also on this page">
                                <div className="flex flex-wrap gap-1.5">
                                    {ADDONS.map((addon) => {
                                        const role = watch("roleTemplate")
                                        const extra = extrasOf(watch("personalityConfig"))
                                        const suggested = suggestedAddons(role).includes(addon.id)
                                        const on = suggested || (extra.addons || []).includes(addon.id)
                                        return (
                                            <button
                                                key={addon.id}
                                                type="button"
                                                onClick={() => {
                                                    const current = new Set(extra.addons || [])
                                                    if (suggested) return
                                                    if (current.has(addon.id)) current.delete(addon.id)
                                                    else current.add(addon.id)
                                                    const next = extrasFromAddons(role, [...suggestedAddons(role), ...current] as AddonId[])
                                                    setValue("personalityConfig", writeExtras(watch("personalityConfig"), next))
                                                }}
                                                className={cn(
                                                    "h-8 rounded-full border px-3 text-xs font-medium",
                                                    on
                                                        ? "border-foreground bg-foreground text-background"
                                                        : "border-border bg-background text-muted-foreground",
                                                )}
                                            >
                                                {addon.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </GhostField>
                        </div>
                        <div className="grid grid-cols-1 gap-5 border-t px-5 py-5 sm:grid-cols-2">
                            <GhostField label="Language">
                                <Input id="language" className={ghostInput} placeholder="English" {...register("language")} />
                            </GhostField>
                            <GhostField label="Timezone">
                                <Input id="timezone" className={ghostInput} placeholder="Asia/Kolkata" {...register("timezone")} />
                            </GhostField>
                        </div>
                        <div className="grid grid-cols-1 gap-5 border-t px-5 py-5 sm:grid-cols-2">
                            <GhostField label="WhatsApp">
                                <Input className={ghostInput} placeholder="91xxxxxxxxxx" {...register("whatsapp")} />
                            </GhostField>
                            {fieldOn(watch("roleTemplate"), "whatsappUpi", extrasOf(watch("personalityConfig"))) || hasSurface(watch("roleTemplate"), "shop", extrasOf(watch("personalityConfig"))) ? (
                            <>
                            <GhostField label="UPI ID">
                                <Input className={ghostInput} placeholder="shop@okaxis" {...register("upiId")} />
                            </GhostField>
                            <GhostField label="GSTIN">
                                <Input className={ghostInput} placeholder="optional" {...register("gstin")} />
                            </GhostField>
                            <GhostField label="Delivery note">
                                <Input className={ghostInput} placeholder="We deliver in the area" {...register("deliveryNote")} />
                            </GhostField>
                            </>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-3 max-w-sm">
                        <QrCard name={watch("displayName") || profile.displayName} slug={watch("slug") || profile.slug} />
                    </div>
                </TabsContent>

                {fieldOn(watch("roleTemplate"), "portfolio", extrasOf(watch("personalityConfig"))) ? (
                    <>
                        <TabsContent value="experience" className="space-y-3">
                            <ExperienceEditor
                                profileId={profile.id}
                                experiences={profileWithRelations.workExperiences || []}
                            />
                        </TabsContent>
                        <TabsContent value="projects" className="space-y-3">
                            <ProjectEditor
                                profileId={profile.id}
                                projects={profileWithRelations.projects || []}
                            />
                        </TabsContent>
                    </>
                ) : null}

                <TabsContent value="appearance" className="space-y-3">
                    <Section title="Photo" description="Shown on About. If Photo is on, the chat top bar uses it instead of the orb.">
                        <div className="flex items-center gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-muted">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
                                        {watch("displayName")?.charAt(0) || "?"}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <FileField
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    disabled={isUploading}
                                    onFile={(file) => handlePhotoUpload(file)}
                                />
                                <Input
                                    placeholder="or paste an image URL"
                                    value={imageUrl || ""}
                                    onChange={(e) => setValue("imageUrl", e.target.value, { shouldDirty: true })}
                                />
                            </div>
                        </div>
                        <ToggleRow
                            title="Chat face"
                            description={chatAvatarMode === "IMAGE"
                                ? "Top bar tile uses your photo. The orb stays in the rest of chat."
                                : "Top bar tile uses the orb."}
                        >
                            <div className="flex items-center gap-2 text-xs">
                                <span className={chatAvatarMode !== "IMAGE" ? "font-medium" : "text-muted-foreground"}>Orb</span>
                                <Switch
                                    checked={chatAvatarMode === "IMAGE"}
                                    disabled={!imageUrl}
                                    onCheckedChange={(checked) => setValue("chatAvatarMode", checked ? "IMAGE" : "ORB")}
                                />
                                <span className={chatAvatarMode === "IMAGE" ? "font-medium" : "text-muted-foreground"}>Photo</span>
                            </div>
                        </ToggleRow>
                        {isUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                    </Section>
                    <Section title="Shop logo" description="Shown at the top of your live shop. If empty, your name is used.">
                        <div className="flex items-center gap-3">
                            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted px-2">
                                {shopLogoUrl ? (
                                    <img src={shopLogoUrl} alt="" className="max-h-10 max-w-full object-contain" />
                                ) : (
                                    <span className="truncate text-xs font-medium">{watch("displayName")}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <FileField
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    disabled={isUploading}
                                    onFile={(file) => handlePhotoUpload(file, "shopLogoUrl")}
                                />
                                <Input
                                    placeholder="or paste a logo URL"
                                    value={shopLogoUrl || ""}
                                    onChange={(e) => setValue("shopLogoUrl", e.target.value, { shouldDirty: true })}
                                />
                            </div>
                        </div>
                        {shopLogoUrl && (
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-0" onClick={() => setValue("shopLogoUrl", "", { shouldDirty: true })}>
                                Use name instead
                            </Button>
                        )}
                    </Section>
                    <Section title="Welcome aura" description="The face on your public page.">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {[...presets].sort((a, b) => {
                                const look = (p: WelcomeAnimationPreset) => {
                                    try {
                                        const cfg = typeof p.config === "string" ? JSON.parse(p.config) : p.config
                                        return cfg?.look === "bloub" || cfg?.look === "blob" ? 1 : 0
                                    } catch {
                                        return 0
                                    }
                                }
                                return look(b) - look(a)
                            }).map((preset) => {
                                let config: { colors?: string[]; variant?: string; look?: string; skin?: string; speed?: number; intensity?: number; shape?: string; expression?: string; color?: string } = {}
                                try {
                                    config = typeof preset.config === "string" ? JSON.parse(preset.config) : preset.config
                                } catch { /* keep empty */ }
                                const colors = (config.colors || ["#00D7FF", "#07104D"]) as [string, string]
                                const selected = selectedAnimationId === preset.id
                                const isBlob = config.look === "bloub" || config.look === "blob"
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => {
                                            setValue("animationStyleId", preset.id, { shouldDirty: true })
                                            if (isBlob) setBlobOpen(true)
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                                            selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex h-[72px] w-full items-center justify-center">
                                            <WelcomeOrb
                                                size={64}
                                                colors={colors}
                                                variant={config.variant}
                                                look={config.look}
                                                skin={config.skin}
                                                shape={isBlob ? liveOrb.shape : config.shape}
                                                expression={isBlob ? liveOrb.expression : config.expression}
                                                color={isBlob ? liveOrb.color : config.color}
                                                speed={config.speed || 1}
                                                intensity={config.intensity || 1}
                                            />
                                        </div>
                                        <span className="text-xs font-medium">{preset.name}</span>
                                        {isBlob ? (
                                            <span className="text-[10px] text-muted-foreground">
                                                {selected ? "Tap to customise" : "Custom"}
                                            </span>
                                        ) : null}
                                    </button>
                                )
                            })}
                        </div>
                    </Section>
                    <BloubCustomizerSheet
                        open={blobOpen}
                        onClose={() => setBlobOpen(false)}
                        value={liveOrb}
                        onChange={setOrb}
                    />
                </TabsContent>

                <TabsContent value="ai">
                    <AiStudio
                        name={watch("displayName")}
                        tone={personalityConfig.tone || "professional"}
                        length={personalityConfig.responseLength || "medium"}
                        language={personalityConfig.language || ""}
                        instructions={personalityConfig.customInstructions || ""}
                        model={watch("aiModel") || "gpt-4o-mini"}
                        memory={Boolean(watch("autoMemoryEnabled"))}
                        live={Boolean(watch("liveChatEnabled"))}
                        onTone={(v) => updatePersonalityField("tone", v)}
                        onLength={(v) => updatePersonalityField("responseLength", v)}
                        onLanguage={(v) => updatePersonalityField("language", v)}
                        onInstructions={(v) => updatePersonalityField("customInstructions", v)}
                        onModel={(v) => setValue("aiModel", v)}
                        onMemory={(v) => setValue("autoMemoryEnabled", v)}
                        onLive={(v) => setValue("liveChatEnabled", v)}
                        slaRegister={register("liveChatSlaMinutes")}
                    />
                </TabsContent>

                <TabsContent value="public" className="space-y-3">
                    <Section title="Public page" description="Visibility, URL, and first-screen copy.">
                        <ToggleRow
                            title="Public"
                            description="Anyone can open your page and chat."
                        >
                            <Switch
                                checked={watch("isPublic")}
                                onCheckedChange={(checked) => setValue("isPublic", checked)}
                            />
                        </ToggleRow>
                        <Field label="Profile URL" error={errors.slug?.message}>
                            <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs text-muted-foreground">personalink.com/</span>
                                <Input id="slug" {...register("slug")} />
                            </div>
                        </Field>
                        <Field label="Welcome line" hint="Shown under the intro. Keep it to one line.">
                            <Input id="welcomeMessage" {...register("welcomeMessageOverride")} placeholder="Ask about coaching or book a call." />
                        </Field>
                        <Field label="Content opens as" hint="How experience and projects appear from chat.">
                            <Select
                                defaultValue={profile.contentDisplayMode || "POPUP"}
                                onValueChange={(val) => setValue("contentDisplayMode", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select display mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="POPUP">Popup</SelectItem>
                                    <SelectItem value="SIDE_PANEL">Side panel</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </Section>
                </TabsContent>
            </Tabs>
        </form>
    )
}

const row2 = "grid grid-cols-1 gap-3 sm:grid-cols-2"
const ghostInput = "h-auto rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"

const ROLES = [
    { id: "SHOP", label: "Shop" },
    { id: "RESTAURANT", label: "Restaurant" },
    { id: "CONSULTANT", label: "Consultant" },
    { id: "CA", label: "CA / professional" },
    { id: "CREATOR", label: "Creator" },
    { id: "COACH", label: "Coach" },
    { id: "DESIGNER", label: "Designer" },
    { id: "DEVELOPER", label: "Developer" },
    { id: "JOB_SEEKER", label: "Job seeker" },
    { id: "EDITOR", label: "Editor" },
    { id: "CUSTOM", label: "Custom" },
]

const GOALS = [
    { id: "SELL_PRODUCTS", label: "Sell products" },
    { id: "BOOK_TABLE", label: "Book a table" },
    { id: "TAKE_APPOINTMENTS", label: "Take appointments" },
    { id: "BOOK_CALL", label: "Book a call" },
    { id: "HIRE_ME", label: "Get hired" },
    { id: "SHOW_PORTFOLIO", label: "Show portfolio" },
    { id: "COLLECT_LEADS", label: "Collect leads" },
]

const VOICES = [
    { id: "professional", label: "Professional", blurb: "Clear, no fluff." },
    { id: "warm", label: "Warm", blurb: "Kind and still direct." },
    { id: "casual", label: "Casual", blurb: "Like a good text." },
    { id: "friendly", label: "Friendly", blurb: "Easy to ask anything." },
    { id: "witty", label: "Witty", blurb: "Dry. Still useful." },
]

const LENGTHS = [
    { id: "short", label: "Short" },
    { id: "medium", label: "Medium" },
    { id: "long", label: "Long" },
]

const MODEL_GROUPS = [
    {
        label: "Latest",
        models: [
            { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
            { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
            { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
            { id: "gpt-5.5", label: "GPT-5.5" },
        ],
    },
    {
        label: "Fast",
        models: [
            { id: "gpt-4.1", label: "GPT-4.1" },
            { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
        ],
    },
    {
        label: "Classic",
        models: [
            { id: "gpt-4o", label: "GPT-4o" },
            { id: "gpt-4o-mini", label: "GPT-4o Mini" },
        ],
    },
]

function Section({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <Card className="gap-4 py-4 shadow-none">
            <CardHeader className="px-4">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-3 px-4">{children}</CardContent>
        </Card>
    )
}

function GhostField({
    label,
    error,
    children,
}: {
    label: string
    error?: string
    children: ReactNode
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            {children}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </label>
    )
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string
    hint?: string
    error?: string
    children: ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            {children}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    )
}

function ChoiceRow({
    value,
    onChange,
    options,
}: {
    value?: string
    onChange: (value: string) => void
    options: { id: string; label: string }[]
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
                const on = value === opt.id
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        className={cn(
                            "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                            on
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        )}
                    >
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}

function AiStudio({
    name,
    tone,
    length,
    language,
    instructions,
    model,
    memory,
    live,
    onTone,
    onLength,
    onLanguage,
    onInstructions,
    onModel,
    onMemory,
    onLive,
    slaRegister,
}: {
    name: string
    tone: string
    length: string
    language: string
    instructions: string
    model: string
    memory: boolean
    live: boolean
    onTone: (v: string) => void
    onLength: (v: string) => void
    onLanguage: (v: string) => void
    onInstructions: (v: string) => void
    onModel: (v: string) => void
    onMemory: (v: boolean) => void
    onLive: (v: boolean) => void
    slaRegister: UseFormRegisterReturn
}) {
    return (
        <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}&apos;s AI</p>
                    <p className="text-xs text-muted-foreground">How it answers on your page.</p>
                </div>
                <Select value={model} onValueChange={onModel}>
                    <SelectTrigger className="h-8 w-[11.5rem] shrink-0 rounded-full text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end" className="min-w-[12rem]">
                        {MODEL_GROUPS.map((group) => (
                            <SelectGroup key={group.label}>
                                <SelectLabel>{group.label}</SelectLabel>
                                {group.models.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-5 px-5 py-5">
                <div className="space-y-2">
                    <p className="text-sm font-medium">Tone</p>
                    <StackSelect
                        value={tone}
                        onChange={onTone}
                        options={VOICES}
                    />
                </div>

                <div className="flex rounded-full bg-muted p-0.5">
                    {LENGTHS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onLength(opt.id)}
                            className={cn(
                                "h-8 flex-1 rounded-full text-xs font-medium transition-colors",
                                length === opt.id ? "bg-background shadow-sm" : "text-muted-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Always</p>
                    <Textarea
                        value={instructions}
                        onChange={(e) => onInstructions(e.target.value)}
                        placeholder="Be direct. Offer a fit call when they are ready."
                        rows={5}
                        className="min-h-[120px] resize-y rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Reply in</p>
                    <Input
                        value={language}
                        onChange={(e) => onLanguage(e.target.value)}
                        placeholder="Same as the page"
                        className="rounded-xl"
                    />
                </div>
            </div>

            <div className="divide-y border-t">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Learn from chats</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Private summaries. Not used to train a public model.</p>
                    </div>
                    <Switch checked={memory} onCheckedChange={onMemory} />
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Live requests</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Buyers can ask to talk to you in Chats.</p>
                    </div>
                    <Switch checked={live} onCheckedChange={onLive} />
                </div>
                {live ? (
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <p className="text-sm font-medium">Usual wait</p>
                        <div className="flex items-center gap-2">
                            <Input type="number" min={2} max={120} className="h-9 w-20 rounded-xl" {...slaRegister} />
                            <span className="text-xs text-muted-foreground">min</span>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function StackSelect({
    value,
    onChange,
    options,
}: {
    value: string
    onChange: (value: string) => void
    options: { id: string; label: string; blurb: string }[]
}) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const current = options.find((o) => o.id === value) ?? options[0]

    useEffect(() => {
        if (!open) return
        const close = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("pointerdown", close)
        return () => document.removeEventListener("pointerdown", close)
    }, [open])

    return (
        <div className="relative" ref={rootRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5 text-left"
            >
                <span>
                    <span className="block text-sm font-medium">{current.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{current.blurb}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            {open ? (
                <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border bg-background shadow-lg">
                    {options.map((opt, i) => {
                        const on = opt.id === value
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                    onChange(opt.id)
                                    setOpen(false)
                                }}
                                className={cn(
                                    "flex w-full flex-col items-start px-3 py-2.5 text-left",
                                    i > 0 && "border-t border-border/70",
                                    on ? "bg-muted" : "hover:bg-muted/50"
                                )}
                            >
                                <span className="text-sm font-medium">{opt.label}</span>
                                <span className="mt-0.5 text-xs text-muted-foreground">{opt.blurb}</span>
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}

function ToggleRow({
    title,
    description,
    children,
}: {
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-none">{title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <div className="shrink-0 pt-0.5">{children}</div>
        </div>
    )
}
