"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WelcomeOrb } from "@/components/welcome-orb"
import { BLOUB_COLORS, BLOUB_EXPRESSIONS, BLOUB_SHAPES, type BloubPick } from "@/lib/bloub/catalog"
import { cn } from "@/lib/utils"

export function BloubCustomizerSheet({
    open,
    onClose,
    value,
    onChange,
}: {
    open: boolean
    onClose: () => void
    value: BloubPick
    onChange: (next: Partial<BloubPick>) => void
}) {
    return (
        <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
            <SheetContent
                side="bottom"
                className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-none"
            >
                <SheetHeader className="border-b px-4 pb-4">
                    <div className="flex items-center gap-3">
                        <WelcomeOrb
                            size={56}
                            look="bloub"
                            shape={value.shape}
                            expression={value.expression}
                            color={value.color}
                        />
                        <div className="min-w-0 text-left">
                            <SheetTitle>Customise blob</SheetTitle>
                            <SheetDescription>Colour, face, then shape.</SheetDescription>
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
                        <p className="text-xs font-medium">Expression</p>
                        <div className="grid grid-cols-4 gap-2">
                            {BLOUB_EXPRESSIONS.map((item) => (
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
                                        size={44}
                                        look="bloub"
                                        shape={value.shape}
                                        expression={item.id}
                                        color={value.color}
                                    />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <p className="text-xs font-medium">Shape</p>
                        <div className="grid grid-cols-4 gap-2">
                            {BLOUB_SHAPES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onChange({ shape: item.id })}
                                    className={cn(
                                        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                                        value.shape === item.id ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
                                    )}
                                >
                                    <WelcomeOrb
                                        size={44}
                                        look="bloub"
                                        shape={item.id}
                                        expression={value.expression}
                                        color={value.color}
                                    />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    )
}
