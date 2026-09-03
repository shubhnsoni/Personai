"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"
import type { WelcomeAnimationPreset } from "@prisma/client"
import {
    Briefcase,
    Calculator,
    Calendar,
    ChevronDown,
    Clock,
    FileDown,
    FolderKanban,
    Gem,
    Gift,
    GraduationCap,
    ImagePlus,
    Sparkles,
    Store,
    Ticket,
    UtensilsCrossed,
    Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { WelcomeOrb } from "@/components/welcome-orb"
import { BloubCustomizerSheet } from "@/components/dashboard/bloub-customizer-sheet"
import { createProfile } from "@/app/actions/onboarding"
import { ADDONS, NEEDS, needById, suggestedAddons, type AddonId, type NeedId } from "@/lib/onboarding-needs"
import {
    parseOrbBag,
    resolveBloubColor,
    resolveBloubExpression,
    resolveBloubShape,
    writeOrbBag,
    type BloubPick,
} from "@/lib/bloub/catalog"
import { DEFAULT_COLOR } from "@/lib/bloub/skins"
import { DEFAULT_EXPRESSION } from "@/lib/bloub/expressions"
import { cn } from "@/lib/utils"

const NEED_ICON: Record<NeedId, typeof Store> = {
    sell: Store,
    dine: UtensilsCrossed,
    time: Clock,
    teach: GraduationCap,
    ca: Calculator,
    hire: Briefcase,
    show: FolderKanban,
    leads: Gift,
    field: Wrench,
    salon: Sparkles,
    eventStudio: Ticket,
    estate: Store,
    recruit: Briefcase,
    jewelryRetail: Gem,
    goldWholesale: Gem,
    distribute: Store,
    pharmacy: Sparkles,
    page: Sparkles,
}

const ADDON_ICON: Record<AddonId, typeof Store> = {
    leads: Gift,
    shop: Store,
    menu: UtensilsCrossed,
    digital: FileDown,
    services: Briefcase,
    calendar: Calendar,
    courses: GraduationCap,
    events: Ticket,
    portfolio: FolderKanban,
}

type FaceMode = "orb" | "photo"
type OrbCfg = {
    colors?: string[]
    variant?: string
    look?: string
    skin?: string
    speed?: number
    intensity?: number
    shape?: string
    expression?: string
    color?: string
}

function parsePreset(preset?: WelcomeAnimationPreset | null): OrbCfg {
    if (!preset) return { colors: ["#00D7FF", "#07104D"], look: "orb" }
    try {
        return typeof preset.config === "string" ? JSON.parse(preset.config) : (preset.config as OrbCfg)
    } catch {
        return { colors: ["#00D7FF", "#07104D"] }
    }
}

function isBlobCfg(cfg: OrbCfg) {
    return cfg.look === "bloub" || cfg.look === "blob"
}

function findBlobPreset(presets: WelcomeAnimationPreset[]) {
    return presets.find((p) => isBlobCfg(parsePreset(p))) || presets[0]
}

export function OnboardingWizard({
    presets,
    suggestedName,
    initialNeed,
    activate = false,
}: {
    presets: WelcomeAnimationPreset[]
    suggestedName?: string
    initialNeed?: NeedId
    activate?: boolean
}) {
    const router = useRouter()
    const fileRef = useRef<HTMLInputElement>(null)
    const blobPreset = useMemo(() => findBlobPreset(presets), [presets])
    const [step, setStep] = useState(1)
    const [need, setNeed] = useState<NeedId | null>(initialNeed || null)
    const [name, setName] = useState(suggestedName || "")
    const [headline, setHeadline] = useState(initialNeed ? needById(initialNeed).headline : "")
    const [addons, setAddons] = useState<AddonId[]>(initialNeed ? suggestedAddons(needById(initialNeed).role) : [])
    const [moreOpen, setMoreOpen] = useState(false)
    const [animationStyleId, setAnimationStyleId] = useState(blobPreset?.id || "")
    const [face, setFace] = useState<FaceMode>("orb")
    const [imageUrl, setImageUrl] = useState("")
    const [uploading, setUploading] = useState(false)
    const [blobOpen, setBlobOpen] = useState(false)
    const [orbBag, setOrbBag] = useState("")
    const [busy, setBusy] = useState(false)

    const picked = needById(need)
    const previewHeadline = headline.trim() || (need ? picked.headline : "One line about you")
    const suggested = suggestedAddons(picked.role)
    const extraAddons = ADDONS.filter((a) => !suggested.includes(a.id))
    const extraOn = extraAddons.filter((a) => addons.includes(a.id))

    const orbs = useMemo(() => {
        const parsed = presets.map((p) => ({ preset: p, cfg: parsePreset(p) }))
        return parsed.sort((a, b) => Number(isBlobCfg(b.cfg)) - Number(isBlobCfg(a.cfg)))
    }, [presets])

    const selectedPreset = orbs.find((o) => o.preset.id === animationStyleId) || orbs.find((o) => isBlobCfg(o.cfg)) || orbs[0]
    const selectedCfg = selectedPreset?.cfg || {}
    const blobOn = isBlobCfg(selectedCfg)
    const blobPick = parseOrbBag(orbBag)
    const liveBlob: BloubPick = {
        shape: resolveBloubShape(blobPick.shape || selectedCfg.shape),
        expression: resolveBloubExpression(blobPick.expression || selectedCfg.expression || DEFAULT_EXPRESSION),
        color: resolveBloubColor(blobPick.color || selectedCfg.color || DEFAULT_COLOR),
    }

    function pickNeed(id: NeedId) {
        const next = needById(id)
        const prev = need ? needById(need) : null
        setNeed(id)
        setHeadline((h) => {
            if (!h.trim() || (prev && h.trim() === prev.headline)) return next.headline
            return h
        })
        setAddons(suggestedAddons(next.role))
        setMoreOpen(next.role === "CUSTOM")
    }

    function toggleAddon(id: AddonId) {
        setAddons((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    }

    async function uploadFace(file?: File) {
        if (!file) return
        setUploading(true)
        try {
            const body = new FormData()
            body.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body })
            const json = await res.json()
            if (!json.url) {
                toast.error("Upload failed")
                return
            }
            setImageUrl(json.url)
            setFace("photo")
        } catch {
            toast.error("Upload failed")
        } finally {
            setUploading(false)
        }
    }

    async function launch() {
        if (!need || name.trim().length < 2) return
        setBusy(true)
        try {
            const bag = blobOn ? writeOrbBag(orbBag || undefined, liveBlob) : orbBag
            const result = await createProfile({
                roleTemplate: picked.role,
                primaryGoal: picked.goal,
                displayName: name.trim(),
                headline: previewHeadline,
                bio: "",
                language: "en",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                animationStyleId: animationStyleId || blobPreset?.id || presets[0]?.id,
                needId: need,
                addons,
                activate,
                imageUrl: face === "photo" ? imageUrl : undefined,
                chatAvatarMode: face === "photo" && imageUrl ? "IMAGE" : "ORB",
                personalityConfig: bag || undefined,
            })
            toast.success("You're live")
            router.push(result?.next || picked.next)
        } catch {
            toast.error("Could not create your page")
            setBusy(false)
        }
    }

    const labels = ["You", "Bot", "Name", "Look"]

    return (
        <div className="relative isolate min-h-dvh overflow-hidden auth-scene text-zinc-100">
            <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
                <div className="mb-5 flex items-center justify-between">
                    <Logo href="/" />
                    <StudioSignOut className="max-w-28 text-xs" />
                </div>

                <div className="mb-6">
                    <div className="flex items-center justify-between text-[11px] text-white/35">
                        <span>{labels[step - 1]}</span>
                        <span>{step} / 4</span>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-cyan-400" : "bg-white/10")} />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        {step === 1 && (
                            <div className="flex flex-1 flex-col">
                                <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Who are you?</h1>
                                <p className="mt-1.5 text-sm text-white/40">What you do. Next, we suggest what the bot should handle.</p>
                                <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
                                    {NEEDS.map((n) => {
                                        const Icon = NEED_ICON[n.id]
                                        const on = need === n.id
                                        return (
                                            <button
                                                key={n.id}
                                                type="button"
                                                onClick={() => pickNeed(n.id)}
                                                className={cn(
                                                    "rounded-[1.25rem] border px-3.5 py-3.5 text-left transition-colors",
                                                    on
                                                        ? "border-cyan-400/70 bg-cyan-400/10"
                                                        : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
                                                )}
                                            >
                                                <Icon className={cn("h-4 w-4", on ? "text-cyan-300" : "text-white/45")} />
                                                <p className="mt-2 text-sm font-medium">{n.title}</p>
                                                <p className="mt-0.5 text-[12px] leading-snug text-white/40">{n.blurb}</p>
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="mt-auto pt-6">
                                    <Button
                                        type="button"
                                        className="h-12 w-full rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                                        disabled={!need}
                                        onClick={() => setStep(2)}
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex min-h-0 flex-1 flex-col">
                                <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">What should your bot do?</h1>
                                <p className="mt-1.5 text-sm text-white/40">
                                    {picked.role === "CUSTOM"
                                        ? "Tap what you need. Skip this and it's just a page."
                                        : `Suggested for ${picked.folk}. Tap more if you want.`}
                                </p>

                                {suggested.length > 0 ? (
                                    <div className="mt-5">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-300/80">Suggested</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {ADDONS.filter((a) => suggested.includes(a.id)).map((addon) => {
                                                const Icon = ADDON_ICON[addon.id]
                                                return (
                                                    <div key={addon.id} className="rounded-[1.25rem] border border-cyan-400/60 bg-cyan-400/10 px-3.5 py-3.5 text-left">
                                                        <Icon className="h-4 w-4 text-cyan-300" />
                                                        <p className="mt-2 text-sm font-medium">{addon.action}</p>
                                                        <p className="mt-0.5 text-[12px] leading-snug text-white/40">{addon.blurb}</p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => setAddons([])}
                                            className={cn(
                                                "rounded-[1.25rem] border px-3.5 py-3.5 text-left",
                                                addons.length === 0
                                                    ? "border-cyan-400/70 bg-cyan-400/10"
                                                    : "border-white/10 bg-white/[0.04]",
                                            )}
                                        >
                                            <Sparkles className={cn("h-4 w-4", addons.length === 0 ? "text-cyan-300" : "text-white/45")} />
                                            <p className="mt-2 text-sm font-medium">Just a page</p>
                                            <p className="mt-0.5 text-[12px] leading-snug text-white/40">One link. Chat. Decide later.</p>
                                        </button>
                                        {ADDONS.map((addon) => {
                                            const Icon = ADDON_ICON[addon.id]
                                            const on = addons.includes(addon.id)
                                            return (
                                                <button
                                                    key={addon.id}
                                                    type="button"
                                                    onClick={() => toggleAddon(addon.id)}
                                                    className={cn(
                                                        "rounded-[1.25rem] border px-3.5 py-3.5 text-left",
                                                        on
                                                            ? "border-cyan-400/60 bg-cyan-400/10"
                                                            : "border-white/10 bg-white/[0.03]",
                                                    )}
                                                >
                                                    <Icon className={cn("h-4 w-4", on ? "text-cyan-300" : "text-white/45")} />
                                                    <p className="mt-2 text-sm font-medium">{addon.action}</p>
                                                    <p className="mt-0.5 text-[12px] leading-snug text-white/40">{addon.blurb}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {extraAddons.length > 0 && suggested.length > 0 ? (
                                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => setMoreOpen((v) => !v)}
                                            className="flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left"
                                        >
                                            <span>
                                                <span className="block text-sm font-medium">Need anything else?</span>
                                                <span className="mt-0.5 block text-[12px] text-white/40">
                                                    {extraOn.length ? extraOn.map((a) => a.action).join(" · ") : "Leads, shop, courses, and more"}
                                                </span>
                                            </span>
                                            <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/40 transition-transform", moreOpen && "rotate-180")} />
                                        </button>
                                        {moreOpen ? (
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                {extraAddons.map((addon) => {
                                                    const Icon = ADDON_ICON[addon.id]
                                                    const on = addons.includes(addon.id)
                                                    return (
                                                        <button
                                                            key={addon.id}
                                                            type="button"
                                                            onClick={() => toggleAddon(addon.id)}
                                                            className={cn(
                                                                "rounded-[1.25rem] border px-3.5 py-3.5 text-left",
                                                                on ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]",
                                                            )}
                                                        >
                                                            <Icon className={cn("h-4 w-4", on ? "text-cyan-300" : "text-white/45")} />
                                                            <p className="mt-2 text-sm font-medium">{addon.action}</p>
                                                            <p className="mt-0.5 text-[12px] leading-snug text-white/40">{addon.blurb}</p>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                <div className="mt-auto flex gap-2 pt-6">
                                    <Button type="button" variant="outline" className="h-12 flex-1 rounded-full border-white/15 bg-transparent text-white" onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                    <Button type="button" className="h-12 flex-[1.4] rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300" onClick={() => setStep(3)}>
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex flex-1 flex-col">
                                <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">How should people meet you?</h1>
                                <p className="mt-1.5 text-sm text-white/40">Name and one line. This is the first thing they see.</p>

                                <div className="auth-glass mt-5 px-5 py-5">
                                    <div className="relative z-10">
                                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Live on your page</p>
                                        <p className="mt-2 text-xl font-medium tracking-tight">{name.trim() || "Your name"}</p>
                                        <p className="mt-1 text-sm text-white/45">{previewHeadline}</p>
                                        <p className="mt-3 text-[11px] text-cyan-300/80">{picked.title}</p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <label className="block space-y-1.5">
                                        <span className="text-[12px] text-white/45">Name</span>
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Your name or shop"
                                            autoFocus
                                            className="h-13 h-14 rounded-2xl border-white/10 bg-white/5 text-base text-white placeholder:text-zinc-500"
                                        />
                                    </label>
                                    <label className="block space-y-1.5">
                                        <span className="text-[12px] text-white/45">One line</span>
                                        <Input
                                            value={headline}
                                            onChange={(e) => setHeadline(e.target.value)}
                                            placeholder={picked.headline}
                                            className="h-12 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                        />
                                    </label>
                                </div>

                                <div className="mt-auto flex gap-2 pt-6">
                                    <Button type="button" variant="outline" className="h-12 flex-1 rounded-full border-white/15 bg-transparent text-white" onClick={() => setStep(2)}>
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        className="h-12 flex-[1.4] rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                                        disabled={name.trim().length < 2}
                                        onClick={() => setStep(4)}
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="flex min-h-0 flex-1 flex-col">
                                <h1 className="text-[1.7rem] font-medium tracking-[-0.03em]">Your face on the page</h1>
                                <p className="mt-1.5 text-sm text-white/40">An orb, or your photo / logo. You can change this later.</p>

                                <div className="mt-5 flex justify-center">
                                    {face === "photo" && imageUrl ? (
                                        <img src={imageUrl} alt="" className="h-28 w-28 rounded-full object-cover ring-2 ring-cyan-400/50" />
                                    ) : (
                                        <WelcomeOrb
                                            size={112}
                                            colors={(selectedCfg.colors || ["#f7f7f8", "#d8d8dc"]) as [string, string]}
                                            variant={selectedCfg.variant}
                                            look={selectedCfg.look}
                                            skin={selectedCfg.skin}
                                            shape={blobOn ? liveBlob.shape : selectedCfg.shape}
                                            expression={blobOn ? liveBlob.expression : selectedCfg.expression}
                                            color={blobOn ? liveBlob.color : selectedCfg.color}
                                            speed={selectedCfg.speed || 1}
                                            intensity={selectedCfg.intensity || 1}
                                        />
                                    )}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-full bg-white/5 p-1">
                                    {(["orb", "photo"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setFace(mode)}
                                            className={cn(
                                                "h-9 rounded-full text-sm font-medium",
                                                face === mode ? "bg-white text-zinc-950" : "text-white/50",
                                            )}
                                        >
                                            {mode === "orb" ? "Orb" : "Photo / logo"}
                                        </button>
                                    ))}
                                </div>

                                {face === "photo" ? (
                                    <div className="mt-4">
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="sr-only"
                                            onChange={(e) => {
                                                void uploadFace(e.target.files?.[0])
                                                e.target.value = ""
                                            }}
                                        />
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            onClick={() => fileRef.current?.click()}
                                            className="flex w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-white/15 bg-white/[0.03] px-4 py-8"
                                        >
                                            <ImagePlus className="h-5 w-5 text-cyan-300" />
                                            <span className="text-sm font-medium">{uploading ? "Uploading…" : imageUrl ? "Change photo" : "Upload a photo or logo"}</span>
                                            <span className="text-[12px] text-white/40">Square works best. Used in chat if you skip the orb.</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">
                                        <div className="grid grid-cols-3 gap-2">
                                            {orbs.map(({ preset, cfg }) => {
                                                const selected = animationStyleId === preset.id
                                                const blob = isBlobCfg(cfg)
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAnimationStyleId(preset.id)
                                                            setFace("orb")
                                                            if (blob) setBlobOpen(true)
                                                        }}
                                                        className={cn(
                                                            "flex flex-col items-center rounded-2xl border px-1.5 py-2.5",
                                                            selected ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]",
                                                        )}
                                                    >
                                                        <WelcomeOrb
                                                            size={56}
                                                            colors={(cfg.colors || ["#00D7FF", "#07104D"]) as [string, string]}
                                                            variant={cfg.variant}
                                                            look={cfg.look}
                                                            skin={cfg.skin}
                                                            shape={blob && selected ? liveBlob.shape : cfg.shape}
                                                            expression={blob && selected ? liveBlob.expression : blob ? DEFAULT_EXPRESSION : cfg.expression}
                                                            color={blob && selected ? liveBlob.color : blob ? DEFAULT_COLOR : cfg.color}
                                                            speed={cfg.speed || 1}
                                                            intensity={cfg.intensity || 1}
                                                        />
                                                        <span className="mt-1.5 truncate text-[10px] text-white/55">{preset.name}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {blobOn ? (
                                            <button type="button" onClick={() => setBlobOpen(true)} className="mt-3 w-full text-center text-xs font-medium text-cyan-300">
                                                Customise blob
                                            </button>
                                        ) : null}
                                    </div>
                                )}

                                <div className="mt-auto flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="h-12 flex-1 rounded-full border-white/15 bg-transparent text-white" onClick={() => setStep(3)}>
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        className="h-12 flex-[1.4] rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                                        disabled={busy || (face === "photo" && !imageUrl)}
                                        onClick={() => void launch()}
                                    >
                                        {busy ? "Launching…" : "Launch my page"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <BloubCustomizerSheet
                open={blobOpen}
                onClose={() => setBlobOpen(false)}
                value={liveBlob}
                onChange={(next) => setOrbBag(writeOrbBag(orbBag || undefined, { ...liveBlob, ...next }))}
            />
        </div>
    )
}
