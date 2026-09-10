"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WelcomeOrb } from "@/components/welcome-orb"
import { toast } from "sonner"
import { BLOUB_AURAS, BLOUB_COLORS, BLOUB_MOODS, BLOUB_THEMES, INCLUDED_BLOUB_BOTS, PREMIUM_BLOUB_BOTS, type BloubPick } from "@/lib/bloub/catalog"
import { cn } from "@/lib/utils"

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
    const retro = value.theme === "retro-lcd"
    return (
        <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
            <SheetContent
                side="bottom"
                className="gap-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] md:max-w-2xl"
            >
                <SheetHeader className="border-b px-4 pb-4 pr-12">
                    <div className="flex items-center gap-3">
                        <WelcomeOrb
                            size={56}
                            look="bloub"
                            shape={value.shape}
                            expression={value.expression}
                            color={value.color}
                            aura={value.aura}
                            theme={value.theme}
                        />
                        <div className="min-w-0 text-left">
                            <SheetTitle>Customise bot</SheetTitle>
                            <SheetDescription>Choose a bot, its theme, mood and motion.</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-5 px-4 py-4">
                    <section className="space-y-2">
                        <p className="text-xs font-medium">Theme</p>
                        <div className="grid grid-cols-2 gap-2">
                            {BLOUB_THEMES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-label={`${item.label} theme`}
                                    aria-pressed={value.theme === item.id}
                                    onClick={() => onChange({ theme: item.id, ...(item.id === "retro-lcd" ? { shape: "cercle" as const } : {}) })}
                                    className={cn("rounded-xl border p-3 text-left", value.theme === item.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40")}
                                >
                                    <span aria-hidden className="mb-3 flex h-12 items-center justify-center gap-2 rounded-md" style={{ background: item.id === "retro-lcd" ? "#c4d58a" : "#e7ebf0" }}>
                                        <span className="h-5 w-5 rounded-full" style={{ background: item.id === "retro-lcd" ? "#253021" : "#00a0c3" }} />
                                        <span className="h-1.5 w-9 rounded-full" style={{ background: item.id === "retro-lcd" ? "#253021" : "#445365" }} />
                                    </span>
                                    <span className="block text-xs font-medium">{item.label}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="space-y-2">
                        <p className="text-xs font-medium">Colour</p>
                        {retro ? <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">Pale LCD green and deep olive, automatically inverted in dark mode. Your Classic colour is kept for when you switch back.</p> : (
                        <div className="flex flex-wrap gap-2">
                            {BLOUB_COLORS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    title={item.label}
                                    onClick={() => onChange({ color: item.id })}
                                    className={cn(
                                        "h-9 w-9 rounded-full border-2",
                                        value.color === item.id ? "border-foreground" : "border-transparent"
                                    )}
                                    style={{ background: item.hex }}
                                    aria-label={item.label}
                                />
                            ))}
                        </div>
                        )}
                    </section>

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
                                        still
                                        size={44}
                                        look="bloub"
                                        shape={value.shape}
                                        expression={item.id}
                                        color={value.color}
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

                    <section className="space-y-2">
                        <p className="text-xs font-medium">Bots</p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                            <button
                                type="button"
                                aria-label="Retro LCD"
                                aria-pressed={retro}
                                onClick={() => onChange({ theme: "retro-lcd", shape: "cercle" })}
                                className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-center", retro ? "border-foreground bg-muted/60" : "hover:bg-muted/40")}
                            >
                                <WelcomeOrb still size={44} look="bloub" shape="cercle" expression={value.expression} color={value.color} theme="retro-lcd" aura="still" />
                                <span className="text-[10px] font-medium">Retro LCD</span>
                            </button>
                            {INCLUDED_BLOUB_BOTS.map((bot) => (
                                <button
                                    key={bot.id}
                                    type="button"
                                    onClick={() => onChange({ shape: bot.id, theme: "classic" })}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                        !retro && value.shape === bot.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
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
                                    <span className="text-[10px] font-medium">{bot.label}</span>
                                </button>
                            ))}
                            {PREMIUM_BLOUB_BOTS.map((bot) => (
                                <button
                                    key={bot.id}
                                    type="button"
                                    onClick={() => {
                                        if (!premium) {
                                            toast.message("This is a premium bot")
                                            return
                                        }
                                        onChange({ shape: bot.id, expression: bot.expression, color: bot.color, theme: "classic" })
                                    }}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                        !retro && value.shape === bot.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                        !premium && "opacity-60",
                                    )}
                                    aria-label={premium ? bot.label : `${bot.label}, premium`}
                                    aria-pressed={!retro && value.shape === bot.id}
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
                                    <span className="text-[10px] font-medium">{bot.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    )
}
