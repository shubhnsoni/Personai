"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { WelcomeAnimationPreset } from "@prisma/client"
import {
    ArrowUp,
    Check,
    ChevronLeft,
    Layers,
    SlidersHorizontal,
    Sparkles,
    Store,
    User,
} from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { createProfile } from "@/app/actions/onboarding"
import { ADDONS, needById, type AddonId, type NeedId } from "@/lib/onboarding-needs"
import {
    BRANCH_NEEDS,
    COPY,
    ELSE_CHIPS,
    GOLD_CITIES,
    KIT_CHIPS,
    defaultAddons,
    extrasCopy,
    filterKitChips,
    hasExtrasBeat,
    matchElseChip,
    matchNeedFromQuery,
    normalizeWhatsapp,
    splitSpeaker,
    type OnboardBeat,
} from "@/lib/onboarding-chat"
import { cn } from "@/lib/utils"

type Line = { id: string; role: "bot" | "user"; text: string; sub?: string }

const RAIL: { beat: OnboardBeat; label: string; icon: typeof Store }[] = [
    { beat: "name", label: "Name", icon: Store },
    { beat: "who", label: "Who", icon: User },
    { beat: "type", label: "Kit", icon: Sparkles },
    { beat: "features", label: "Features", icon: Layers },
    { beat: "extras", label: "Extras", icon: SlidersHorizontal },
    { beat: "ready", label: "Ready", icon: Check },
]

function uid() {
    return Math.random().toString(36).slice(2, 9)
}

function botFor(beat: OnboardBeat, need: NeedId | null): Line {
    if (beat === "name") return { id: uid(), role: "bot", text: COPY.name.h, sub: COPY.name.s }
    if (beat === "who") return { id: uid(), role: "bot", text: COPY.who.h, sub: COPY.who.s }
    if (beat === "type") return { id: uid(), role: "bot", text: COPY.type.h, sub: COPY.type.s }
    if (beat === "features") return { id: uid(), role: "bot", text: COPY.features.h, sub: COPY.features.s }
    if (beat === "extras") {
        const x = extrasCopy(need)
        return { id: uid(), role: "bot", text: x.h, sub: x.s }
    }
    return { id: uid(), role: "bot", text: COPY.ready.h, sub: COPY.ready.s }
}

export function OnboardingWizard({
    presets: _presets,
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
    const scroller = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [beat, setBeat] = useState<OnboardBeat>("name")
    const [history, setHistory] = useState<Line[]>(() => [botFor("name", initialNeed || null)])
    const [draft, setDraft] = useState(suggestedName || "")
    const [name, setName] = useState(suggestedName || "")
    const [speakerName, setSpeakerName] = useState("")
    const [speakerRole, setSpeakerRole] = useState("")
    const [need, setNeed] = useState<NeedId | null>(initialNeed || null)
    const [addons, setAddons] = useState<AddonId[]>(initialNeed ? defaultAddons(initialNeed) : [])
    const [elseOpen, setElseOpen] = useState(initialNeed === "page")
    const [elseQuery, setElseQuery] = useState("")
    const [whatsapp, setWhatsapp] = useState("")
    const [gstin, setGstin] = useState("")
    const [upi, setUpi] = useState("")
    const [waLater, setWaLater] = useState(false)
    const [goldCity, setGoldCity] = useState<string>("Ranchi")
    const [inviteDesks, setInviteDesks] = useState(true)
    const [busy, setBusy] = useState(false)

    const picked = needById(need)
    const suggested = need ? defaultAddons(need) : []
    const extraAddons = ADDONS.filter((a) => !suggested.includes(a.id))
    const kitQuery = beat === "type" && !elseOpen ? draft : ""
    const visibleKits = filterKitChips(kitQuery)
    const visibleElse = matchElseChip(elseQuery)
    const waOk = !!normalizeWhatsapp(whatsapp)
    const extrasReady = !hasExtrasBeat(need) || waOk || waLater

    useEffect(() => {
        const el = scroller.current
        if (!el) return
        if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
        else el.scrollTop = el.scrollHeight
    }, [history, beat, elseOpen])

    useEffect(() => {
        inputRef.current?.focus()
    }, [beat])

    function push(userText: string, next: OnboardBeat, nextNeed = need) {
        setHistory((h) => [...h, { id: uid(), role: "user", text: userText }, botFor(next, nextNeed)])
        setBeat(next)
        setDraft("")
    }

    function back() {
        if (beat === "name" || history.length < 3) return
        const order: OnboardBeat[] = ["name", "who", "type", "features", "extras", "ready"]
        const prev = (() => {
            if (beat === "ready") return hasExtrasBeat(need) ? "extras" : "features"
            const i = order.indexOf(beat)
            return order[Math.max(0, i - 1)]
        })()
        setHistory((h) => h.slice(0, -2))
        setBeat(prev)
        setDraft("")
    }

    function afterType(nextNeed: NeedId, label: string) {
        setNeed(nextNeed)
        setAddons(defaultAddons(nextNeed))
        setElseOpen(nextNeed === "page" || !BRANCH_NEEDS.includes(nextNeed) && !KIT_CHIPS.some((k) => k.id === nextNeed))
        push(label, "features", nextNeed)
    }

    function afterFeatures() {
        const next = hasExtrasBeat(need) ? "extras" : "ready"
        const label = addons.length ? ADDONS.filter((a) => addons.includes(a.id)).map((a) => a.action).join(" · ") : "Just a page"
        push(label, next)
    }

    function afterExtras() {
        if (!extrasReady) {
            toast.message(COPY.extras.waWarn)
            return
        }
        const bits = [
            need === "goldWholesale" ? goldCity : "",
            whatsapp ? `WA ${normalizeWhatsapp(whatsapp)}` : waLater ? "WA later" : "",
            gstin.trim() ? `GSTIN ${gstin.trim()}` : "",
            need === "distribute" ? (inviteDesks ? COPY.extras.desksInvite : COPY.extras.desksJustMe) : "",
        ].filter(Boolean)
        push(bits.join(" · ") || COPY.extras.continue, "ready")
    }

    async function launch(seedSample: boolean) {
        if (!need || name.trim().length < 2) return
        setBusy(true)
        try {
            const result = await createProfile({
                roleTemplate: picked.role,
                primaryGoal: picked.goal,
                displayName: name.trim(),
                headline: picked.headline,
                bio: speakerName ? `${speakerName}${speakerRole ? ` · ${speakerRole}` : ""}` : "",
                language: "en",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                needId: need,
                addons,
                activate,
                speakerName: speakerName || undefined,
                speakerRole: speakerRole || undefined,
                whatsapp: normalizeWhatsapp(whatsapp) || undefined,
                gstin: gstin.trim() || undefined,
                upiId: upi.trim() || undefined,
                goldCity: need === "goldWholesale" ? goldCity : undefined,
                distroInviteDesks: need === "distribute" ? inviteDesks : undefined,
                seedSample,
            })
            toast.success("You're live")
            router.push(result?.next || picked.next)
        } catch {
            toast.error("Could not create your page")
            setBusy(false)
        }
    }

    function onSend() {
        const text = draft.trim()
        if (beat === "name") {
            if (text.length < 2) return
            setName(text)
            push(text, "who")
            return
        }
        if (beat === "who") {
            if (!text) return
            const sp = splitSpeaker(text)
            setSpeakerName(sp.name)
            setSpeakerRole(sp.role)
            push(text, "type")
            return
        }
        if (beat === "type") {
            if (elseOpen) {
                const hit = matchNeedFromQuery(elseQuery || text) || "page"
                afterType(hit, ELSE_CHIPS.find((c) => c.id === hit)?.chip || COPY.type.else)
                return
            }
            const hit = matchNeedFromQuery(text)
            if (hit) {
                const kit = KIT_CHIPS.find((k) => k.id === hit)
                afterType(hit, kit?.chip || needById(hit).title)
            }
            return
        }
        if (beat === "extras") {
            if (!whatsapp && text) {
                const n = normalizeWhatsapp(text)
                if (n) {
                    setWhatsapp(n)
                    setDraft("")
                    return
                }
                if (text.length >= 15) {
                    setGstin(text.toUpperCase())
                    setDraft("")
                    return
                }
                if (text.includes("@")) {
                    setUpi(text)
                    setDraft("")
                    return
                }
            }
            afterExtras()
        }
    }

    function toggleAddon(id: AddonId) {
        setAddons((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    }

    const composerOn = beat === "name" || beat === "who" || beat === "type" || beat === "extras"
    const placeholder =
        beat === "name" ? COPY.name.placeholder
        : beat === "who" ? COPY.who.placeholder
        : beat === "type" && elseOpen ? COPY.type.elsePlaceholder
        : beat === "type" ? "Filter kits"
        : beat === "extras" && !waOk && !waLater ? COPY.extras.waPlaceholder
        : beat === "extras" && need !== "autoParts" && !gstin ? COPY.extras.gstinPlaceholder
        : beat === "extras" ? COPY.extras.upiPlaceholder
        : ""

    const railBeats = RAIL.filter((s) => s.beat !== "extras" || hasExtrasBeat(need) || beat === "extras")
    const beatIndex = railBeats.findIndex((s) => s.beat === beat)

    return (
        <div className="relative isolate flex min-h-dvh auth-scene text-zinc-100">
            <aside className="relative z-10 hidden w-16 shrink-0 flex-col items-center border-r border-white/10 py-5 lg:flex">
                <Logo href="/" size="sm" className="text-base" />
                <nav className="mt-8 flex flex-1 flex-col items-center gap-3" aria-label="Onboarding steps">
                    {railBeats.map((s, i) => {
                        const Icon = s.icon
                        const on = s.beat === beat
                        const done = i < beatIndex
                        return (
                            <span
                                key={s.beat}
                                title={s.label}
                                className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-full border",
                                    on ? "border-cyan-400 bg-cyan-400/15 text-cyan-300" : done ? "border-white/20 text-white/70" : "border-white/10 text-white/30",
                                )}
                            >
                                <Icon className="h-4 w-4" />
                            </span>
                        )
                    })}
                </nav>
                <StudioSignOut compact className="text-white/50 hover:text-white" />
            </aside>

            <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 lg:px-10">
                <div className="mb-4 flex items-center justify-between gap-3 lg:mb-6">
                    <div className="flex items-center gap-2">
                        {beat !== "name" ? (
                            <button type="button" onClick={back} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:bg-white/5" aria-label="Back">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        ) : (
                            <span className="lg:hidden"><Logo href="/" size="sm" /></span>
                        )}
                    </div>
                    <div className="lg:hidden">
                        <StudioSignOut compact className="max-w-28 text-xs text-white/50 hover:text-white" />
                    </div>
                </div>

                <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" role="log" aria-live="polite">
                    <div className="flex flex-col gap-4 pb-4">
                        {history.map((line) => (
                            <div key={line.id} className={cn("flex", line.role === "user" ? "justify-end" : "justify-start")}>
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-[1.35rem] px-4 py-3",
                                        line.role === "user" ? "bg-cyan-400 text-zinc-950" : "bg-white/[0.06] text-zinc-100",
                                    )}
                                >
                                    <p className="text-[15px] leading-snug">{line.text}</p>
                                    {line.sub ? <p className="mt-1 text-[13px] leading-snug text-white/40">{line.sub}</p> : null}
                                </div>
                            </div>
                        ))}
                    </div>

                    {beat === "who" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Chip onClick={() => { setSpeakerName(""); setSpeakerRole(""); push(COPY.who.skip, "type") }}>{COPY.who.skip}</Chip>
                        </div>
                    ) : null}

                    {beat === "type" ? (
                        <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {visibleKits.map((k) => (
                                    <Chip key={k.id} selected={need === k.id} onClick={() => afterType(k.id, k.chip)}>
                                        {k.chip}
                                    </Chip>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => { setElseOpen(true); setNeed("page"); setDraft("") }}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-[1.2rem] border px-4 py-3.5 text-left text-sm",
                                    elseOpen ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/80",
                                )}
                            >
                                <span>{COPY.type.else}</span>
                                <span className="text-[12px] text-white/40">{COPY.type.elseHint}</span>
                            </button>
                            {elseOpen ? (
                                <div className="space-y-2 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3">
                                    <input
                                        value={elseQuery}
                                        onChange={(e) => setElseQuery(e.target.value)}
                                        placeholder={COPY.type.elsePlaceholder}
                                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/60"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {visibleElse.map((k) => (
                                            <Chip key={k.id} selected={need === k.id} onClick={() => afterType(k.id, k.chip)}>
                                                {k.chip}
                                            </Chip>
                                        ))}
                                        <Chip selected={need === "page" && !ELSE_CHIPS.some((c) => c.id === need)} onClick={() => afterType("page", COPY.type.else)}>
                                            {COPY.type.else}
                                        </Chip>
                                    </div>
                                </div>
                            ) : null}
                            {need ? <p className="text-[12px] text-white/40">{COPY.type.suggested(picked.title)}</p> : null}
                        </div>
                    ) : null}

                    {beat === "features" ? (
                        <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {suggested.length ? (
                                    ADDONS.filter((a) => suggested.includes(a.id)).map((a) => (
                                        <Chip key={a.id} selected={addons.includes(a.id)} onClick={() => toggleAddon(a.id)}>
                                            {a.action}
                                        </Chip>
                                    ))
                                ) : (
                                    <Chip selected={addons.length === 0} onClick={() => setAddons([])}>Just a page</Chip>
                                )}
                            </div>
                            {extraAddons.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {extraAddons.map((a) => (
                                        <Chip key={a.id} selected={addons.includes(a.id)} onClick={() => toggleAddon(a.id)}>
                                            {a.action}
                                        </Chip>
                                    ))}
                                </div>
                            ) : null}
                            <Chip selected onClick={afterFeatures}>{COPY.extras.continue}</Chip>
                        </div>
                    ) : null}

                    {beat === "extras" ? (
                        <div className="mt-3 space-y-3">
                            {need === "pharmacy" ? (
                                <div className="flex flex-wrap gap-2">
                                    <Chip selected>Track batch & expiry</Chip>
                                    <Chip selected>Allow prescription medicines</Chip>
                                </div>
                            ) : null}
                            {need === "autoParts" ? (
                                <div className="flex flex-wrap gap-2">
                                    <Chip selected>Fitment</Chip>
                                    <Chip selected>WA for quotes</Chip>
                                </div>
                            ) : null}
                            {need === "distribute" ? (
                                <div className="flex flex-wrap gap-2">
                                    <Chip selected={!inviteDesks} onClick={() => setInviteDesks(false)}>{COPY.extras.desksJustMe}</Chip>
                                    <Chip selected={inviteDesks} onClick={() => setInviteDesks(true)}>{COPY.extras.desksInvite}</Chip>
                                    <Chip selected>Order flow</Chip>
                                </div>
                            ) : null}
                            {need === "goldWholesale" ? (
                                <div>
                                    <p className="text-[13px] font-medium text-white/80">{COPY.extras.cityLabel}</p>
                                    <p className="mt-0.5 text-[12px] text-white/40">{COPY.extras.cityHint}</p>
                                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {GOLD_CITIES.map((city) => (
                                            <button
                                                key={city}
                                                type="button"
                                                onClick={() => setGoldCity(city)}
                                                className={cn(
                                                    "min-h-12 rounded-[1.1rem] border px-4 py-3 text-left text-[15px]",
                                                    goldCity === city ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/80",
                                                )}
                                            >
                                                {city}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                {need !== "autoParts" ? (
                                    <Chip onClick={() => setGstin("")} aria-label="Skip GSTIN">{COPY.extras.gstinSkip}</Chip>
                                ) : null}
                                <Chip selected={waLater} onClick={() => { setWaLater(true); toast.message(COPY.extras.waWarn) }}>{COPY.extras.waLater}</Chip>
                                <Chip onClick={() => undefined} aria-label="Skip email">{COPY.extras.emailSkip}</Chip>
                            </div>
                            {whatsapp && waOk ? <p className="text-[12px] text-white/45">WhatsApp {normalizeWhatsapp(whatsapp)}</p> : null}
                            <Chip selected={extrasReady} onClick={afterExtras}>{COPY.extras.continue}</Chip>
                        </div>
                    ) : null}

                    {beat === "ready" ? (
                        <div className="mt-3 space-y-2">
                            <p className="text-[12px] text-white/40">{COPY.ready.helper}</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void launch(true)}
                                    className="h-12 flex-1 rounded-full bg-cyan-400 text-sm font-medium text-zinc-950 hover:bg-cyan-300 disabled:opacity-50"
                                >
                                    {busy ? "Launching…" : COPY.ready.trySample}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void launch(false)}
                                    className="h-12 flex-1 rounded-full border border-white/15 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
                                >
                                    {COPY.ready.empty}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                {composerOn ? (
                    <form
                        className="mt-3 flex items-center gap-2 pb-1"
                        onSubmit={(e) => {
                            e.preventDefault()
                            onSend()
                        }}
                    >
                        <input
                            ref={inputRef}
                            value={beat === "type" && elseOpen ? elseQuery : draft}
                            onChange={(e) => (beat === "type" && elseOpen ? setElseQuery(e.target.value) : setDraft(e.target.value))}
                            placeholder={placeholder}
                            className="h-12 flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
                        />
                        <button
                            type="submit"
                            aria-label="Send"
                            disabled={beat === "name" && draft.trim().length < 2}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-zinc-950 hover:bg-cyan-300 disabled:opacity-40"
                        >
                            <ArrowUp className="h-5 w-5" />
                        </button>
                    </form>
                ) : null}
            </div>
        </div>
    )
}

function Chip({
    children,
    selected,
    onClick,
    "aria-label": ariaLabel,
}: {
    children: ReactNode
    selected?: boolean
    onClick?: () => void
    "aria-label"?: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] leading-none",
                selected ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]",
            )}
        >
            {children}
        </button>
    )
}
