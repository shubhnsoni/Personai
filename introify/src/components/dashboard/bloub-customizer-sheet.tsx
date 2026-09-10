"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WelcomeOrb } from "@/components/welcome-orb"
import { toast } from "sonner"
import { BLOUB_AURAS, BLOUB_COLORS, BLOUB_MOODS, PREMIUM_BLOUB_BOTS, isPremiumBloubShape, type BloubPick } from "@/lib/bloub/catalog"
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
    return (
        <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
            <SheetContent
                side="bottom"
                className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-none"
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
                        />
                        <div className="min-w-0 text-left">
                            <SheetTitle>Customise blob</SheetTitle>
                            <SheetDescription>One colour, a mood, and an aura.</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-5 px-4 py-4">
                    <section className="space-y-2">
                        <p className="text-xs font-medium">Colour</p>
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
                        <p className="text-xs font-medium">More bots</p>
                        <div className="grid grid-cols-5 gap-2">
                            {PREMIUM_BLOUB_BOTS.map((bot) => (
                                <button
                                    key={bot.id}
                                    type="button"
                                    onClick={() => {
                                        if (!premium || isPremiumBloubShape(bot.id)) {
                                            if (!premium) {
                                                toast.message("This is a premium bot")
                                                return
                                            }
                                        }
                                        onChange({ shape: bot.id, expression: bot.expression, color: bot.color })
                                    }}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                        value.shape === bot.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                                        !premium && "opacity-60",
                                    )}
                                    aria-label={premium ? bot.label : `${bot.label}, premium`}
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
