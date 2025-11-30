"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { WelcomeAnimationPreset } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { WelcomeOrb } from "@/components/welcome-orb"
import { createProfile } from "@/app/actions/onboarding"
import { toast } from "sonner"

const onboardingSchema = z.object({
    roleTemplate: z.enum(["DESIGNER", "CONSULTANT", "EDITOR", "COACH", "DEVELOPER", "JOB_SEEKER", "CUSTOM"]),
    displayName: z.string().min(2, "Name must be at least 2 characters"),
    headline: z.string().min(5, "Headline must be at least 5 characters"),
    bio: z.string().optional(),
    language: z.string(),
    timezone: z.string(),
    animationStyleId: z.string().min(1, "Please select an animation style"),
    primaryGoal: z.enum(["BOOK_CALL", "HIRE_ME", "SHOW_PORTFOLIO", "COLLECT_LEADS"]),
})

type OnboardingData = z.infer<typeof onboardingSchema>

interface OnboardingWizardProps {
    presets: WelcomeAnimationPreset[]
    userId: string
}

export function OnboardingWizard({ presets, userId }: OnboardingWizardProps) {
    const [step, setStep] = useState(1)
    const [isCreating, setIsCreating] = useState(false)
    const router = useRouter()

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OnboardingData>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            language: "en",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            primaryGoal: "BOOK_CALL",
            roleTemplate: "CONSULTANT",
            displayName: "",
            headline: "",
            bio: "",
            animationStyleId: ""
        }
    })

    const selectedRole = watch("roleTemplate")
    const selectedAnimationId = watch("animationStyleId")

    const onSubmit: SubmitHandler<OnboardingData> = async (data) => {
        setIsCreating(true)
        try {
            await createProfile(userId, data)
            toast.success("Profile created successfully!")
            router.push("/dashboard")
        } catch (error) {
            console.error("Failed to create profile", error)
            toast.error("Failed to create profile. Please try again.")
            setIsCreating(false)
        }
    }

    const nextStep = () => setStep(s => s + 1)
    const prevStep = () => setStep(s => s - 1)

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Welcome to PersonaLink</h1>
                <p className="text-muted-foreground">Let&apos;s set up your AI profile in a few steps.</p>
            </div>

            <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-2 w-16 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold">What do you do?</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {["DESIGNER", "CONSULTANT", "EDITOR", "COACH", "DEVELOPER", "JOB_SEEKER", "CUSTOM"].map((role) => (
                                <div
                                    key={role}
                                    className={`cursor-pointer rounded-lg border p-4 text-center hover:bg-accent transition-colors ${selectedRole === role ? 'border-primary bg-accent' : ''}`}
                                    onClick={() => setValue("roleTemplate", role as OnboardingData["roleTemplate"])}
                                >
                                    <span className="font-medium capitalize">{role.toLowerCase().replace('_', ' ')}</span>
                                </div>
                            ))}
                        </div>
                        <Button type="button" onClick={nextStep} className="w-full">Next</Button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold">Basic Info</h2>
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Display Name</Label>
                            <Input id="displayName" {...register("displayName")} placeholder="e.g. Jane Doe" />
                            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="headline">Headline</Label>
                            <Input id="headline" {...register("headline")} placeholder="e.g. Senior Product Designer" />
                            {errors.headline && <p className="text-sm text-destructive">{errors.headline.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">Short Bio</Label>
                            <Textarea id="bio" {...register("bio")} placeholder="Tell us a bit about yourself..." />
                        </div>
                        <div className="flex gap-4">
                            <Button type="button" variant="outline" onClick={prevStep} className="w-full">Back</Button>
                            <Button type="button" onClick={nextStep} className="w-full">Next</Button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold">Choose your Aura</h2>
                        {presets.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Loading auras...</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {presets.map((preset) => {
                                    let config: { colors?: string[]; speed?: number; intensity?: number } = {}
                                    try {
                                        config = typeof preset.config === 'string' ? JSON.parse(preset.config) : preset.config as typeof config
                                    } catch {
                                        config = { colors: ["#A855F7", "#EC4899"], speed: 1, intensity: 1 }
                                    }
                                    const colors = config.colors || ["#A855F7", "#EC4899"]
                                    return (
                                        <div
                                            key={preset.id}
                                            className={`cursor-pointer rounded-lg border p-4 text-center hover:bg-accent flex flex-col items-center transition-all ${selectedAnimationId === preset.id ? 'border-primary bg-accent ring-2 ring-primary/50' : ''}`}
                                            onClick={() => setValue("animationStyleId", preset.id)}
                                        >
                                            <div className="mb-4">
                                                <WelcomeOrb
                                                    size={80}
                                                    colors={colors as [string, string]}
                                                    speed={config.speed || 1}
                                                    intensity={config.intensity || 1}
                                                />
                                            </div>
                                            <span className="font-medium text-sm">{preset.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {errors.animationStyleId && <p className="text-sm text-destructive">{errors.animationStyleId.message}</p>}
                        <div className="flex gap-4">
                            <Button type="button" variant="outline" onClick={prevStep} className="w-full">Back</Button>
                            <Button type="button" onClick={nextStep} className="w-full" disabled={!selectedAnimationId}>Next</Button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-xl font-semibold">Primary Goal</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { value: "BOOK_CALL", label: "Book a Call" },
                                { value: "HIRE_ME", label: "Get Hired" },
                                { value: "SHOW_PORTFOLIO", label: "Show Portfolio" },
                                { value: "COLLECT_LEADS", label: "Collect Leads" }
                            ].map((goal) => (
                                <div
                                    key={goal.value}
                                    className={`cursor-pointer rounded-lg border p-4 text-center hover:bg-accent transition-colors ${watch("primaryGoal") === goal.value ? 'border-primary bg-accent' : ''}`}
                                    onClick={() => setValue("primaryGoal", goal.value as OnboardingData["primaryGoal"])}
                                >
                                    <span className="font-medium">{goal.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4">
                            <Button type="button" variant="outline" onClick={prevStep} className="w-full">Back</Button>
                            <Button type="submit" disabled={isCreating} className="w-full">
                                {isCreating ? "Creating Profile..." : "Launch Profile"}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
        </div>
    )
}
