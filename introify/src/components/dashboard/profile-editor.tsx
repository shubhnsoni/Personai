"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "@/components/navigation/transition-link"
import { useRouter } from "next/navigation"
import { useForm, type Resolver, type UseFormRegisterReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Profile, Project, WelcomeAnimationPreset, WorkExperience } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WelcomeOrb } from "@/components/welcome-orb"
import { User, Briefcase, Palette, Sparkles, Globe, BookOpen, ChevronDown, Check, MapPin } from "lucide-react"
import { KitPicker } from "@/components/dashboard/kit-picker"
import { previewListing, applyListing } from "@/app/actions/listing"
import { OfferSheet, LiveRow } from "@/components/dashboard/offer-sheet"
import {
    parseOrbBag,
    resolveBloubColor,
    resolveBloubExpression,
    resolveBloubShape,
    writeOrbBag,
    type BloubPick,
} from "@/lib/bloub/catalog"
import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"
import { AI_MODES, resolveAiMode, type AiMode } from "@/lib/billing/catalog"
import { updateProfile, getProfileAiAccess } from "@/app/actions/profile"
import { ExperienceEditor } from "./experience-editor"
import { ProjectEditor } from "./project-editor"
import { toast } from "sonner"
import { FileField } from "@/components/ui/file-field"
import { cn } from "@/lib/utils"
import { QrCard } from "@/components/profile/qr-card"
import { extrasFromAddons, suggestedAddons, type AddonId } from "@/lib/onboarding-needs"
import { extrasOf, fieldOn, hasSurface, writeExtras } from "@/lib/surfaces"
import { defaultPrepMinutesFromConfig, payModeFromConfig, paymentQrUrlFromConfig, writeDefaultPrepMinutes, writePayMode, writePaymentQrUrl } from "@/lib/payment-qr"
import { socialsFromConfig, writeSocials } from "@/lib/socials"
import { StoryStudio } from "@/components/dashboard/story-studio"
import { formatShopLink, parseLinkStyle, publicShopUrl } from "@/lib/public-url"

const profileSchema = z.object({
    displayName: z.string().min(2),
    headline: z.string().min(5),
    bio: z.string().optional(),
    slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Username must be lowercase letters, numbers, and dashes"),
    linkStyle: z.enum(["PATH", "SUBDOMAIN"]),
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

/**
 * The two relations are declared optional rather than reached for through a cast. The editor
 * already tolerates their absence and renders an empty list, so optional is the honest shape —
 * and declaring them means the day one is renamed the type checker says so, instead of the tab
 * silently going empty.
 */
interface ProfileEditorProps {
    profile: Profile & { workExperiences?: WorkExperience[]; projects?: Project[] }
    presets: WelcomeAnimationPreset[]
    onSavingChange?: (saving: boolean) => void
    defaultTab?: "general" | "about" | "appearance" | "ai" | "public" | "work"
}

export function ProfileEditor({ profile, presets, onSavingChange, defaultTab = "general" }: ProfileEditorProps) {
    const router = useRouter()
    const [aiAccess, setAiAccess] = useState<{ modes: AiMode[]; autoMemory: boolean; customInstructions: boolean; customBranding: boolean }>({ modes: [], autoMemory: false, customInstructions: false, customBranding: false })
    useEffect(() => {
        let active = true
        getProfileAiAccess(profile.id).then(access => { if (active) setAiAccess(access) }).catch(() => {})
        return () => { active = false }
    }, [profile.id])
    const [, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [blobOpen, setBlobOpen] = useState(false)
    const [auraOpen, setAuraOpen] = useState(false)
    const [googleOpen, setGoogleOpen] = useState(false)
    const [paymentQrUrl, setPaymentQrUrl] = useState(() => paymentQrUrlFromConfig(profile.personalityConfig))
    const [payMode, setPayMode] = useState(() => payModeFromConfig(profile.personalityConfig))
    const [defaultPrepMinutes, setDefaultPrepMinutes] = useState(() => defaultPrepMinutesFromConfig(profile.personalityConfig))
    const [socials, setSocials] = useState(() => socialsFromConfig(profile.personalityConfig))

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProfileData>({
        // zod v4 and @hookform/resolvers v5 disagree on the internal issue type,
        // so pin the resolver to this form's own data shape.
        resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileData>,
        defaultValues: {
            displayName: profile.displayName,
            headline: profile.headline || "",
            bio: profile.bio || "",
            slug: profile.slug,
            linkStyle: profile.linkStyle === "SUBDOMAIN" ? "SUBDOMAIN" : "PATH",
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
            aiModel: (() => { try { return resolveAiMode(profile.aiModel) } catch { return "fast" } })(),
            imageUrl: profile.imageUrl || "",
            shopLogoUrl: profile.shopLogoUrl || "",
            chatAvatarMode: profile.chatAvatarMode || "ORB",
            autoMemoryEnabled: Boolean(profile.autoMemoryEnabled),
            liveChatEnabled: Boolean(profile.liveChatEnabled),
            liveChatSlaMinutes: profile.liveChatSlaMinutes || 10,
            whatsapp: profile.whatsapp || "",
            upiId: profile.upiId || "",
            gstin: profile.gstin || "",
            deliveryNote: profile.deliveryNote || "",
        }
    })

    // Parse personality config for individual fields
    const personalityConfig = (() => {
        try {
            return JSON.parse(watch("personalityConfig") || "{}")
        } catch { return {} }
    })()

    const updatePersonalityField = (field: string, value: string | boolean) => {
        const current = (() => {
            try { return JSON.parse(watch("personalityConfig") || "{}") }
            catch { return {} }
        })()
        current[field] = value || undefined
        // Remove empty keys
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k] })
        setValue("personalityConfig", Object.keys(current).length > 0 ? JSON.stringify(current) : "", { shouldDirty: true })
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
    })() as { look?: string; shape?: string; expression?: string; color?: string; colors?: string[] }
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
    const roleTemplate = watch("roleTemplate")
    const extras = extrasOf(personalityRaw)
    const hasPortfolio = fieldOn(roleTemplate, "portfolio", extras)
    const hasMenu = fieldOn(roleTemplate, "menuDish", extras)
    const hasPay = fieldOn(roleTemplate, "whatsappUpi", extras) || hasSurface(roleTemplate, "shop", extras)
    const socialCount = [socials.instagram, socials.facebook, socials.youtube, socials.maps, hasMenu ? socials.zomato : ""].filter((value) => value && value.trim()).length
    const selectedPreset = presets.find((preset) => preset.id === selectedAnimationId)
    const tabBtn = "px-2.5 [&>span]:ml-1.5 [&>span]:max-w-[8rem] [&>span]:opacity-100"

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
            await updateProfile(profile.id, {
                ...data,
                personalityConfig: writeSocials(
                    writeDefaultPrepMinutes(
                        writePayMode(writePaymentQrUrl(data.personalityConfig || profile.personalityConfig, paymentQrUrl), payMode),
                        defaultPrepMinutes,
                    ),
                    socials,
                ),
            })
            toast.success("Profile updated successfully")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
            onSavingChange?.(false)
        }
    }

    return (
        <>
        <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue={defaultTab === "work" ? "work" : defaultTab} className="w-full gap-4">
                <div className="sticky top-0 z-20 bg-background/90 pb-3 pt-1 backdrop-blur-md">
                    <TabsList aria-label="Profile sections">
                        <TabsTrigger value="general" className={tabBtn}><User /><span>General</span></TabsTrigger>
                        <TabsTrigger value="about" className={tabBtn}><BookOpen /><span>About</span></TabsTrigger>
                        {hasPortfolio ? <TabsTrigger value="work" className={tabBtn}><Briefcase /><span>Work</span></TabsTrigger> : null}
                        <TabsTrigger value="appearance" className={tabBtn}><Palette /><span>Look</span></TabsTrigger>
                        <TabsTrigger value="ai" className={tabBtn}><Sparkles /><span>AI</span></TabsTrigger>
                        <TabsTrigger value="public" className={tabBtn}><Globe /><span>Page</span></TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="general" className="space-y-3">
                    <Section
                        title="Identity"
                        description="What guests read first on your page."
                        action={
                            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 rounded-full px-2 text-xs text-muted-foreground" onClick={() => setGoogleOpen(true)}>
                                <MapPin className="h-3.5 w-3.5" />
                                Fill from Google
                            </Button>
                        }
                    >
                        <GhostField label="Name" error={errors.displayName?.message}>
                            <Input id="displayName" className={cn(ghostInput, "text-base font-medium")} {...register("displayName")} />
                        </GhostField>
                        <GhostField label="Headline">
                            <Input id="headline" className={ghostInput} placeholder="Executive coach for first-time founders" {...register("headline")} />
                        </GhostField>
                        <GhostField label="Bio">
                            <Textarea id="bio" rows={4} className={cn(ghostInput, "min-h-[96px] resize-y")} {...register("bio")} />
                        </GhostField>
                    </Section>
                    <Section title="Contact" description="How people reach you. Language is for the assistant.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <GhostField label="WhatsApp">
                                <Input className={ghostInput} placeholder="91xxxxxxxxxx" {...register("whatsapp")} />
                            </GhostField>
                            <GhostField label="Language">
                                <Input id="language" className={ghostInput} placeholder="English" {...register("language")} />
                            </GhostField>
                            <GhostField label="Timezone">
                                <Input id="timezone" className={ghostInput} placeholder="Asia/Kolkata" {...register("timezone")} />
                            </GhostField>
                        </div>
                    </Section>
                    <details className="group rounded-2xl border border-border/70 bg-card">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                            <span>Social links{socialCount ? ` · ${socialCount}` : ""}</span>
                            <span className="text-xs font-normal text-muted-foreground group-open:hidden">Instagram, Maps, and more</span>
                        </summary>
                        <div className="grid gap-4 border-t border-border/60 px-4 py-4 sm:grid-cols-2">
                            <GhostField label="Instagram">
                                <Input className={ghostInput} placeholder="https://instagram.com/yourpage" value={socials.instagram || ""} onChange={(e) => setSocials((cur) => ({ ...cur, instagram: e.target.value }))} />
                            </GhostField>
                            <GhostField label="Facebook">
                                <Input className={ghostInput} placeholder="https://facebook.com/..." value={socials.facebook || ""} onChange={(e) => setSocials((cur) => ({ ...cur, facebook: e.target.value }))} />
                            </GhostField>
                            <GhostField label="YouTube">
                                <Input className={ghostInput} placeholder="https://youtube.com/..." value={socials.youtube || ""} onChange={(e) => setSocials((cur) => ({ ...cur, youtube: e.target.value }))} />
                            </GhostField>
                            <GhostField label="Google Maps">
                                <Input className={ghostInput} placeholder="https://maps.google.com/..." value={socials.maps || ""} onChange={(e) => setSocials((cur) => ({ ...cur, maps: e.target.value }))} />
                            </GhostField>
                            {hasMenu ? (
                                <GhostField label="Zomato">
                                    <Input className={ghostInput} placeholder="https://zomato.com/yourpage" value={socials.zomato || ""} onChange={(e) => setSocials((cur) => ({ ...cur, zomato: e.target.value }))} />
                                </GhostField>
                            ) : null}
                        </div>
                    </details>
                </TabsContent>

                <TabsContent value="about">
                    <StoryStudio slug={profile.slug} role={roleTemplate} personalityConfig={profile.personalityConfig} />
                </TabsContent>

                {hasPortfolio ? (
                    <TabsContent value="work" className="space-y-3">
                        <ExperienceEditor profileId={profile.id} experiences={profile.workExperiences || []} />
                        <ProjectEditor profileId={profile.id} projects={profile.projects || []} />
                    </TabsContent>
                ) : null}

                <TabsContent value="appearance" className="space-y-3">
                    <Section title="Face" description="Photo on About. Logo on the live shop. Chat can use the photo in the top bar.">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">Photo</p>
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
                                        <FileField accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onFile={(file) => handlePhotoUpload(file)} />
                                        <Input placeholder="or paste an image URL" value={imageUrl || ""} onChange={(e) => setValue("imageUrl", e.target.value, { shouldDirty: true })} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">Shop logo</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted px-2">
                                        {shopLogoUrl ? (
                                            <img src={shopLogoUrl} alt="" className="max-h-10 max-w-full object-contain" />
                                        ) : (
                                            <span className="truncate text-xs font-medium">{watch("displayName")}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <FileField accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onFile={(file) => handlePhotoUpload(file, "shopLogoUrl")} />
                                        <Input placeholder="or paste a logo URL" value={shopLogoUrl || ""} onChange={(e) => setValue("shopLogoUrl", e.target.value, { shouldDirty: true })} />
                                    </div>
                                </div>
                                {shopLogoUrl ? (
                                    <Button type="button" variant="ghost" size="sm" className="h-8 px-0" onClick={() => setValue("shopLogoUrl", "", { shouldDirty: true })}>
                                        Use name instead
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                        <ToggleRow
                            title="Chat face"
                            description={chatAvatarMode === "IMAGE" ? "Top bar uses your photo. The orb stays in the rest of chat." : "Top bar uses the orb."}
                        >
                            <div className="flex items-center gap-2 text-xs">
                                <span className={chatAvatarMode !== "IMAGE" ? "font-medium" : "text-muted-foreground"}>Orb</span>
                                <Switch checked={chatAvatarMode === "IMAGE"} disabled={!imageUrl} onCheckedChange={(checked) => setValue("chatAvatarMode", checked ? "IMAGE" : "ORB", { shouldDirty: true })} />
                                <span className={chatAvatarMode === "IMAGE" ? "font-medium" : "text-muted-foreground"}>Photo</span>
                            </div>
                        </ToggleRow>
                        {isUploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
                    </Section>
                    <Section title="Welcome aura" description="The face on your public page.">
                        {!aiAccess.customBranding ? (
                            <p className="text-sm text-muted-foreground">Your free page uses the Introify style. <Link href="/dashboard/billing" className="font-medium underline underline-offset-4">Pro adds custom styles and brand removal.</Link></p>
                        ) : null}
                        <ToggleRow title="Hide Introify footer" description="Your business name, photo and logo are available on every plan.">
                            <Switch aria-label="Hide Introify footer" disabled={!aiAccess.customBranding} checked={aiAccess.customBranding && Boolean(personalityConfig.hideIntroifyBrand)} onCheckedChange={value => updatePersonalityField("hideIntroifyBrand", value)} />
                        </ToggleRow>
                        <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3.5">
                            <WelcomeOrb
                                still
                                size={72}
                                colors={(selectedPresetConfig.colors as [string, string] | undefined) || ["#00D7FF", "#07104D"]}
                                look={blobSelected ? "bloub" : selectedPresetConfig.look}
                                shape={liveOrb.shape}
                                expression={liveOrb.expression}
                                color={liveOrb.color}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{selectedPreset?.name || "Introify look"}</p>
                                <p className="text-xs text-muted-foreground">{blobSelected ? "Custom orb on your page." : "Current welcome face."}</p>
                            </div>
                            {aiAccess.customBranding ? (
                                <div className="flex shrink-0 flex-col gap-1.5">
                                    <button type="button" onClick={() => setAuraOpen((open) => !open)} className="h-8 rounded-full border border-border px-3 text-xs font-medium">
                                        {auraOpen ? "Done" : "Change look"}
                                    </button>
                                    {blobSelected ? (
                                        <button type="button" onClick={() => setBlobOpen(true)} className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
                                            Customise
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        {auraOpen && aiAccess.customBranding ? (
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
                                                selected ? "border-aurora/50 bg-aurora/10" : "hover:bg-muted/40"
                                            )}
                                        >
                                            <div className="flex h-[72px] w-full items-center justify-center">
                                                <WelcomeOrb
                                                    still
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
                                            {isBlob ? <span className="text-[10px] text-muted-foreground">{selected ? "Tap to customise" : "Custom"}</span> : null}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : null}
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
                        model={watch("aiModel") || "fast"}
                        access={aiAccess}
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
                    <Section title="Share" description="Your public link, first line, and QR.">
                        <ToggleRow title="Public" description="Anyone can open your page and chat.">
                            <Switch checked={watch("isPublic")} onCheckedChange={(checked) => setValue("isPublic", checked, { shouldDirty: true })} />
                        </ToggleRow>
                        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                            <div className="space-y-3">
                                <Field label="Username" error={errors.slug?.message}>
                                    <div className="flex items-center gap-2">
                                        <span className="shrink-0 text-xs text-muted-foreground">@</span>
                                        <Input id="slug" {...register("slug")} />
                                    </div>
                                </Field>
                                <Field label="Link style" hint="Both links work. This is the one you share.">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {(["PATH", "SUBDOMAIN"] as const).map((style) => {
                                            const slug = watch("slug") || profile.slug
                                            const on = watch("linkStyle") === style
                                            return (
                                                <button
                                                    key={style}
                                                    type="button"
                                                    onClick={() => setValue("linkStyle", style, { shouldDirty: true })}
                                                    className={cn(
                                                        "rounded-xl border px-3 py-2.5 text-left text-sm",
                                                        on ? "border-aurora/50 bg-aurora/10" : "border-border text-muted-foreground",
                                                    )}
                                                >
                                                    <span className="block font-medium text-foreground">{style === "PATH" ? "Path" : "Subdomain"}</span>
                                                    <span className="mt-0.5 block truncate text-xs">{formatShopLink(slug, style)}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </Field>
                                <Field label="Welcome line" hint="Shown under the intro. Keep it to one line.">
                                    <Input id="welcomeMessage" {...register("welcomeMessageOverride")} placeholder="Ask about coaching or book a call." />
                                </Field>
                                {hasPortfolio ? (
                                    <Field label="Content opens as" hint="How experience and projects appear from chat.">
                                        <Select defaultValue={profile.contentDisplayMode || "POPUP"} onValueChange={(val) => setValue("contentDisplayMode", val, { shouldDirty: true })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select display mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="POPUP">Popup</SelectItem>
                                                <SelectItem value="SIDE_PANEL">Side panel</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                ) : null}
                            </div>
                            <div className="lg:w-[16rem]">
                                <QrCard
                                    compact
                                    name={watch("displayName") || profile.displayName}
                                    slug={watch("slug") || profile.slug}
                                    url={publicShopUrl(watch("slug") || profile.slug, parseLinkStyle(watch("linkStyle")))}
                                />
                            </div>
                        </div>
                    </Section>
                    <Section title="This page is" description="Choose a kit that matches the work. Extra tools can be added without leaving it.">
                        <KitPicker
                            role={roleTemplate}
                            goal={watch("primaryGoal")}
                            extras={extras}
                            onRole={(nextRole, nextGoal) => {
                                setValue("roleTemplate", nextRole, { shouldDirty: true })
                                setValue("primaryGoal", nextGoal, { shouldDirty: true })
                                const extra = extrasOf(personalityRaw)
                                const keep = (extra.addons || []).filter((id) => !suggestedAddons(nextRole).includes(id as AddonId)) as AddonId[]
                                setValue("personalityConfig", writeExtras(personalityRaw, extrasFromAddons(nextRole, [...suggestedAddons(nextRole), ...keep])), { shouldDirty: true })
                            }}
                            onGoal={(nextGoal) => setValue("primaryGoal", nextGoal, { shouldDirty: true })}
                            onAddons={(addons) => setValue("personalityConfig", writeExtras(personalityRaw, extrasFromAddons(roleTemplate, addons)), { shouldDirty: true })}
                        />
                    </Section>
                    {hasPay ? (
                    <Section title="Reach" description="How guests pay.">
                                <Field label="UPI ID">
                                    <Input placeholder="shop@okaxis" {...register("upiId")} />
                                </Field>
                                {roleTemplate === "RESTAURANT" ? (
                                    <>
                                        <Field label="Guest payment">
                                            <div className="flex gap-2">
                                                {(["LATER", "PREPAID"] as const).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setPayMode(mode)}
                                                        className={cn(
                                                            "h-9 rounded-full border px-3 text-xs font-medium",
                                                            payMode === mode ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
                                                        )}
                                                    >
                                                        {mode === "PREPAID" ? "Prepaid UPI" : "Pay on pickup"}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="mt-1 text-[12px] text-muted-foreground">Prepaid shows a Pay button under the QR on the guest ticket.</p>
                                        </Field>
                                        <Field label="Default cooking time">
                                            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                                                <span>Used when a dish has no time of its own</span>
                                                <span className="tabular-nums font-medium text-foreground">{defaultPrepMinutes} min</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={5}
                                                max={90}
                                                step={5}
                                                value={defaultPrepMinutes}
                                                onChange={(e) => setDefaultPrepMinutes(Number(e.target.value))}
                                                className="mt-2 w-full accent-cyan-500"
                                            />
                                        </Field>
                                        <Field label="Payment QR">
                                            <p className="mb-2 text-[12px] text-muted-foreground">Shown to guests after they order. Upload your bank QR, or leave empty to generate one from the UPI ID.</p>
                                            {paymentQrUrl ? <img src={paymentQrUrl} alt="" className="mb-2 h-28 w-28 rounded-xl object-cover" /> : null}
                                            <FileField
                                                accept="image/*"
                                                disabled={isUploading}
                                                onFile={(file) => {
                                                    if (!file) return
                                                    void (async () => {
                                                        setIsUploading(true)
                                                        try {
                                                            const body = new FormData()
                                                            body.append("file", file)
                                                            const res = await fetch("/api/upload", { method: "POST", body })
                                                            const data = await res.json()
                                                            if (!res.ok || !data.url) throw new Error(data.error || "Upload failed")
                                                            setPaymentQrUrl(data.url)
                                                            toast.success("Payment QR uploaded")
                                                        } catch {
                                                            toast.error("Could not upload QR")
                                                        } finally {
                                                            setIsUploading(false)
                                                        }
                                                    })()
                                                }}
                                            />
                                        </Field>
                                    </>
                                ) : null}
                                <Field label="GSTIN">
                                    <Input placeholder="optional" {...register("gstin")} />
                                </Field>
                                <Field label="Delivery note">
                                    <Input placeholder="We deliver in the area" {...register("deliveryNote")} />
                                </Field>
                    </Section>
                    ) : null}
                </TabsContent>
            </Tabs>
        </form>
        <FillFromGoogleSheet
            open={googleOpen}
            onOpenChange={setGoogleOpen}
            mapsUrl={socials.maps || ""}
            name={watch("displayName") || profile.displayName}
            whatsapp={watch("whatsapp") || ""}
            personalityConfig={watch("personalityConfig") || ""}
            onApplied={(patch) => {
                if (patch.displayName) setValue("displayName", patch.displayName, { shouldDirty: true })
                if (patch.whatsapp) setValue("whatsapp", patch.whatsapp, { shouldDirty: true })
                if (patch.mapsUrl) {
                    const maps = patch.mapsUrl
                    setSocials((cur) => ({ ...cur, maps }))
                }
                if (patch.personalityConfig) setValue("personalityConfig", patch.personalityConfig, { shouldDirty: true })
                router.refresh()
            }}
        />
        </>
    )
}

const ghostInput = "h-auto rounded-none border-0 border-b border-border/70 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"

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


function Section({
    title,
    description,
    action,
    children,
}: {
    title: string
    description?: string
    action?: ReactNode
    children: ReactNode
}) {
    return (
        <Card className="gap-4 py-4 shadow-none">
            <CardHeader className="px-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-sm font-medium">{title}</CardTitle>
                        {description ? <CardDescription>{description}</CardDescription> : null}
                    </div>
                    {action}
                </div>
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

function AiStudio({
    access,
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
    access: { modes: AiMode[]; autoMemory: boolean; customInstructions: boolean }
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
                        {Object.values(AI_MODES).map(mode => (
                            <SelectItem key={mode.id} value={mode.id} disabled={!access.modes.includes(mode.id)}>{mode.name} · {mode.credits} {mode.credits === 1 ? "credit" : "credits"}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-5 px-5 py-5">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Voice</p>
                        <p className="text-xs text-muted-foreground">Tone and how long it talks.</p>
                        <StackSelect value={tone} onChange={onTone} options={VOICES} />
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
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Custom instructions</p>
                    {!access.customInstructions && <p className="text-xs text-muted-foreground">Available on Pro and above.</p>}
                    <Textarea
                        disabled={!access.customInstructions}
                        value={access.customInstructions ? instructions : ""}
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
                        <p className="text-sm font-medium">Private conversation memory</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Pro and above. With visitor consent, keep short private notes for that conversation only.</p>
                    </div>
                    <Switch checked={access.autoMemory && memory} disabled={!access.autoMemory} onCheckedChange={onMemory} />
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Live requests</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Visitors can ask to talk to you from chat. You get an email and a dashboard popup to approve or reject.</p>
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

const LISTING_FIELDS = ["placeId", "mapsUrl", "address", "phone", "hours", "photos", "displayName"] as const
type ListingField = (typeof LISTING_FIELDS)[number]

const LISTING_FIELD_COPY: Record<ListingField, { label: string; hint: string }> = {
    placeId: { label: "Place ID", hint: "Saved on the listing, not shown to guests" },
    mapsUrl: { label: "Maps link", hint: "Replaces the Google Maps field" },
    address: { label: "Address", hint: "Written to the venue bag" },
    phone: { label: "Phone", hint: "Venue phone; WhatsApp only if empty or overwrite" },
    hours: { label: "Hours", hint: "Weekly hours on the booking calendar" },
    photos: { label: "Photos", hint: "Stay unpublished unless you turn publish on" },
    displayName: { label: "Name", hint: "Profile display name" },
}

type ListingPreviewLoose = {
    placeId?: string | null
    mapsUrl?: string | null
    name?: string | null
    rating?: number | null
    address?: unknown
    phone?: unknown
    hours?: unknown
    photos?: unknown
    warnings?: unknown
}

function listingText(value: unknown, keys: string[]) {
    if (typeof value === "string") return value.trim()
    if (!value || typeof value !== "object") return ""
    const bag = value as Record<string, unknown>
    for (const key of keys) {
        const hit = bag[key]
        if (typeof hit === "string" && hit.trim()) return hit.trim()
    }
    return ""
}

function listingAddress(preview?: ListingPreviewLoose | null) {
    return listingText(preview?.address, ["formatted", "line1"])
}

function listingPhone(preview?: ListingPreviewLoose | null) {
    return listingText(preview?.phone, ["display", "e164"])
}

function listingHours(preview?: ListingPreviewLoose | null) {
    const direct = listingText(preview?.hours, ["statusText"])
    if (direct) return direct
    const weekly = preview?.hours && typeof preview.hours === "object" ? (preview.hours as { weekly?: unknown }).weekly : null
    return Array.isArray(weekly) && weekly.length ? `${weekly.length} days` : ""
}

function listingPhotos(preview?: ListingPreviewLoose | null) {
    return Array.isArray(preview?.photos) ? preview.photos.length : 0
}

function listingWarnings(preview?: ListingPreviewLoose | null) {
    return Array.isArray(preview?.warnings) ? preview.warnings.filter((w): w is string => typeof w === "string" && Boolean(w)) : []
}

function fieldPresent(preview: ListingPreviewLoose | null, field: ListingField, mapsUrl: string) {
    if (!preview) return false
    if (field === "placeId") return Boolean(preview.placeId)
    if (field === "mapsUrl") return Boolean(preview.mapsUrl || mapsUrl.trim())
    if (field === "address") return Boolean(listingAddress(preview))
    if (field === "phone") return Boolean(listingPhone(preview))
    if (field === "hours") return Boolean(listingHours(preview))
    if (field === "photos") return listingPhotos(preview) > 0
    return Boolean(preview.name)
}

function mergeListingConfig(raw: string, patch: { placeId?: string | null; venue?: unknown }) {
    let bag: Record<string, unknown> = {}
    try { bag = JSON.parse(raw || "{}") as Record<string, unknown> } catch { bag = {} }
    if (patch.placeId) bag.googlePlaceId = patch.placeId
    if (patch.venue && typeof patch.venue === "object") bag.venue = patch.venue
    return JSON.stringify(bag)
}

function FillFromGoogleSheet({
    open,
    onOpenChange,
    mapsUrl,
    name,
    whatsapp,
    personalityConfig,
    onApplied,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    mapsUrl: string
    name: string
    whatsapp: string
    personalityConfig: string
    onApplied: (patch: { displayName?: string; whatsapp?: string; mapsUrl?: string; personalityConfig?: string }) => void
}) {
    const [mapsInput, setMapsInput] = useState(mapsUrl)
    const [preview, setPreview] = useState<ListingPreviewLoose | null>(null)
    const [fields, setFields] = useState<ListingField[]>([...LISTING_FIELDS])
    const [overwrite, setOverwrite] = useState(false)
    const [publishPhotos, setPublishPhotos] = useState(false)
    const [previewing, setPreviewing] = useState(false)
    const [applying, setApplying] = useState(false)

    useEffect(() => {
        if (!open) return
        setMapsInput(mapsUrl)
        setPreview(null)
        setFields([...LISTING_FIELDS])
        setOverwrite(false)
        setPublishPhotos(false)
    }, [open, mapsUrl])

    const toggleField = (id: ListingField) => {
        setFields((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]))
    }

    const runPreview = async () => {
        const url = mapsInput.trim()
        if (!url) {
            toast.error("Paste a Google Maps link first")
            return
        }
        setPreviewing(true)
        try {
            const next = await previewListing({ mapsUrl: url, name: name || undefined })
            setPreview((next ?? null) as ListingPreviewLoose | null)
            const available = LISTING_FIELDS.filter((field) => fieldPresent((next ?? null) as ListingPreviewLoose | null, field, url))
            if (available.length) setFields(available)
        } catch (error) {
            setPreview(null)
            toast.error(error instanceof Error ? error.message : "Could not preview that listing")
        } finally {
            setPreviewing(false)
        }
    }

    const runApply = async () => {
        if (!preview || !fields.length) return
        setApplying(true)
        try {
            const result = await applyListing({
                mapsUrl: mapsInput.trim() || preview.mapsUrl || undefined,
                placeId: preview.placeId || undefined,
                fields: fields as Array<
                    | "placeId" | "mapsUrl"
                    | "displayName" | "headline" | "bio"
                    | "phone" | "hours" | "address"
                    | "photos" | "categories"
                >,
                overwrite,
                publishPhotos,
            }) as { applied?: unknown; skipped?: Array<{ field?: string; reason?: string } | string>; venue?: unknown; personalityConfig?: unknown } | void
            const skipped = Array.isArray(result?.skipped) ? result.skipped : []
            const patch: { displayName?: string; whatsapp?: string; mapsUrl?: string; personalityConfig?: string } = {}
            if (fields.includes("displayName") && preview.name && (overwrite || !name.trim())) patch.displayName = preview.name
            if (fields.includes("phone")) {
                const phone = listingPhone(preview)
                if (phone && (overwrite || !whatsapp.trim())) patch.whatsapp = phone
            }
            if (fields.includes("mapsUrl")) {
                const nextMaps = (typeof preview.mapsUrl === "string" && preview.mapsUrl) || mapsInput.trim()
                if (nextMaps && (overwrite || !mapsUrl.trim())) patch.mapsUrl = nextMaps
            }
            const venue = result && typeof result === "object" ? result.venue : undefined
            const placeId = fields.includes("placeId") ? preview.placeId : undefined
            let nextConfig: string | undefined
            if (result && typeof result === "object" && typeof result.personalityConfig === "string") {
                nextConfig = result.personalityConfig
            } else if (placeId || venue) {
                nextConfig = mergeListingConfig(personalityConfig, { placeId, venue })
            }
            if (nextConfig) patch.personalityConfig = nextConfig
            onApplied(patch)
            if (skipped.length) {
                const reasons = skipped.map((row) => typeof row === "string" ? row : [row.field, row.reason].filter(Boolean).join(": ")).filter(Boolean)
                toast.success(reasons.length ? `Applied. Skipped ${reasons.join("; ")}` : "Listing applied")
            } else {
                toast.success("Listing applied")
            }
            onOpenChange(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not apply that listing")
        } finally {
            setApplying(false)
        }
    }

    const warnings = listingWarnings(preview)
    const address = listingAddress(preview)
    const phone = listingPhone(preview)
    const hours = listingHours(preview)
    const photos = listingPhotos(preview)

    return (
        <OfferSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Fill from Google"
            description="Preview the listing, pick fields, then apply. Does not make the page public."
            footer={
                <div className="flex gap-2">
                    <Button type="button" variant="outline" className="h-11 flex-1 rounded-full" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="h-11 flex-[1.4] rounded-full bg-[#00D7FF] text-zinc-950 hover:bg-[#00D7FF]/90"
                        disabled={!preview || !fields.length || previewing || applying}
                        onClick={() => void runApply()}
                    >
                        {applying ? "Applying…" : "Apply"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 pb-4">
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Maps URL</span>
                    <Input
                        value={mapsInput}
                        onChange={(e) => setMapsInput(e.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="h-11 rounded-xl"
                        inputMode="url"
                    />
                </label>
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full border-[#00D7FF]/40 bg-[#00D7FF]/10 text-[#00D7FF] backdrop-blur hover:bg-[#00D7FF]/20"
                    disabled={previewing || applying}
                    onClick={() => void runPreview()}
                >
                    {previewing ? "Previewing…" : "Preview"}
                </Button>

                {preview ? (
                    <div className="space-y-2 rounded-2xl border border-[#00D7FF]/25 bg-[#00D7FF]/5 p-3.5 backdrop-blur">
                        <p className="text-sm font-medium">{preview.name || name || "Listing"}</p>
                        {typeof preview.rating === "number" ? (
                            <p className="text-xs text-muted-foreground">{preview.rating.toFixed(1)} on Google</p>
                        ) : null}
                        {address ? <p className="text-xs text-muted-foreground">{address}</p> : null}
                        {phone ? <p className="text-xs text-muted-foreground">{phone}</p> : null}
                        {hours ? <p className="text-xs text-muted-foreground">{hours}</p> : null}
                        {photos > 0 ? <p className="text-xs text-muted-foreground">{photos} photo{photos === 1 ? "" : "s"}</p> : null}
                        {warnings.map((warning) => (
                            <p key={warning} className="text-xs text-amber-500">{warning}</p>
                        ))}
                    </div>
                ) : null}

                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Apply</p>
                    <div className="grid gap-1.5">
                        {LISTING_FIELDS.map((id) => {
                            const copy = LISTING_FIELD_COPY[id]
                            const on = fields.includes(id)
                            const missing = Boolean(preview) && !fieldPresent(preview, id, mapsInput)
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleField(id)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left",
                                        on ? "border-[#00D7FF]/50 bg-[#00D7FF]/5" : "border-border/70",
                                        missing && "opacity-60",
                                    )}
                                >
                                    <span className={cn(
                                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                                        on ? "border-[#00D7FF] bg-[#00D7FF] text-zinc-950" : "border-border",
                                    )}>
                                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium">{copy.label}</span>
                                        <span className="block text-xs text-muted-foreground">{copy.hint}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <LiveRow checked={overwrite} onChange={setOverwrite} label="Overwrite existing" />
                    <LiveRow checked={publishPhotos} onChange={setPublishPhotos} label="Publish photos" />
                    <p className="px-1 text-[12px] text-muted-foreground">
                        Empty fields fill unless overwrite is on. Photos stay hidden unless you publish them. Listing fill is free.
                    </p>
                </div>
            </div>
        </OfferSheet>
    )
}
