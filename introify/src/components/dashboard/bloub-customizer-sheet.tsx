"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WelcomeOrb } from "@/components/welcome-orb"
import { toast } from "sonner"
import { BLOUB_AURAS, BLOUB_MOODS, BLOB_SHAPES, CUSTOMIZER_BOTS, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, blobColorIndex, blobPickFromColorIndex, bloubBotPick, bloubThemeThumb, customizerBotPick, isCustomizerBotSelected, isNamedBloubBotSelected, isPremiumBloubTheme, lookThemesFor, usesAnimojiFaces, usesBlobColorSlider, usesBlobShapes, type BloubPick } from "@/lib/bloub/catalog"
import { ANIMOJI_FACES, resolveAnimojiId } from "@/lib/animoji"
import { BlobColorSlider } from "@/components/dashboard/blob-color-slider"
import { cn } from "@/lib/utils"

const TABS = [
    { id: "bots", label: "Bots" },
    { id: "look", label: "Look" },
    { id: "mood", label: "Mood" },
] as const

type TabId = (typeof TABS)[number]["id"]

export function BloubCustomizerSheet({
    open,
    onClose,
    value,
    onChange,
    premium = false,
}: {
    open: boolean
    onClose: () => void
    value: BloubPick
    onChange: (next: Partial<BloubPick>) => void
    premium?: boolean
}) {
    const [tab, setTab] = useState<TabId>("bots")
    useEffect(() => {
        if (open) setTab("bots")
    }, [open])
    const themes = lookThemesFor(value)
    const showSlider = usesBlobColorSlider(value)
    const showShapes = usesBlobShapes(value)
    return (
        <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
            <SheetContent
                side="bottom"
                className="gap-0 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-2xl"
            >
                <div className="sticky top-0 z-10 bg-background">
                    <SheetHeader className="border-b px-4 pb-4 pr-12">
                        <div className="flex items-center gap-3">
                            <WelcomeOrb
                                size={56}
                                look={value.look || "bloub"}
                                skin={value.skin}
                                shape={value.shape}
                                expression={value.expression}
                                color={value.color}
                                variant={value.variant}
                                aura={value.aura}
                                theme={value.theme}
                            />
                            <div className="min-w-0 text-left">
                                <SheetTitle>Customise bot</SheetTitle>
                                <SheetDescription>Choose a bot, its theme, mood and motion.</SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                    <div className="px-4 pt-3" role="tablist" aria-label="Bot customisation">
                        <div className="grid h-11 w-full grid-cols-3 rounded-2xl bg-muted/80 p-1">
                            {TABS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === item.id}
                                    onClick={() => setTab(item.id)}
                                    className={cn(
                                        "h-9 rounded-xl px-2 text-[13px] font-medium",
                                        tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-5 px-4 py-4" role="tabpanel">
                    {tab === "look" ? (
                        <>
                            {showSlider ? (
                                <section className="space-y-2">
                                    <p className="text-xs font-medium">Colour</p>
                                    <BlobColorSlider index={blobColorIndex(value.variant)} onChange={(i) => onChange(blobPickFromColorIndex(i, value.look))} />
                                </section>
                            ) : null}
                            {showShapes ? (
                                <section className="space-y-2">
                                    <p className="text-xs font-medium">Shape</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {BLOB_SHAPES.map((item) => {
                                            const locked = Boolean(item.premium && !premium)
                                            const selected = value.shape === item.id
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    aria-label={locked ? `${item.label}, premium` : item.label}
                                                    aria-pressed={selected}
                                                    onClick={() => {
                                                        if (locked) {
                                                            toast.message("This is a premium shape")
                                                            return
                                                        }
                                                        onChange({ look: "bloub", theme: "classic", shape: item.id })
                                                    }}
                                                    className={cn(
                                                        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                        selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                                        locked && "opacity-60",
                                                    )}
                                                >
                                                    <WelcomeOrb still size={44} look="bloub" shape={item.id} expression={value.expression} color={value.color} variant={value.variant} aura="still" theme="classic" />
                                                    <span className="text-[10px] font-medium">{item.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            ) : null}
                            {themes.length ? (
                                <section className="space-y-2">
                                    <p className="text-xs font-medium">Chat themes</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {themes.map((item) => {
                                            const thumb = bloubThemeThumb(item.id, "light")
                                            const premiumTheme = isPremiumBloubTheme(item.id)
                                            return (
                                                <div
                                                    key={item.id}
                                                    aria-label={premiumTheme && !premium ? `${item.label} theme, premium` : `${item.label} theme`}
                                                    className="rounded-xl border border-foreground bg-muted/60 p-3 text-left"
                                                >
                                                    <span aria-hidden className="mb-3 flex h-12 items-center justify-center gap-2 rounded-md" style={{ background: thumb.bg }}>
                                                        <span className="h-5 w-5 rounded-full" style={{ background: thumb.dot }} />
                                                        <span className="h-1.5 w-9 rounded-full" style={{ background: thumb.bar }} />
                                                    </span>
                                                    <span className="block text-xs font-medium">{item.label}{premiumTheme ? " ✦" : ""}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </section>
                            ) : (
                                <p className="text-xs text-muted-foreground">This bot has no extra chat theme.</p>
                            )}
                        </>
                    ) : null}

                    {tab === "mood" ? (
                        usesAnimojiFaces(value) ? (
                            <section className="space-y-2">
                                <p className="text-xs font-medium">Face</p>
                                <div className="grid grid-cols-3 gap-2">
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
                                                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                    selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                                )}
                                            >
                                                <WelcomeOrb still size={56} look="animoji" skin={item.id} aura="still" theme="classic" />
                                                <span className="text-[11px] font-medium">{item.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        ) : (
                        <>
                            <section className="space-y-2">
                                <p className="text-xs font-medium">Mood</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {BLOUB_MOODS.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onChange({ expression: item.id })}
                                            className={cn(
                                                "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                value.expression === item.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                                            )}
                                        >
                                            <WelcomeOrb
                                                key={item.id}
                                                still
                                                size={56}
                                                look={value.look || "bloub"}
                                                skin={value.skin}
                                                shape={value.shape}
                                                expression={item.id}
                                                color={value.color}
                                                variant={value.variant}
                                                aura="still"
                                                theme={value.theme}
                                            />
                                            <span className="text-[10px] font-medium">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section className="space-y-2">
                                <p className="text-xs font-medium">Aura</p>
                                <div className="flex flex-wrap gap-2">
                                    {BLOUB_AURAS.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onChange({ aura: item.id })}
                                            className={cn(
                                                "rounded-full border px-3.5 py-2 text-xs",
                                                value.aura === item.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </>
                        )
                    ) : null}

                    {tab === "bots" ? (
                        <section className="space-y-2">
                            <p className="text-xs font-medium">Bots</p>
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                                {CUSTOMIZER_BOTS.map((bot) => {
                                    const locked = Boolean(bot.premium && !premium)
                                    const selected = isCustomizerBotSelected(bot, value)
                                    return (
                                        <button
                                            key={bot.id}
                                            type="button"
                                            aria-label={locked ? `${bot.label}, premium` : bot.label}
                                            aria-pressed={selected}
                                            onClick={() => {
                                                if (locked) {
                                                    toast.message("This is a premium bot")
                                                    return
                                                }
                                                onChange(customizerBotPick(bot, value))
                                            }}
                                            className={cn(
                                                "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                                locked && "opacity-60",
                                            )}
                                        >
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
                                            <span className="text-[10px] font-medium">{bot.label}</span>
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
                                            onClick={() => onChange(bloubBotPick(bot))}
                                            className={cn(
                                                "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                            )}
                                        >
                                            <WelcomeOrb still size={56} look="bloub" shape={bot.id} expression={bot.expression} color={bot.color} aura="still" theme={bot.theme} />
                                            <span className="text-[10px] font-medium">{bot.label}</span>
                                        </button>
                                    )
                                })}
                                {PREMIUM_BLOUB_BOTS.map((bot) => {
                                    const selected = isNamedBloubBotSelected(bot, value)
                                    return (
                                        <button
                                            key={bot.label}
                                            type="button"
                                            aria-label={premium ? bot.label : `${bot.label}, premium`}
                                            aria-pressed={selected}
                                            onClick={() => {
                                                if (!premium) {
                                                    toast.message("This is a premium bot")
                                                    return
                                                }
                                                onChange(bloubBotPick(bot))
                                            }}
                                            className={cn(
                                                "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                                selected ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                                !premium && "opacity-60",
                                            )}
                                        >
                                            <WelcomeOrb still size={56} look="bloub" shape={bot.id} expression={bot.expression} color={bot.color} aura="still" theme={bot.theme} />
                                            <span className="text-[10px] font-medium">{bot.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    )
}
