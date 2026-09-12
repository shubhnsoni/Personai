"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { WelcomeOrb } from "@/components/welcome-orb"
import { BLOUB_THEMES, BLOUB_THEME_META, type BloubBot, type BloubThemeId, type CustomizerBot } from "@/lib/bloub/catalog"
import { cn } from "@/lib/utils"

export type PremiumBot = CustomizerBot | BloubBot

const PIXEL_BLURB: Record<string, string> = {
    bit: "Chunky pixel eyes straight from a handheld, blinking in crisp 8-bit.",
    crt: "Phosphor glow and rolling scanlines from a warm tube monitor.",
    spark: "A crackling spark of light with sharp, bright eyes.",
}

function isNamedBot(bot: PremiumBot): bot is BloubBot {
    return "theme" in bot
}

/** Everything a Free owner needs to fall for a Premium bot: the live character, its worlds, and the way in. */
export function PremiumBotPreview({
    bot,
    onClose,
    upgradeHref = "/dashboard/billing",
}: {
    bot: PremiumBot | null
    onClose: () => void
    upgradeHref?: string
}) {
    const [theme, setTheme] = useState<BloubThemeId | null>(null)
    const named = bot && isNamedBot(bot) ? bot : null
    const pixel = bot && !isNamedBot(bot) ? bot : null
    const looks = named?.themes ?? (named ? [named.theme] : [])
    const activeTheme = theme && looks.includes(theme) ? theme : named?.theme ?? "classic"
    const blurb = named ? BLOUB_THEME_META[activeTheme]?.note ?? "" : pixel ? PIXEL_BLURB[String(pixel.skin)] ?? "" : ""
    const themeLabel = (id: BloubThemeId) => BLOUB_THEMES.find((item) => item.id === id)?.label ?? id

    return (
        <Dialog open={bot !== null} onOpenChange={(next) => { if (!next) { setTheme(null); onClose() } }}>
            <DialogContent data-premium-bot-preview aria-describedby="premium-bot-preview-note" className="md:max-w-md">
                {bot ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                            <Sparkles size={12} aria-hidden /> Premium bot
                        </span>
                        <div className="flex h-52 w-full items-center justify-center rounded-3xl" style={{ background: named ? BLOUB_THEME_META[activeTheme]?.canvas.dark ?? "#0b0d12" : "#0b0d12" }}>
                            {named ? (
                                <WelcomeOrb key={activeTheme} size={168} look="bloub" shape="cercle" expression={named.expression} color={named.color} aura={named.aura} theme={activeTheme} />
                            ) : pixel ? (
                                <WelcomeOrb key={pixel.id} size={168} look={pixel.look} skin={pixel.skin} shape="cercle" expression="centre" aura="pulse" theme="classic" />
                            ) : null}
                        </div>
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-semibold">{bot.label}{named && looks.length > 1 ? ` · ${themeLabel(activeTheme)}` : ""}</DialogTitle>
                            <DialogDescription id="premium-bot-preview-note" className="text-sm leading-relaxed text-white/70">{blurb}</DialogDescription>
                        </div>
                        {looks.length > 1 ? (
                            <div className="flex w-full flex-wrap justify-center gap-1.5" role="group" aria-label={`${bot.label} looks`}>
                                {looks.map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        aria-pressed={activeTheme === id}
                                        onClick={() => setTheme(id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium",
                                            activeTheme === id ? "bg-white text-zinc-950" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
                                        )}
                                    >
                                        <WelcomeOrb still size={32} look="bloub" shape="cercle" expression="centre" aura="still" theme={id} />
                                        {themeLabel(id)}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        <div className="flex w-full flex-col gap-2 pt-1">
                            <Link
                                href={upgradeHref}
                                data-upgrade-link
                                onClick={onClose}
                                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-zinc-950 hover:bg-white/90"
                            >
                                <Sparkles size={16} aria-hidden /> Unlock with Premium
                            </Link>
                            <button type="button" onClick={onClose} className="h-10 w-full rounded-full text-sm font-medium text-white/60 hover:text-white">
                                Maybe later
                            </button>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
