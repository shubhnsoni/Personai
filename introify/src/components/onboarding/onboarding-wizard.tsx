"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { WelcomeAnimationPreset } from "@prisma/client"
import {
    ArrowUp,
    AtSign,
    Check,
    ChevronLeft,
    Layers,
    Smile,
    SlidersHorizontal,
    Sparkles,
    Store,
    User,
} from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { StudioSignOut } from "@/components/dashboard/studio-sign-out"
import { checkUsername, createProfile } from "@/app/actions/onboarding"
import { formatShopLink } from "@/lib/public-url"
import { normalizeUsername, suggestedUsername, usernameError } from "@/lib/username"
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
import Link from "@/components/navigation/transition-link"
import { PLAN_CATALOG } from "@/lib/billing/catalog"
import { DEFAULT_BLOUB_PICK, writeOrbBag, type BloubPick } from "@/lib/bloub/catalog"
import { BlobLookStudio } from "@/components/onboarding/blob-look"
import { ProfileImportBuilder } from "@/components/profile/profile-import-builder"
import type { ProfileBlueprint, ProfileImportPreview } from "@/lib/profile-import-contract"

type Line = { id: string; role: "bot" | "user"; text: string; sub?: string }

const RAIL: { beat: OnboardBeat; label: string; icon: typeof Store }[] = [
    { beat: "name", label: "Name", icon: Store },
    { beat: "username", label: "Link", icon: AtSign },
    { beat: "who", label: "Who", icon: User },
    { beat: "type", label: "Kit", icon: Sparkles },
    { beat: "features", label: "Features", icon: Layers },
    { beat: "extras", label: "Extras", icon: SlidersHorizontal },
    { beat: "look", label: "Look", icon: Smile },
    { beat: "ready", label: "Ready", icon: Check },
]

function uid() {
    return Math.random().toString(36).slice(2, 9)
}

function botFor(beat: OnboardBeat, need: NeedId | null): Line {
    if (beat === "name") return { id: uid(), role: "bot", text: COPY.name.h, sub: COPY.name.s }
    if (beat === "username") return { id: uid(), role: "bot", text: COPY.username.h, sub: COPY.username.s }
    if (beat === "who") return { id: uid(), role: "bot", text: COPY.who.h, sub: COPY.who.s }
    if (beat === "type") return { id: uid(), role: "bot", text: COPY.type.h, sub: COPY.type.s }
    if (beat === "features") return { id: uid(), role: "bot", text: COPY.features.h, sub: COPY.features.s }
    if (beat === "extras") {
        const x = extrasCopy(need)
        return { id: uid(), role: "bot", text: x.h, sub: x.s }
    }
    if (beat === "look") return { id: uid(), role: "bot", text: COPY.look.h, sub: COPY.look.s }
    return { id: uid(), role: "bot", text: COPY.ready.h, sub: COPY.ready.s }
}

export function OnboardingWizard({
    presets: _presets,
    suggestedName,
    initialNeed,
    activate = false,
    billingAccountId,
}: {
    presets: WelcomeAnimationPreset[]
    suggestedName?: string
    initialNeed?: NeedId
    activate?: boolean
    billingAccountId?: string
}) {
    const router = useRouter()
    const scroller = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [beat, setBeat] = useState<OnboardBeat>("name")
    const [history, setHistory] = useState<Line[]>(() => [botFor("name", initialNeed || null)])
    const [draft, setDraft] = useState(suggestedName || "")
    const [name, setName] = useState(suggestedName || "")
    const [username, setUsername] = useState(() => suggestedUsername(suggestedName || ""))
    const [speakerName, setSpeakerName] = useState("")
    const [speakerRole, setSpeakerRole] = useState("")
    const [need, setNeed] = useState<NeedId | null>(initialNeed || null)
    const [addons, setAddons] = useState<AddonId[]>(initialNeed ? defaultAddons(initialNeed) : [])
    const [elseOpen, setElseOpen] = useState(initialNeed === "page")
    const [elseQuery, setElseQuery] = useState("")
    const [whatsapp, setWhatsapp] = useState("")
    const [email, setEmail] = useState("")
    const [gstin, setGstin] = useState("")
    const [upi, setUpi] = useState("")
    const [goldCity, setGoldCity] = useState<string>("Ranchi")
    const [inviteDesks, setInviteDesks] = useState(true)
    const [busy, setBusy] = useState(false)
    const [orb, setOrb] = useState<BloubPick>({ ...DEFAULT_BLOUB_PICK })
    const [importing, setImporting] = useState(false)
    const [importDraft, setImportDraft] = useState<{ id: string; draft: ProfileBlueprint } | null>(null)

    const picked = needById(need)
    const suggested = need ? defaultAddons(need) : []
    const extraAddons = ADDONS.filter((a) => !suggested.includes(a.id))
    const kitQuery = beat === "type" && !elseOpen ? draft : ""
    const visibleKits = filterKitChips(kitQuery)
    const visibleElse = matchElseChip(elseQuery)
    const extrasReady = need !== "goldWholesale" || goldCity.trim().length >= 2

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
        const order: OnboardBeat[] = ["name", "username", "who", "type", "features", "extras", "look", "ready"]
        const prev = (() => {
            if (beat === "ready") return "look"
            if (beat === "look") return hasExtrasBeat(need) ? "extras" : "features"
            if (importDraft && beat === "features") return "username"
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
        const next = hasExtrasBeat(need) ? "extras" : "look"
        const label = addons.length ? ADDONS.filter((a) => addons.includes(a.id)).map((a) => a.action).join(" · ") : "Just a page"
        push(label, next)
    }

    function afterExtras() {
        if (!extrasReady) {
            toast.message(COPY.extras.cityEnter)
            return
        }
        const bits = [
            need === "goldWholesale" ? goldCity.trim() : "",
            whatsapp ? `Phone ${normalizeWhatsapp(whatsapp) || whatsapp}` : "",
            email.trim() ? email.trim() : "",
            gstin.trim() ? `GSTIN ${gstin.trim()}` : "",
            need === "distribute" ? (inviteDesks ? COPY.extras.desksInvite : COPY.extras.desksJustMe) : "",
        ].filter(Boolean)
        push(bits.join(" · ") || COPY.extras.continue, "look")
    }

    function useImport(preview: ProfileImportPreview, blueprint: ProfileBlueprint) {
        const displayName = blueprint.profile.displayName.trim()
        setImportDraft({ id: preview.id, draft: blueprint })
        setName(displayName)
        setSpeakerName(displayName)
        setNeed(blueprint.needId)
        setAddons(blueprint.addons as AddonId[])
        const next = suggestedUsername(displayName)
        setUsername(next)
        setImporting(false)
        setHistory((h) => [...h, { id: uid(), role: "user", text: "Imported my profile" }, botFor("username", blueprint.needId)])
        setBeat("username")
        setDraft(next)
    }

    async function launch(seedSample: boolean) {
        if (!need || name.trim().length < 2) return
        setBusy(true)
        try {
            const result = await createProfile({
                importDraft: importDraft ? { id: importDraft.id, draft: { ...importDraft.draft, needId: need!, addons, profile: { ...importDraft.draft.profile, displayName: name.trim() || importDraft.draft.profile.displayName } } } : undefined,
                billingAccountId,
                roleTemplate: picked.role,
                primaryGoal: picked.goal,
                displayName: name.trim(),
                username,
                headline: importDraft ? importDraft.draft.profile.headline : picked.headline,
                bio: importDraft ? importDraft.draft.profile.bio : speakerName ? `${speakerName}${speakerRole ? ` · ${speakerRole}` : ""}` : "",
                language: "en",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                needId: need,
                addons,
                activate,
                speakerName: speakerName || undefined,
                speakerRole: speakerRole || undefined,
                whatsapp: normalizeWhatsapp(whatsapp) || undefined,
                email: email.trim() || undefined,
                gstin: gstin.trim() || undefined,
                upiId: upi.trim() || undefined,
                goldCity: need === "goldWholesale" ? goldCity : undefined,
                distroInviteDesks: need === "distribute" ? inviteDesks : undefined,
                personalityConfig: writeOrbBag(undefined, orb, false),
                seedSample,
            })
            toast.success("You're live")
            router.push(result?.next || picked.next)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not create your page")
            setBusy(false)
        }
    }

    function onSend() {
        const text = draft.trim()
        if (beat === "name") {
            if (text.length < 2) return
            setName(text)
            const next = suggestedUsername(text)
            setUsername(next)
            setHistory((h) => [...h, { id: uid(), role: "user", text }, botFor("username", need)])
            setBeat("username")
            setDraft(next)
            return
        }
        if (beat === "username") {
            const next = normalizeUsername(text || username)
            const err = usernameError(next)
            if (err) {
                toast.error(err)
                return
            }
            setBusy(true)
            void checkUsername(next).then((result) => {
                setBusy(false)
                if (!result.ok) {
                    toast.error(result.error)
                    return
                }
                setUsername(result.slug)
                push(result.slug, importDraft ? "features" : "who")
            }).catch(() => {
                setBusy(false)
                toast.error("Could not check that username")
            })
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
    }

    function toggleAddon(id: AddonId) {
        setAddons((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    }

    const composerOn = beat === "name" || beat === "username" || beat === "who" || beat === "type"
    const placeholder =
        beat === "name" ? COPY.name.placeholder
        : beat === "username" ? COPY.username.placeholder
        : beat === "who" ? COPY.who.placeholder
        : beat === "type" && elseOpen ? COPY.type.elsePlaceholder
        : beat === "type" ? "Filter kits"
        : ""

    const railBeats = RAIL.filter((s) => s.beat !== "extras" || hasExtrasBeat(need) || beat === "extras")
    const beatIndex = railBeats.findIndex((s) => s.beat === beat)

    return (
        <div className="relative isolate flex h-dvh overflow-hidden auth-scene text-zinc-100">
            <aside className="relative z-10 sticky top-0 hidden h-full w-16 shrink-0 flex-col items-center overflow-hidden border-r border-white/10 py-5 lg:flex">
                <Logo href="/" size="sm" variant="icon" className="w-10 text-base" />
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

            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 lg:px-10">
                <div className="mb-4 flex shrink-0 items-center justify-between gap-3 lg:mb-6">
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

                <p className="mb-5 shrink-0 text-xs leading-relaxed text-white/60">Start on Free with {PLAN_CATALOG.free.aiCredits} monthly AI credits and one eligible trial 3D generation. Service availability is shown in Billing. <Link href="/pricing" target="_blank" rel="noopener noreferrer" className="text-lime-300 underline underline-offset-4">Compare plans<span className="sr-only"> (opens in a new tab)</span></Link></p>
                <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" role="log" aria-live="polite">
                    <div className="flex flex-col gap-4 pb-4">
                        {history.map((line) => (
                            <div key={line.id} className={cn("flex", line.role === "user" ? "justify-end" : "justify-start")}>
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-[1.35rem] px-4 py-3",
                                        line.role === "user" ? "bg-white/[0.08] text-zinc-100" : "bg-white/[0.06] text-zinc-100",
                                    )}
                                >
                                    <p className="text-[15px] leading-snug">{line.text}</p>
                                    {line.sub ? <p className="mt-1 text-[13px] leading-snug text-white/40">{line.sub}</p> : null}
                                </div>
                            </div>
                        ))}
                    </div>

                    {beat === "name" ? (
                        <div className="mt-2">
                            {importing ? (
                                <ProfileImportBuilder
                                    context={billingAccountId ? { billingAccountId } : {}}
                                    onUse={useImport}
                                    onCancel={() => setImporting(false)}
                                />
                            ) : (
                                <Chip onClick={() => setImporting(true)}>Import my profile</Chip>
                            )}
                        </div>
                    ) : null}

                    {beat === "username" ? (
                        <p className="mt-2 text-[13px] text-white/45">
                            {formatShopLink(normalizeUsername(draft || username) || "username", "PATH")}
                            <span className="text-white/30"> · or {formatShopLink(normalizeUsername(draft || username) || "username", "SUBDOMAIN")}</span>
                        </p>
                    ) : null}

                    {beat === "who" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Chip onClick={() => { setSpeakerName(""); setSpeakerRole(""); push(COPY.who.skip, "type") }}>{COPY.who.skip}</Chip>
                        </div>
                    ) : null}

                    {beat === "type" ? (
                        <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {visibleKits.map((k) => (
                                    <Chip key={k.id} selected={need === k.id} onClick={() => afterType(k.id, k.line)}>
                                        {k.line}
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
                                    <p className="text-[12px] text-white/45">{COPY.type.elseHint}</p>
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
                            <Chip selected onClick={afterFeatures}>{COPY.features.confirm}</Chip>
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
                                    <p className="text-[15px] font-semibold text-white/90">{COPY.extras.cityLabel}</p>
                                    <p className="mt-0.5 text-[12px] text-white/40">{COPY.extras.cityHint}</p>
                                    <input
                                        aria-label={COPY.extras.cityEnter}
                                        value={goldCity}
                                        onChange={(e) => setGoldCity(e.target.value)}
                                        placeholder={COPY.extras.cityEnter}
                                        className="mt-2 h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
                                    />
                                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {GOLD_CITIES.map((city) => (
                                            <button
                                                key={city}
                                                type="button"
                                                onClick={() => setGoldCity(city)}
                                                className={cn(
                                                    "min-h-12 rounded-[1.1rem] border px-4 py-3.5 text-left text-[15px] font-medium",
                                                    goldCity.trim().toLowerCase() === city.toLowerCase() ? "border-cyan-400 bg-cyan-400/20 text-cyan-50 ring-1 ring-cyan-400/50" : "border-white/10 bg-white/[0.04] text-white/80",
                                                )}
                                            >
                                                {city}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <label className="block space-y-1.5">
                                <span className="text-[13px] font-medium text-white/80">{COPY.extras.phoneLabel}</span>
                                <input
                                    aria-label={COPY.extras.phoneLabel}
                                    inputMode="tel"
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    placeholder="91xxxxxxxxxx"
                                    className="h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-[13px] font-medium text-white/80">{COPY.extras.emailLabel}</span>
                                <input
                                    aria-label={COPY.extras.emailLabel}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@shop.com"
                                    className="h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
                                />
                            </label>
                            {(need === "pharmacy" || need === "distribute" || need === "goldWholesale") ? (
                                <label className="block space-y-1.5">
                                    <span className="text-[13px] font-medium text-white/80">{COPY.extras.gstinPlaceholder}</span>
                                    <input
                                        aria-label={COPY.extras.gstinPlaceholder}
                                        value={gstin}
                                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                                        placeholder={COPY.extras.gstinPlaceholder}
                                        className="h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
                                    />
                                </label>
                            ) : null}
                            <button
                                type="button"
                                disabled={!extrasReady}
                                onClick={afterExtras}
                                className="h-12 w-full rounded-full bg-cyan-400 text-sm font-medium text-zinc-950 disabled:opacity-40"
                            >
                                {COPY.extras.continue}
                            </button>
                        </div>
                    ) : null}

                    {beat === "look" ? (
                        <BlobLookStudio
                            name={name}
                            value={orb}
                            onChange={(next) => setOrb((cur) => ({ ...cur, ...next }))}
                            phase="edit"
                            onContinue={() => push(COPY.look.continue, "ready")}
                            onSave={() => void launch(false)}
                            onModify={() => {}}
                            busy={busy}
                        />
                    ) : null}

                    {beat === "ready" ? (
                        <BlobLookStudio
                            name={name}
                            value={orb}
                            onChange={(next) => setOrb((cur) => ({ ...cur, ...next }))}
                            phase="preview"
                            onContinue={() => {}}
                            onSave={() => void launch(false)}
                            onModify={() => {
                                setHistory((h) => h.slice(0, -2))
                                setBeat("look")
                            }}
                            busy={busy}
                        />
                    ) : null}
                </div>

                {composerOn ? (
                    <form
                        className="mt-3 flex shrink-0 items-center gap-2 pb-1"
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
