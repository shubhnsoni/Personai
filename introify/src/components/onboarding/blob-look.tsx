"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AzureLooks } from "@/components/dashboard/azure-looks"
import { PremiumBotPreview, type PremiumBot } from "@/components/dashboard/premium-bot-preview"
import { PremiumStar } from "@/components/dashboard/premium-star"
import { WelcomeOrb } from "@/components/welcome-orb"
import {
    BLOUB_AURAS,
    BLOUB_MOODS,
    BLOB_SHAPES,
    BLOUB_THEME_META,
    CUSTOMIZER_BOTS,
    INCLUDED_BLOUB_BOTS,
    PREMIUM_BLOUB_BOTS,
    blobColorIndex,
    blobPickFromColorIndex,
    bloubBotPick,
    bloubThemeThumb,
    customizerBotPick,
    gradientForColor,
    isCustomizerBotSelected,
    isNamedBloubBotSelected,
    isPremiumBloubTheme,
    lookThemesFor,
    resolveBloubTheme,
    usesAnimojiFaces,
    usesBlobColorSlider,
    usesBlobShapes,
    type BloubPick,
} from "@/lib/bloub/catalog"
import { ANIMOJI_FACES, resolveAnimojiId } from "@/lib/animoji"
import { BlobColorSlider } from "@/components/dashboard/blob-color-slider"
import { cn } from "@/lib/utils"

export function BlobLookStudio({
    name,
    value,
    onChange,
    phase,
    onContinue,
    onSave,
    onModify,
    busy,
}: {
    name: string
    value: BloubPick
    onChange: (next: Partial<BloubPick>) => void
    phase: "edit" | "preview"
    onContinue: () => void
    onSave: () => void
    onModify: () => void
    busy: boolean
}) {
    const colors = gradientForColor(value.color)
    const themes = lookThemesFor(value)
    const showSlider = usesBlobColorSlider(value)
    const showShapes = usesBlobShapes(value)
    const [previewBot, setPreviewBot] = useState<PremiumBot | null>(null)

    if (phase === "preview") {
        return (
            <div className="mt-4 space-y-6">
                <LivePagePreview name={name} look={value} />
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onSave}
                        className="h-12 flex-1 rounded-full bg-white text-sm font-medium text-zinc-950 disabled:opacity-50"
                    >
                        {busy ? "Saving…" : "Save and go to dashboard"}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onModify}
                        className="h-12 flex-1 rounded-full border border-white/15 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
                    >
                        Keep modifying
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="mt-4 space-y-8" data-lcd-mode="dark">
            <div className="flex justify-center py-4">
                <WelcomeOrb
                    size={168}
                    look={value.look || "bloub"}
                    skin={value.skin}
                    shape={value.shape}
                    expression={value.expression}
                    color={value.color}
                    aura={value.aura}
                    theme={value.theme}
                    variant={value.variant}
                    colors={colors}
                    mood="idle"
                />
            </div>

            {showSlider ? (
                <section className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Colour</p>
                    <BlobColorSlider index={blobColorIndex(value.variant)} onChange={(i) => onChange(blobPickFromColorIndex(i, value.look))} />
                </section>
            ) : null}

            {showShapes ? (
                <section className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Shape</p>
                    <div className="grid grid-cols-5 gap-2">
                        {BLOB_SHAPES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-label={item.premium ? `${item.label}, premium` : item.label}
                                aria-pressed={value.shape === item.id}
                                onClick={() => {
                                    if (item.premium) {
                                        toast.message("This is a premium shape")
                                        return
                                    }
                                    onChange({ look: "bloub", theme: "classic", shape: item.id })
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-2xl py-2",
                                    value.shape === item.id ? "bg-white text-zinc-950" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]",
                                    item.premium && "opacity-60",
                                )}
                            >
                                <WelcomeOrb still size={44} look="bloub" shape={item.id} expression={value.expression} color={value.color} variant={value.variant} aura="still" theme="classic" />
                                <span className="text-[10px]">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ) : null}

            {themes.length ? (
                <section className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Chat themes</p>
                    <div className="grid grid-cols-2 gap-2">
                        {themes.map((item) => {
                            const thumb = bloubThemeThumb(item.id, "dark")
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-label={`${item.label} theme`}
                                    aria-pressed={value.theme === item.id}
                                    onClick={() => {
                                        if (isPremiumBloubTheme(item.id)) {
                                            toast.message("This is a premium theme")
                                            return
                                        }
                                        onChange({ theme: item.id })
                                    }}
                                    className={cn("rounded-2xl border p-3 text-left", value.theme === item.id ? "border-white/70 bg-white/[0.08]" : "border-white/15 hover:bg-white/[0.06]")}
                                >
                                    <span aria-hidden className="mb-3 flex h-12 items-center justify-center gap-2 rounded-md" style={{ background: thumb.bg }}>
                                        <span className="h-5 w-5 rounded-full" style={{ background: thumb.dot }} />
                                        <span className="h-1.5 w-9 rounded-full" style={{ background: thumb.bar }} />
                                    </span>
                                    <span className="block text-[13px] font-medium text-white">{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            ) : null}

            <AzureLooks value={value} onChange={onChange} dark />
            {usesAnimojiFaces(value) ? (
                <section className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Face</p>
                    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6" data-animoji-grid>
                        {ANIMOJI_FACES.map((item) => {
                            const selected = resolveAnimojiId(value.skin) === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-label={item.label}
                                    aria-pressed={selected}
                                    onClick={() => onChange({ look: "animoji", skin: item.id, theme: "classic", shape: "cercle" })}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-2xl py-2",
                                        selected ? "bg-white text-zinc-950" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]",
                                    )}
                                >
                                    <WelcomeOrb still size={40} look="animoji" skin={item.id} aura="still" theme="classic" />
                                    <span className="text-[10px]">{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            ) : null}
            <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Mood</p>
                <div className="flex flex-wrap gap-2">
                    {BLOUB_MOODS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onChange({ expression: item.id })}
                            className={cn(
                                "rounded-full px-3.5 py-2 text-[13px]",
                                value.expression === item.id ? "bg-white text-zinc-950" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Aura</p>
                <div className="flex flex-wrap gap-2">
                    {BLOUB_AURAS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onChange({ aura: item.id })}
                            aria-pressed={value.aura === item.id}
                            className={cn(
                                "rounded-full px-3.5 py-2 text-[13px]",
                                value.aura === item.id ? "bg-white text-zinc-950" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Bots</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {CUSTOMIZER_BOTS.map((bot) => {
                        const selected = isCustomizerBotSelected(bot, value)
                        return (
                            <button
                                key={bot.id}
                                type="button"
                                aria-label={bot.premium ? `${bot.label}, premium` : bot.label}
                                aria-pressed={selected}
                                onClick={() => {
                                    if (bot.premium) {
                                        setPreviewBot(bot)
                                        return
                                    }
                                    onChange(customizerBotPick(bot, value))
                                }}
                                className={cn(
                                    "relative flex flex-col items-center gap-1 rounded-2xl py-2",
                                    selected ? "bg-white text-zinc-950" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]",
                                )}
                            >
                                {bot.premium ? <PremiumStar /> : null}
                                <WelcomeOrb
                                    still
                                    size={56}
                                    look={bot.look}
                                    skin={bot.skin}
                                    shape="cercle"
                                    expression={value.expression}
                                    color={value.color}
                                    variant={value.variant}
                                    aura="still"
                                    theme="classic"
                                />
                                <span className="text-[10px]">{bot.label}</span>
                            </button>
                        )
                    })}
                    {INCLUDED_BLOUB_BOTS.map((bot) => {
                        const selected = isNamedBloubBotSelected(bot, value)
                        return (
                            <button
                                key={bot.label}
                                type="button"
                                aria-label={bot.label}
                                aria-pressed={selected}
                                onClick={() => onChange(bloubBotPick(bot, value))}
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-2xl py-2",
                                    selected ? "bg-white text-zinc-950" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]",
                                )}
                            >
                                <WelcomeOrb still size={56} look="bloub" shape={bot.id} expression={bot.expression} color={bot.color} aura="still" theme={bot.theme} />
                                <span className="text-[10px]">{bot.label}</span>
                            </button>
                        )
                    })}
                    {PREMIUM_BLOUB_BOTS.map((bot) => (
                        <button
                            key={bot.label}
                            type="button"
                            aria-label={`${bot.label}, premium`}
                            onClick={() => setPreviewBot(bot)}
                            className="relative flex flex-col items-center gap-1 rounded-2xl bg-white/[0.04] py-2 text-white/75 hover:bg-white/[0.1]"
                        >
                            <PremiumStar />
                            <WelcomeOrb still size={56} look="bloub" shape={bot.id} expression={bot.expression} color={bot.color} aura="still" theme={bot.theme} />
                            <span className="text-[10px]">{bot.label}</span>
                        </button>
                    ))}
                </div>
            </section>
            <PremiumBotPreview bot={previewBot} onClose={() => setPreviewBot(null)} upgradeHref="/pricing" />

            <button
                type="button"
                onClick={onContinue}
                className="h-12 w-full rounded-full bg-white text-sm font-medium text-zinc-950"
            >
                Looks right
            </button>
        </div>
    )
}

function LivePagePreview({ name, look }: { name: string; look: BloubPick }) {
    const colors = gradientForColor(look.color)
    const retro = look.theme === "retro-lcd"
    const meta = BLOUB_THEME_META[resolveBloubTheme(look.theme)]
    const canvas = meta?.canvas.dark
    const ink = retro ? "#c4d58a" : meta ? "#f6f4ee" : undefined
    return (
        <div
            className="overflow-hidden rounded-[1.8rem] border border-white/10"
            data-bot-theme={look.theme}
            data-lcd-mode="dark"
            style={{ background: canvas ?? `radial-gradient(circle at 50% 28%, ${colors[0]}22, #09090b 62%)` }}
        >
            <p className={cn("px-5 pt-4 text-[11px] uppercase tracking-[0.18em]", ink ? "opacity-70" : "text-white/35")} style={ink ? { color: ink } : undefined}>Live page</p>
            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 pb-8 pt-6 text-center">
                <p className={cn("text-sm", ink ? "opacity-75" : "text-white/55")} style={ink ? { color: ink } : undefined}>Hi!</p>
                <h3 className={cn("mt-2 text-2xl font-medium tracking-tight", !ink && "text-white")} style={ink ? { color: ink } : undefined}>{name}&apos;s AI</h3>
                <div className="mt-8">
                    <WelcomeOrb
                        size={168}
                        look={look.look || "bloub"}
                        skin={look.skin}
                        variant={look.variant}
                        shape={look.shape}
                        expression={look.expression}
                        color={look.color}
                        aura={look.aura}
                        theme={look.theme}
                        colors={colors}
                        mood="greeting"
                    />
                </div>
                <p className={cn("mt-8 rounded-full px-4 py-2 text-[13px]", ink ? "border bg-white/5" : "bg-white/10 text-white/70")} style={ink ? { color: ink, borderColor: `${ink}55` } : undefined}>What should I know about {name}?</p>
            </div>
        </div>
    )
}
