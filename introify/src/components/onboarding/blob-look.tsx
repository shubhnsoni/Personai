"use client"

import { toast } from "sonner"
import { WelcomeOrb } from "@/components/welcome-orb"
import {
    BLOUB_AURAS,
    BLOUB_COLORS,
    BLOUB_MOODS,
    BLOUB_THEMES,
    INCLUDED_BLOUB_BOTS,
    PREMIUM_BLOUB_BOTS,
    gradientForColor,
    type BloubPick,
} from "@/lib/bloub/catalog"
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
    const retro = value.theme === "retro-lcd"

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
                    look="bloub"
                    shape={value.shape}
                    expression={value.expression}
                    color={value.color}
                    aura={value.aura}
                    theme={value.theme}
                    colors={colors}
                    mood="idle"
                />
            </div>

            <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Theme</p>
                <div className="grid grid-cols-2 gap-2">
                    {BLOUB_THEMES.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-label={`${item.label} theme`}
                            aria-pressed={value.theme === item.id}
                            onClick={() => onChange({ theme: item.id, ...(item.id === "retro-lcd" ? { shape: "cercle" as const } : {}) })}
                            className={cn("rounded-2xl border p-3 text-left", value.theme === item.id ? "border-white/70 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")}
                        >
                            <span aria-hidden className="mb-3 flex h-12 items-center justify-center gap-2 rounded-md" style={{ background: item.id === "retro-lcd" ? "#253021" : "#15202b" }}>
                                <span className="h-5 w-5 rounded-full" style={{ background: item.id === "retro-lcd" ? "#c4d58a" : "#b2edff" }} />
                                <span className="h-1.5 w-9 rounded-full" style={{ background: item.id === "retro-lcd" ? "#c4d58a" : "#dbe4ee" }} />
                            </span>
                            <span className="block text-[13px] font-medium text-white">{item.label}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-white/60">{item.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">Colour</p>
                {retro ? <p className="rounded-2xl border border-[#c4d58a]/20 bg-[#253021] p-3 text-sm leading-relaxed text-[#c4d58a]">Pale LCD green and deep olive, automatically inverted in dark mode. Your Classic colour is kept for when you switch back.</p> : (
                <div className="flex flex-wrap gap-2">
                    {BLOUB_COLORS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            aria-label={item.label}
                            aria-pressed={value.color === item.id}
                            onClick={() => onChange({ color: item.id })}
                            className={cn(
                                "h-8 w-8 rounded-full",
                                value.color === item.id ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "opacity-80 hover:opacity-100",
                            )}
                            style={{ background: item.hex }}
                        />
                    ))}
                </div>
                )}
            </section>

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
                    <button
                        type="button"
                        aria-label="Retro LCD"
                        aria-pressed={retro}
                        onClick={() => onChange({ theme: "retro-lcd", shape: "cercle" })}
                        className={cn("flex flex-col items-center gap-1 rounded-2xl py-2", retro ? "bg-[#c4d58a] text-[#253021]" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]")}
                    >
                        <WelcomeOrb still size={44} look="bloub" shape="cercle" expression={value.expression} color={value.color} theme="retro-lcd" aura="still" />
                        <span className="text-[10px]">Retro LCD</span>
                    </button>
                    {INCLUDED_BLOUB_BOTS.map((bot) => (
                        <button
                            key={bot.id}
                            type="button"
                            onClick={() => onChange({ shape: bot.id, theme: "classic" })}
                            className={cn(
                                "flex flex-col items-center gap-1 rounded-2xl py-2",
                                !retro && value.shape === bot.id ? "bg-white text-zinc-950" : "bg-white/[0.04] text-white/75 hover:bg-white/[0.1]",
                            )}
                            aria-label={bot.label}
                            aria-pressed={!retro && value.shape === bot.id}
                        >
                            <WelcomeOrb
                                still
                                size={44}
                                look="bloub"
                                shape={bot.id}
                                expression={bot.expression}
                                color={value.color}
                                aura="still"
                            />
                            <span className="text-[10px]">{bot.label}</span>
                        </button>
                    ))}
                    {PREMIUM_BLOUB_BOTS.map((bot) => (
                        <button
                            key={bot.id}
                            type="button"
                            onClick={() => toast.message("This is a premium bot")}
                            className="relative flex flex-col items-center gap-1 rounded-2xl bg-white/[0.04] py-2 opacity-60"
                            aria-label={`${bot.label}, premium`}
                        >
                            <WelcomeOrb
                                still
                                size={44}
                                look="bloub"
                                shape={bot.id}
                                expression={bot.expression}
                                color={bot.color}
                                aura="still"
                            />
                            <span className="text-[10px] text-white/50">{bot.label}</span>
                        </button>
                    ))}
                </div>
            </section>

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
    return (
        <div
            className="overflow-hidden rounded-[1.8rem] border border-white/10"
            data-bot-theme={look.theme}
            data-lcd-mode="dark"
            style={{ background: retro ? "#253021" : `radial-gradient(circle at 50% 28%, ${colors[0]}22, #09090b 62%)` }}
        >
            <p className={cn("px-5 pt-4 text-[11px] uppercase tracking-[0.18em]", retro ? "text-[#c4d58a]/70" : "text-white/35")}>Live page</p>
            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 pb-8 pt-6 text-center">
                <p className={cn("text-sm", retro ? "text-[#c4d58a]/75" : "text-white/55")}>Hi!</p>
                <h3 className={cn("mt-2 text-2xl font-medium tracking-tight", retro ? "text-[#c4d58a]" : "text-white")}>{name}&apos;s AI</h3>
                <div className="mt-8">
                    <WelcomeOrb
                        size={168}
                        look="bloub"
                        shape={look.shape}
                        expression={look.expression}
                        color={look.color}
                        aura={look.aura}
                        theme={look.theme}
                        colors={colors}
                        mood="greeting"
                    />
                </div>
                <p className={cn("mt-8 rounded-full px-4 py-2 text-[13px]", retro ? "border border-[#c4d58a]/30 bg-[#c4d58a]/10 text-[#c4d58a]" : "bg-white/10 text-white/70")}>What should I know about {name}?</p>
            </div>
        </div>
    )
}
