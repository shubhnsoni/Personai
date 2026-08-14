"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WelcomeOrb } from "@/components/welcome-orb"
import { updateProfile } from "@/app/actions/profile"
import { ExperienceEditor } from "./experience-editor"
import { ProjectEditor } from "./project-editor"
import { toast } from "sonner"

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
})

type ProfileData = z.infer<typeof profileSchema>

interface ProfileEditorProps {
    profile: Profile
    presets: WelcomeAnimationPreset[]
}

export function ProfileEditor({ profile, presets }: ProfileEditorProps) {
    const [isSaving, setIsSaving] = useState(false)

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
            animationStyleId: profile.animationStyleId || presets[0]?.id,
            isPublic: profile.isPublic,
            welcomeMessageOverride: profile.welcomeMessageOverride || "",
            contentDisplayMode: profile.contentDisplayMode || "POPUP",
            personalityConfig: profile.personalityConfig || "",
            aiModel: (profile as any).aiModel || "gpt-4o-mini",
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

    const onSubmit = async (data: ProfileData) => {
        setIsSaving(true)
        try {
            await updateProfile(profile.id, data)
            toast.success("Profile updated successfully")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update profile")
        } finally {
            setIsSaving(false)
        }
    }

    // Cast profile to any to access relations until types are generated
    const profileWithRelations = profile as any

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="experience">Experience</TabsTrigger>
                    <TabsTrigger value="projects">Projects</TabsTrigger>
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    <TabsTrigger value="ai">AI Settings</TabsTrigger>
                    <TabsTrigger value="public">Public Page</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                    {/* ... existing general content ... */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>How you appear to visitors.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="displayName">Display Name</Label>
                                    <Input id="displayName" {...register("displayName")} />
                                    {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="headline">Headline</Label>
                                    <Input id="headline" {...register("headline")} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea id="bio" {...register("bio")} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        defaultValue={profile.roleTemplate}
                                        onValueChange={(val) => setValue("roleTemplate", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["DESIGNER", "CONSULTANT", "EDITOR", "COACH", "DEVELOPER", "JOB_SEEKER", "CUSTOM"].map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Primary Goal</Label>
                                    <Select
                                        defaultValue={profile.primaryGoal}
                                        onValueChange={(val) => setValue("primaryGoal", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a goal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["BOOK_CALL", "HIRE_ME", "SHOW_PORTFOLIO", "COLLECT_LEADS"].map(g => (
                                                <SelectItem key={g} value={g}>{g}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="experience" className="space-y-4">
                    <ExperienceEditor
                        profileId={profile.id}
                        experiences={profileWithRelations.workExperiences || []}
                    />
                </TabsContent>

                <TabsContent value="projects" className="space-y-4">
                    <ProjectEditor
                        profileId={profile.id}
                        projects={profileWithRelations.projects || []}
                    />
                </TabsContent>

                <TabsContent value="appearance" className="space-y-4">
                    {/* ... existing appearance content ... */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Welcome Aura</CardTitle>
                            <CardDescription>Choose the animation style for your public page.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                {presets.map((preset) => {
                                    let config: any = {}
                                    try {
                                        config = typeof preset.config === 'string' ? JSON.parse(preset.config) : preset.config
                                    } catch (e) { console.error(e) }
                                    const colors = config.colors || ["#A855F7", "#EC4899"]

                                    return (
                                        <div
                                            key={preset.id}
                                            className={`cursor-pointer rounded-lg border p-4 text-center hover:bg-accent flex flex-col items-center ${selectedAnimationId === preset.id ? 'border-primary bg-accent' : ''}`}
                                            onClick={() => setValue("animationStyleId", preset.id)}
                                        >
                                            <div className="mb-4">
                                                <WelcomeOrb
                                                    size={60}
                                                    colors={colors}
                                                    speed={config.speed || 1}
                                                    intensity={config.intensity || 1}
                                                />
                                            </div>
                                            <span className="font-medium text-sm">{preset.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Model</CardTitle>
                            <CardDescription>Choose which AI model powers your chatbot.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select
                                defaultValue={(profile as any).aiModel || "gpt-4o-mini"}
                                onValueChange={(val) => setValue("aiModel", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select AI model" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster & Cheaper)</SelectItem>
                                    <SelectItem value="gpt-4o">GPT-4o (Higher Quality)</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Personality</CardTitle>
                            <CardDescription>Customize how your AI assistant communicates.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tone</Label>
                                <Select
                                    defaultValue={personalityConfig.tone || ""}
                                    onValueChange={(val) => updatePersonalityField("tone", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Default (professional & friendly)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="casual">Casual</SelectItem>
                                        <SelectItem value="friendly">Friendly</SelectItem>
                                        <SelectItem value="witty">Witty</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Response Length</Label>
                                <Select
                                    defaultValue={personalityConfig.responseLength || ""}
                                    onValueChange={(val) => updatePersonalityField("responseLength", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Default (medium)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                                        <SelectItem value="medium">Medium (2-4 sentences)</SelectItem>
                                        <SelectItem value="long">Long (detailed paragraphs)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Response Language</Label>
                                <Input
                                    placeholder="e.g. English, Spanish, Hindi..."
                                    defaultValue={personalityConfig.language || ""}
                                    onChange={(e) => updatePersonalityField("language", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Override the default language for AI responses.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Custom Instructions</Label>
                                <Textarea
                                    placeholder="e.g. Always mention my free consultation offer. Never discuss pricing over $5000..."
                                    defaultValue={personalityConfig.customInstructions || ""}
                                    onChange={(e) => updatePersonalityField("customInstructions", e.target.value)}
                                    rows={4}
                                />
                                <p className="text-xs text-muted-foreground">Additional instructions for your AI. These are injected into the system prompt.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="public" className="space-y-4">
                    {/* ... existing public content ... */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Public Page Settings</CardTitle>
                            <CardDescription>Manage your public profile visibility and URL.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Public Visibility</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Allow anyone to view your profile and chat with your AI.
                                    </p>
                                </div>
                                <Switch
                                    checked={watch("isPublic")}
                                    onCheckedChange={(checked) => setValue("isPublic", checked)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Profile URL Slug</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-sm">personalink.ai/</span>
                                    <Input id="slug" {...register("slug")} />
                                </div>
                                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="welcomeMessage">Custom Welcome Message</Label>
                                <Input id="welcomeMessage" {...register("welcomeMessageOverride")} placeholder="Default: What are you here for?" />
                            </div>
                            <div className="space-y-2">
                                <Label>Content Display Mode</Label>
                                <Select
                                    defaultValue={profile.contentDisplayMode || "POPUP"}
                                    onValueChange={(val) => setValue("contentDisplayMode", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select display mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="POPUP">Popup Modal (Default)</SelectItem>
                                        <SelectItem value="SIDE_PANEL">Side Panel</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Choose how detailed content (Experience, Projects) opens.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </form>
    )
}
